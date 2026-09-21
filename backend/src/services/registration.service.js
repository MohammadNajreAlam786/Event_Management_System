import crypto from 'node:crypto';
import mongoose from 'mongoose';

import Registration from '../models/registration.model.js';
import Team from '../models/team.model.js';
import Event, { EVENT_STATUSES, EVENT_CATEGORIES, EVENT_REGISTRATION_TYPES } from '../models/event.model.js';
import User, { ROLES, USER_STATUS } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { loadOwnedEvent } from './event.service.js';
import { issueQrNonce } from '../utils/qrToken.js';
import { attendanceByRegistrationForUser } from './attendance.service.js';
import { notifyRegistrationConfirmed } from './notification.service.js';
import { syncEventStatuses } from './eventStatusTransition.service.js';

/**
 * Participant registration domain logic (Phase 6).
 *
 * Visibility / registrability rules follow the existing Event status model —
 * no new status system is introduced:
 *   - discovery list  : PLANNED, UPCOMING, ONGOING   (never DRAFT / CANCELLED / COMPLETED / soft-deleted)
 *   - registrable     : PLANNED, UPCOMING            (+ inside the registration window if one is set,
 *                                                     + below maxParticipants if a capacity is set)
 * The registration window (`registrationStartDate` / `registrationEndDate`) and
 * capacity (`maxParticipants`) are existing, optional Event fields — enforced
 * only when set.
 */

const DISCOVERY_STATUSES = [EVENT_STATUSES.PLANNED, EVENT_STATUSES.UPCOMING, EVENT_STATUSES.ONGOING];
const REGISTRABLE_STATUSES = [EVENT_STATUSES.PLANNED, EVENT_STATUSES.UPCOMING];

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 60;
const NOT_DELETED = { isDeleted: { $ne: true } };

const escapeRegExp = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clampPage = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
};
const clampLimit = (v) => {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
};
const assertObjectId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest(`Invalid ${label}.`);
};

/** Field-level 400, matching the shape the frontend forms already expect. */
const throwFieldError = (field, message) =>
  Object.assign(ApiError.badRequest(message), { errors: { [field]: message } });

/**
 * Can a participant register for this event right now?
 * @returns {{ registrable: boolean, reason: string|null }}
 */
export const evaluateRegistrability = (event, now = new Date()) => {
  if (event.status === EVENT_STATUSES.CANCELLED) {
    return { registrable: false, reason: 'This event has been cancelled.' };
  }
  if (event.status === EVENT_STATUSES.COMPLETED) {
    return { registrable: false, reason: 'This event has already taken place.' };
  }
  if (event.status === EVENT_STATUSES.ONGOING) {
    return { registrable: false, reason: 'This event is already in progress.' };
  }
  if (!REGISTRABLE_STATUSES.includes(event.status)) {
    return { registrable: false, reason: 'Registration is not open for this event yet.' };
  }
  if (event.registrationStartDate && now < new Date(event.registrationStartDate)) {
    return { registrable: false, reason: 'Registration for this event has not opened yet.' };
  }
  if (event.registrationEndDate && now > new Date(event.registrationEndDate)) {
    return { registrable: false, reason: 'Registration for this event has closed.' };
  }
  return { registrable: true, reason: null };
};

/** Participant-facing view of an event — never exposes organiser contact details or planning data. */
const toParticipantEvent = (
  event,
  { myRegistration = null, registeredCount = 0, now = new Date(), myTeam = null } = {},
) => {
  const max = event.maxParticipants ?? null;
  const { registrable, reason } = evaluateRegistrability(event, now);
  const isFull = max != null && registeredCount >= max;
  return {
    id: event._id ? event._id.toString() : String(event.id),
    title: event.title,
    description: event.description,
    category: event.category,
    venue: event.venue,
    startDate: event.startDate,
    endDate: event.endDate,
    registrationStartDate: event.registrationStartDate ?? null,
    registrationEndDate: event.registrationEndDate ?? null,
    image: event.image || '',
    status: event.status,
    registrationType: event.registrationType ?? 'INDIVIDUAL',
    maxTeamSize: event.maxTeamSize ?? null,
    organiserName: event.organiser && event.organiser.name ? event.organiser.name : null,
    capacity: {
      max,
      registered: registeredCount,
      spotsLeft: max == null ? null : Math.max(0, max - registeredCount),
      isFull,
    },
    registration: {
      registrable: registrable && !isFull,
      reason: isFull ? 'This event is full.' : reason,
    },
    myRegistration: myRegistration
      ? {
          id: String(myRegistration._id ?? myRegistration.id),
          status: myRegistration.status,
          registeredAt: myRegistration.registeredAt,
          cancelledAt: myRegistration.cancelledAt,
          team: myTeam
            ? {
                id: String(myTeam._id),
                teamId: myTeam.teamId,
                name: myTeam.name,
                status: myTeam.status,
                size: myTeam.size,
                isLeader: String(myTeam.leader) === String(myRegistration.user ?? myRegistration.userId ?? ''),
              }
            : null,
        }
      : null,
  };
};

const registeredCountsByEvent = async (eventIds) => {
  if (eventIds.length === 0) return new Map();
  const rows = await Registration.aggregate([
    { $match: { event: { $in: eventIds.map((id) => new mongoose.Types.ObjectId(String(id))) }, status: 'REGISTERED' } },
    { $group: { _id: '$event', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
};

/** GET /api/events/public — the participant discovery list. */
export const listPublicEvents = async ({ userId, search, category, upcoming, page, limit }) => {
  await syncEventStatuses();
  const filter = { ...NOT_DELETED, status: { $in: DISCOVERY_STATUSES } };

  if (search && String(search).trim()) {
    const pattern = new RegExp(escapeRegExp(String(search).trim()), 'i');
    filter.$or = [{ title: pattern }, { venue: pattern }];
  }
  if (category) {
    const cat = String(category).trim().toUpperCase();
    if (!Object.values(EVENT_CATEGORIES).includes(cat)) {
      throw ApiError.badRequest(`"${category}" is not a valid category.`);
    }
    filter.category = cat;
  }
  if (upcoming === true || upcoming === 'true' || upcoming === '1') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    filter.startDate = { $gte: startOfToday };
  }

  const pageNum = clampPage(page);
  const limitNum = clampLimit(limit);

  const [docs, totalEvents] = await Promise.all([
    Event.find(filter)
      .sort({ startDate: 1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('organiser', 'name')
      .lean(),
    Event.countDocuments(filter),
  ]);

  const ids = docs.map((d) => d._id);
  const [countsMap, myRegs] = await Promise.all([
    registeredCountsByEvent(ids),
    Registration.find({ user: userId, event: { $in: ids } }).lean(),
  ]);
  const myRegByEvent = new Map(myRegs.map((r) => [String(r.event), r]));

  return {
    events: docs.map((d) =>
      toParticipantEvent(d, {
        myRegistration: myRegByEvent.get(String(d._id)) ?? null,
        registeredCount: countsMap.get(String(d._id)) ?? 0,
      }),
    ),
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalEvents,
      totalPages: Math.max(1, Math.ceil(totalEvents / limitNum)),
    },
  };
};

/**
 * GET /api/events/public/featured — a small, anonymous-safe preview list for
 * the public Home page (Phase 13). No `userId` is available (the caller may
 * not be signed in at all), so `myRegistration` is always omitted; the
 * generic `capacity`/`registration.registrable` fields are still computed
 * since those depend only on the event itself, not on who is asking. Reuses
 * the exact same discovery filter and participant-safe shape as
 * `listPublicEvents` — no parallel event-listing logic.
 */
export const listFeaturedEvents = async ({ limit = 6 } = {}) => {
  await syncEventStatuses();
  const limitNum = clampLimit(limit);

  const docs = await Event.find({ ...NOT_DELETED, status: { $in: DISCOVERY_STATUSES } })
    .sort({ startDate: 1, createdAt: -1 })
    .limit(limitNum)
    .populate('organiser', 'name')
    .lean();

  const countsMap = await registeredCountsByEvent(docs.map((d) => d._id));

  return {
    events: docs.map((d) =>
      toParticipantEvent(d, { registeredCount: countsMap.get(String(d._id)) ?? 0 }),
    ),
  };
};

/** GET /api/events/public/:id — one event's participant-facing detail. DRAFT / deleted → 404. */
export const getPublicEvent = async ({ userId, eventId }) => {
  assertObjectId(eventId, 'event id');
  await syncEventStatuses();
  const event = await Event.findOne({
    _id: eventId,
    ...NOT_DELETED,
    status: { $ne: EVENT_STATUSES.DRAFT },
  })
    .populate('organiser', 'name')
    .lean();
  if (!event) throw ApiError.notFound('Event not found.');

  const [registeredCount, myRegistration] = await Promise.all([
    Registration.countDocuments({ event: eventId, status: 'REGISTERED' }),
    Registration.findOne({ user: userId, event: eventId }).lean(),
  ]);

  const myTeam = myRegistration?.team ? await Team.findById(myRegistration.team).lean() : null;

  return toParticipantEvent(event, { myRegistration, registeredCount, myTeam });
};

/**
 * POST /api/events/:id/register — create or reactivate the caller's registration.
 *
 * Deliberately does NOT re-run `syncEventStatuses()` here: by the time a
 * participant reaches this action they have virtually always just loaded the
 * event via `listPublicEvents`/`getPublicEvent` (both already sync), so the
 * status is already fresh. Re-syncing the whole collection on every
 * registration attempt would recompute status for every published event on
 * a simple write path with no real freshness benefit for this endpoint.
 */
export const registerForEvent = async ({ userId, eventId }) => {
  assertObjectId(eventId, 'event id');
  const event = await Event.findOne({ _id: eventId, ...NOT_DELETED });
  // DRAFT events are not publicly visible — behave as if they don't exist.
  if (!event || event.status === EVENT_STATUSES.DRAFT) throw ApiError.notFound('Event not found.');

  if (event.registrationType === EVENT_REGISTRATION_TYPES.TEAM) {
    throw ApiError.conflict('This event requires team registration — register with a team instead.');
  }

  const { registrable, reason } = evaluateRegistrability(event);
  if (!registrable) throw ApiError.conflict(reason);

  const existing = await Registration.findOne({ user: userId, event: eventId });
  if (existing && existing.status === 'REGISTERED') {
    throw ApiError.conflict('You are already registered for this event.');
  }

  if (event.maxParticipants != null) {
    const registeredCount = await Registration.countDocuments({ event: eventId, status: 'REGISTERED' });
    if (registeredCount >= event.maxParticipants) {
      throw ApiError.conflict('This event is full.');
    }
  }

  let registration;
  if (existing) {
    // Reactivate the cancelled row — no duplicate active record, stable id.
    // A fresh QR nonce is issued so any previously shown QR is superseded.
    existing.status = 'REGISTERED';
    existing.registeredAt = new Date();
    existing.cancelledAt = null;
    existing.qrNonce = issueQrNonce();
    registration = await existing.save();
  } else {
    try {
      registration = await Registration.create({ user: userId, event: eventId, qrNonce: issueQrNonce() });
    } catch (err) {
      if (err && err.code === 11000) {
        throw ApiError.conflict('You are already registered for this event.');
      }
      throw err;
    }
  }

  const registeredCount = await Registration.countDocuments({ event: eventId, status: 'REGISTERED' });
  await event.populate('organiser', 'name');

  // Side effect (Phase 8) — never blocks or breaks registration. De-duplicated
  // per (user, event) by the notification model, so re-registering after a
  // cancel does not send a second confirmation.
  notifyRegistrationConfirmed({ userId, eventId, eventTitle: event.title }).catch(() => {});

  return {
    registration: {
      id: registration._id.toString(),
      status: registration.status,
      registeredAt: registration.registeredAt,
    },
    event: toParticipantEvent(event, { myRegistration: registration, registeredCount }),
  };
};

/** Generate a unique public team id ("TEAM-XXXXXX"). Server-side only — never client-supplied. */
const generateTeamId = async () => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    const candidate = `TEAM-${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Team.exists({ teamId: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Could not allocate a unique team id after several attempts.');
};

/**
 * POST /api/events/:id/register/team — team registration (Phase 14).
 *
 * Every member — leader included — gets their OWN Registration row (with its
 * own qrNonce, referencing the shared Team doc). This is deliberate: it means
 * QR attendance, individual attendance records and certificate eligibility
 * (registration + PRESENT attendance + COMPLETED event) all keep working
 * exactly as they did before team registration existed — see team.model.js.
 *
 * Every member is resolved from an existing, ACTIVE, USER-role account by
 * email; nothing here accepts a client-supplied user id (§4/§5).
 */
export const registerTeamForEvent = async ({ userId, eventId, teamName, teamSize, memberEmails }) => {
  assertObjectId(eventId, 'event id');
  const event = await Event.findOne({ _id: eventId, ...NOT_DELETED });
  if (!event || event.status === EVENT_STATUSES.DRAFT) throw ApiError.notFound('Event not found.');

  if (event.registrationType !== EVENT_REGISTRATION_TYPES.TEAM) {
    throw ApiError.conflict('This event uses individual registration, not team registration.');
  }

  const { registrable, reason } = evaluateRegistrability(event);
  if (!registrable) throw ApiError.conflict(reason);

  const name = String(teamName || '').trim();
  if (name.length < 2 || name.length > 120) {
    throw throwFieldError('teamName', 'Team name must be between 2 and 120 characters.');
  }

  const size = Number(teamSize);
  if (!Number.isInteger(size) || size < 2) {
    throw throwFieldError('teamSize', 'Team size must be a whole number of at least 2.');
  }
  if (event.maxTeamSize != null && size > event.maxTeamSize) {
    throw throwFieldError('teamSize', `Team size cannot exceed the maximum of ${event.maxTeamSize} for this event.`);
  }

  const rawEmails = Array.isArray(memberEmails) ? memberEmails : [];
  const normalisedEmails = rawEmails.map((e) => String(e || '').trim().toLowerCase()).filter((e) => e.length > 0);

  if (new Set(normalisedEmails).size !== normalisedEmails.length) {
    throw throwFieldError('members', 'Duplicate team members are not allowed.');
  }

  const leaderUserDoc = await User.findById(userId);
  if (!leaderUserDoc) throw ApiError.notFound('Your account could not be found.');

  if (normalisedEmails.includes(leaderUserDoc.email)) {
    throw throwFieldError('members', 'You are already the team leader — do not add yourself as a member too.');
  }

  if (normalisedEmails.length !== size - 1) {
    throw throwFieldError(
      'members',
      `This team needs exactly ${size - 1} member(s) in addition to the leader (received ${normalisedEmails.length}).`,
    );
  }

  const memberUsers = normalisedEmails.length
    ? await User.find({ email: { $in: normalisedEmails }, role: ROLES.USER, status: USER_STATUS.ACTIVE })
    : [];
  const byEmail = new Map(memberUsers.map((u) => [u.email, u]));
  const missing = normalisedEmails.filter((e) => !byEmail.has(e));
  if (missing.length > 0) {
    throw throwFieldError(
      'members',
      `These members could not be found or are not eligible to register: ${missing.join(', ')}.`,
    );
  }

  const allMembers = [leaderUserDoc, ...normalisedEmails.map((e) => byEmail.get(e))];

  // No member — leader included — may already hold an active registration for
  // this event, individually or via another team (§5).
  const existingActive = await Registration.find({
    event: eventId,
    user: { $in: allMembers.map((u) => u._id) },
    status: 'REGISTERED',
  }).populate('user', 'name');
  if (existingActive.length > 0) {
    const names = existingActive.map((r) => r.user?.name ?? 'A member').join(', ');
    throw ApiError.conflict(`Already registered for this event: ${names}.`);
  }

  if (event.maxParticipants != null) {
    const registeredCount = await Registration.countDocuments({ event: eventId, status: 'REGISTERED' });
    if (registeredCount + size > event.maxParticipants) {
      const spotsLeft = Math.max(0, event.maxParticipants - registeredCount);
      throw ApiError.conflict(`This event only has ${spotsLeft} spot(s) left — not enough for a team of ${size}.`);
    }
  }

  const teamId = await generateTeamId();
  const team = await Team.create({ teamId, event: eventId, name, leader: userId, size });

  const createdRegistrationIds = [];
  try {
    for (const member of allMembers) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await Registration.findOne({ user: member._id, event: eventId });
      let registration;
      if (existing) {
        existing.status = 'REGISTERED';
        existing.registeredAt = new Date();
        existing.cancelledAt = null;
        existing.qrNonce = issueQrNonce();
        existing.team = team._id;
        // eslint-disable-next-line no-await-in-loop
        registration = await existing.save();
      } else {
        // eslint-disable-next-line no-await-in-loop
        registration = await Registration.create({
          user: member._id,
          event: eventId,
          qrNonce: issueQrNonce(),
          team: team._id,
        });
      }
      createdRegistrationIds.push(registration._id);
    }
  } catch (err) {
    // No multi-document transactions on this (standalone) MongoDB — a
    // mid-loop failure is rolled back by hand rather than left half-created.
    await Registration.deleteMany({ _id: { $in: createdRegistrationIds } }).catch(() => {});
    await Team.findByIdAndDelete(team._id).catch(() => {});
    if (err && err.code === 11000) {
      throw ApiError.conflict('One of these members is already registered for this event.');
    }
    throw err;
  }

  const registeredCount = await Registration.countDocuments({ event: eventId, status: 'REGISTERED' });
  await event.populate('organiser', 'name');

  allMembers.forEach((member) => {
    notifyRegistrationConfirmed({ userId: member._id, eventId, eventTitle: event.title }).catch(() => {});
  });

  return {
    team: {
      id: String(team._id),
      teamId: team.teamId,
      name: team.name,
      status: team.status,
      size: team.size,
      leader: { id: String(leaderUserDoc._id), name: leaderUserDoc.name, email: leaderUserDoc.email },
      members: allMembers.map((m) => ({
        id: String(m._id),
        name: m.name,
        email: m.email,
        isLeader: String(m._id) === String(leaderUserDoc._id),
      })),
    },
    event: toParticipantEvent(event, { registeredCount }),
  };
};

/**
 * PATCH /api/registrations/teams/:teamId/cancel — the team LEADER cancels the
 * whole team (every member's Registration row). A non-leader member who wants
 * to leave the team uses the existing per-registration cancel endpoint on
 * their own row — no new capability is needed for that case.
 */
export const cancelTeamRegistration = async ({ userId, teamId }) => {
  const team = await Team.findOne({ teamId: String(teamId || '').toUpperCase().trim() }).populate(
    'event',
    'title status',
  );
  if (!team) throw ApiError.notFound('Team not found.');

  if (String(team.leader) !== String(userId)) {
    throw ApiError.forbidden('Only the team leader can cancel the team registration.');
  }
  if (team.status === 'CANCELLED') {
    throw ApiError.conflict('This team registration is already cancelled.');
  }
  const evStatus = team.event ? team.event.status : null;
  if (evStatus === EVENT_STATUSES.COMPLETED || evStatus === EVENT_STATUSES.CANCELLED) {
    throw ApiError.conflict('This event is completed or cancelled — the registration can no longer be changed.');
  }

  team.status = 'CANCELLED';
  team.cancelledAt = new Date();
  await team.save();

  const members = await Registration.find({ team: team._id, status: 'REGISTERED' });
  await Promise.all(
    members.map((reg) => {
      reg.status = 'CANCELLED';
      reg.cancelledAt = new Date();
      reg.qrNonce = issueQrNonce();
      return reg.save();
    }),
  );

  return {
    team: {
      id: String(team._id),
      teamId: team.teamId,
      status: team.status,
      cancelledAt: team.cancelledAt,
      event: team.event ? { id: String(team.event._id), title: team.event.title, status: team.event.status } : null,
    },
  };
};

/** GET /api/registrations/mine — the caller's own registrations, newest first. */
export const listMyRegistrations = async ({ userId, status }) => {
  const filter = { user: userId };
  if (status) {
    const s = String(status).trim().toUpperCase();
    if (!['REGISTERED', 'CANCELLED'].includes(s)) throw ApiError.badRequest('Invalid registration status.');
    filter.status = s;
  }

  const docs = await Registration.find(filter)
    .sort({ registeredAt: -1, createdAt: -1 })
    .populate('event', 'title category startDate endDate venue status isDeleted')
    .lean();

  const usable = docs.filter((r) => r.event); // guard against a hard-deleted event ref (shouldn't happen — events are soft-deleted)
  const attendanceMap = await attendanceByRegistrationForUser(
    userId,
    usable.map((r) => r._id),
  );

  // Team info (Phase 14) — batch-loaded once for every distinct team the
  // caller belongs to, rather than a query per row.
  const teamIds = [...new Set(usable.filter((r) => r.team).map((r) => String(r.team)))];
  const teamInfoById = new Map();
  if (teamIds.length > 0) {
    const [teamDocs, teamMemberRegs] = await Promise.all([
      Team.find({ _id: { $in: teamIds } }).lean(),
      Registration.find({ team: { $in: teamIds } }).populate('user', 'name email').lean(),
    ]);
    const membersByTeam = new Map();
    for (const reg of teamMemberRegs) {
      const key = String(reg.team);
      if (!membersByTeam.has(key)) membersByTeam.set(key, []);
      membersByTeam.get(key).push(reg);
    }
    for (const t of teamDocs) {
      teamInfoById.set(String(t._id), {
        id: String(t._id),
        teamId: t.teamId,
        name: t.name,
        status: t.status,
        size: t.size,
        isLeader: String(t.leader) === String(userId),
        members: (membersByTeam.get(String(t._id)) || []).map((m) => ({
          id: m.user ? String(m.user._id) : null,
          name: m.user?.name ?? 'Unknown participant',
          email: m.user?.email ?? null,
          isLeader: m.user ? String(m.user._id) === String(t.leader) : false,
          registrationStatus: m.status,
        })),
      });
    }
  }

  return {
    registrations: usable.map((r) => ({
      id: String(r._id),
      status: r.status,
      registeredAt: r.registeredAt,
      cancelledAt: r.cancelledAt,
      attendance: attendanceMap.get(String(r._id)) ?? null,
      team: r.team ? teamInfoById.get(String(r.team)) ?? null : null,
      event: {
        id: String(r.event._id),
        title: r.event.title,
        category: r.event.category,
        startDate: r.event.startDate,
        endDate: r.event.endDate,
        venue: r.event.venue,
        status: r.event.status,
        isDeleted: Boolean(r.event.isDeleted),
      },
    })),
  };
};

/** PATCH /api/registrations/:id/cancel — cancel the caller's own registration. */
export const cancelRegistration = async ({ userId, registrationId }) => {
  assertObjectId(registrationId, 'registration id');
  const registration = await Registration.findById(registrationId).populate('event', 'title status');
  if (!registration) throw ApiError.notFound('Registration not found.');

  if (String(registration.user) !== String(userId)) {
    throw ApiError.forbidden('You can only cancel your own registration.');
  }
  if (registration.status === 'CANCELLED') {
    throw ApiError.conflict('This registration is already cancelled.');
  }
  const evStatus = registration.event ? registration.event.status : null;
  if (evStatus === EVENT_STATUSES.COMPLETED || evStatus === EVENT_STATUSES.CANCELLED) {
    throw ApiError.conflict('This event is completed or cancelled — the registration can no longer be changed.');
  }

  registration.status = 'CANCELLED';
  registration.cancelledAt = new Date();
  // Rotate the QR nonce so the participant's old attendance QR stops verifying.
  registration.qrNonce = issueQrNonce();
  await registration.save();

  return {
    registration: {
      id: registration._id.toString(),
      status: registration.status,
      cancelledAt: registration.cancelledAt,
      event: registration.event
        ? { id: String(registration.event._id), title: registration.event.title, status: registration.event.status }
        : null,
    },
  };
};

/**
 * GET /api/events/:id/registrations — participants for an event the caller
 * owns. `type` optionally filters to 'individual' | 'team' (Phase 14).
 */
export const listEventRegistrationsForOrganiser = async ({ organiserId, eventId, type }) => {
  const event = await loadOwnedEvent(eventId, organiserId); // 400 bad id / 404 missing / 403 not owner

  const docs = await Registration.find({ event: eventId })
    .sort({ registeredAt: -1 })
    .populate('user', 'name email')
    .lean();

  const teamIds = [...new Set(docs.filter((r) => r.team).map((r) => String(r.team)))];
  const teamById = new Map();
  if (teamIds.length > 0) {
    const teamDocs = await Team.find({ _id: { $in: teamIds } }).populate('leader', 'name email').lean();
    for (const t of teamDocs) teamById.set(String(t._id), t);
  }

  const registered = docs.filter((r) => r.status === 'REGISTERED').length;
  const cancelled = docs.filter((r) => r.status === 'CANCELLED').length;

  let rows = docs.map((r) => {
    const team = r.team ? teamById.get(String(r.team)) : null;
    const leaderId = team ? (team.leader?._id ?? team.leader) : null;
    return {
      id: String(r._id),
      participant: r.user
        ? { name: r.user.name, email: r.user.email }
        : { name: 'Unknown participant', email: null },
      status: r.status,
      registeredAt: r.registeredAt,
      cancelledAt: r.cancelledAt,
      team: team
        ? {
            id: String(team._id),
            teamId: team.teamId,
            name: team.name,
            status: team.status,
            leaderName: team.leader?.name ?? null,
            isLeader: r.user ? String(r.user._id) === String(leaderId) : false,
          }
        : null,
    };
  });

  const typeFilter = String(type || 'all').toLowerCase();
  if (typeFilter === 'team') rows = rows.filter((r) => r.team);
  else if (typeFilter === 'individual') rows = rows.filter((r) => !r.team);

  const teamsSummary = [...teamById.values()].map((t) => ({
    id: String(t._id),
    teamId: t.teamId,
    name: t.name,
    status: t.status,
    size: t.size,
    leaderName: t.leader?.name ?? null,
  }));

  return {
    event: {
      id: String(event._id),
      title: event.title,
      status: event.status,
      registrationType: event.registrationType,
      maxParticipants: event.maxParticipants ?? null,
    },
    summary: {
      registered,
      cancelled,
      total: docs.length,
      capacity: event.maxParticipants ?? null,
      spotsLeft: event.maxParticipants == null ? null : Math.max(0, event.maxParticipants - registered),
      teams: teamsSummary.length,
    },
    teams: teamsSummary,
    registrations: rows,
  };
};
