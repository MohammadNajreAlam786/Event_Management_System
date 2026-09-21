import mongoose from 'mongoose';

import Attendance from '../models/attendance.model.js';
import Registration from '../models/registration.model.js';
import Team from '../models/team.model.js';
import { EVENT_STATUSES } from '../models/event.model.js';
import { ApiError } from '../utils/apiError.js';
import { loadOwnedEvent } from './event.service.js';
import { loadEventForAnalytics } from './analytics.service.js';
import { notifyAttendanceRecorded } from './notification.service.js';
import { syncEventStatuses } from './eventStatusTransition.service.js';
import {
  issueQrNonce,
  signAttendanceToken,
  buildQrPayload,
  verifyAttendanceToken,
  extractCredential,
} from '../utils/qrToken.js';

/**
 * QR attendance domain logic (Phase 7).
 *
 * Flow: a participant's active Registration → a signed QR credential (this
 * module builds it) → an organiser scans it → verified against the same
 * registration → an Attendance row is created.
 *
 * Event-status rule for check-in (Phase 13): attendance is only recorded
 * while the event is exactly ONGOING. DRAFT / PLANNED / UPCOMING (too early),
 * COMPLETED (over) and CANCELLED are all rejected. There is NO wall-clock
 * window check beyond that: timing is governed by the (now auto-transitioning
 * — see eventStatusTransition.service.js) event status, which keeps testing
 * unblocked and avoids timezone guesswork. This is a deliberate tightening
 * from the original Phase 7 rule (which also allowed UPCOMING) — the frontend
 * scanner must never be reachable before an event is actually in progress,
 * and the backend independently enforces the same rule so hiding the button
 * on the client is not the only protection.
 */

const ATTENDANCE_OPEN_STATUSES = [EVENT_STATUSES.ONGOING];

/** Sentinel thrown when a QR is scanned for a participant who is already present. */
export const ALREADY_CHECKED_IN = 'ALREADY_CHECKED_IN';

const assertObjectId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest(`Invalid ${label}.`);
};

/**
 * GET /api/registrations/:registrationId/qr — the caller's own attendance QR.
 * Only the authenticated owner, only for an ACTIVE registration on a live event.
 */
export const getMyQr = async ({ userId, registrationId }) => {
  assertObjectId(registrationId, 'registration id');

  const registration = await Registration.findById(registrationId)
    .select('+qrNonce')
    .populate('event', 'title startDate endDate venue status isDeleted');
  if (!registration) throw ApiError.notFound('Registration not found.');

  if (String(registration.user) !== String(userId)) {
    throw ApiError.forbidden('You can only view your own attendance QR.');
  }
  if (registration.status !== 'REGISTERED') {
    throw ApiError.conflict('This registration is no longer active, so no attendance QR is available.');
  }
  const event = registration.event;
  if (!event || event.isDeleted || event.status === EVENT_STATUSES.CANCELLED) {
    throw ApiError.conflict('This event is no longer available, so no attendance QR is available.');
  }

  // Lazily issue a nonce for registrations created before Phase 7.
  if (!registration.qrNonce) {
    registration.qrNonce = issueQrNonce();
    await registration.save();
  }

  const credential = signAttendanceToken({
    registrationId: registration._id,
    eventId: event._id,
    nonce: registration.qrNonce,
  });

  const attendance = await Attendance.findOne({ registration: registration._id }).lean();

  return {
    registration: {
      id: String(registration._id),
      status: registration.status,
      registeredAt: registration.registeredAt,
    },
    event: {
      title: event.title,
      venue: event.venue,
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status,
    },
    qr: {
      credential,
      payload: buildQrPayload(credential),
    },
    attendance: attendance
      ? { status: attendance.status, checkedInAt: attendance.checkedInAt }
      : null,
  };
};

/**
 * POST /api/events/:eventId/attendance/check-in — organiser verifies a scanned
 * credential and records attendance for one of THEIR events.
 *
 * Verifies, in order (§24): event ownership, event status, credential signature,
 * event match, nonce (not rotated), registration active, no existing check-in.
 * Only then is an Attendance row created — atomically, so concurrent scans of
 * the same QR still yield exactly one row (§45).
 */
export const checkInByCredential = async ({ organiserId, eventId, credential }) => {
  await syncEventStatuses();
  const event = await loadOwnedEvent(eventId, organiserId); // 400 bad id / 404 missing / 403 not owner

  if (!ATTENDANCE_OPEN_STATUSES.includes(event.status)) {
    throw ApiError.conflict('Attendance is available only while the event is ongoing.');
  }

  let decoded;
  try {
    decoded = verifyAttendanceToken(extractCredential(credential));
  } catch {
    throw new ApiError(422, 'This QR code could not be read. Ask the participant to reopen their attendance QR.');
  }

  if (String(decoded.eid) !== String(eventId)) {
    throw new ApiError(422, 'This QR code is not valid for this event.');
  }

  const registration = await Registration.findById(decoded.rid)
    .select('+qrNonce')
    .populate('user', 'name email')
    .populate('event', 'title status');
  if (!registration) {
    throw new ApiError(422, 'This QR code is not valid.');
  }
  if (String(registration.event?._id) !== String(eventId)) {
    throw new ApiError(422, 'This QR code is not valid for this event.');
  }
  if (!registration.qrNonce || registration.qrNonce !== decoded.nonce) {
    throw new ApiError(422, 'This QR code is no longer valid. Ask the participant to reopen their attendance QR.');
  }
  if (registration.status !== 'REGISTERED') {
    throw ApiError.conflict('This registration is no longer active.');
  }

  let attendance;
  try {
    attendance = await Attendance.create({
      registration: registration._id,
      event: event._id,
      user: registration.user._id,
      checkedInBy: organiserId,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const existing = await Attendance.findOne({ registration: registration._id }).lean();
      throw Object.assign(ApiError.conflict('Participant is already marked present.'), {
        code: ALREADY_CHECKED_IN,
        payload: {
          alreadyCheckedIn: true,
          participant: { name: registration.user.name },
          event: { id: String(event._id), title: registration.event.title },
          attendance: existing
            ? { status: existing.status, checkedInAt: existing.checkedInAt }
            : null,
        },
      });
    }
    throw err;
  }

  // Side effect (Phase 8) — never blocks or breaks check-in. A repeat scan hits
  // the E11000 branch above and never reaches here, so no duplicate notification.
  notifyAttendanceRecorded({
    userId: registration.user._id,
    eventId: event._id,
    eventTitle: registration.event.title,
  }).catch(() => {});

  return {
    attendance: { status: attendance.status, checkedInAt: attendance.checkedInAt },
    participant: { name: registration.user.name },
    event: { id: String(event._id), title: registration.event.title },
  };
};

/** Load every registration + its attendance for an owned event. Shared by list + summary. */
const gatherEventAttendance = async (eventId) => {
  const [registrations, attendances] = await Promise.all([
    Registration.find({ event: eventId }).populate('user', 'name email').sort({ registeredAt: -1 }).lean(),
    Attendance.find({ event: eventId }).sort({ checkedInAt: -1 }).lean(),
  ]);
  const attByReg = new Map(attendances.map((a) => [String(a.registration), a]));
  return { registrations, attendances, attByReg };
};

/**
 * Attendance summary for an owned event (§17/§34/§35).
 *
 * Percentage = present / active-registered × 100, where:
 *   active-registered = registrations currently in status REGISTERED
 *   present           = check-ins whose registration is still REGISTERED
 * Cancelled registrations count toward neither. A participant who checked in
 * and then cancelled is not counted (documented edge case).
 */
export const getEventAttendanceSummary = async ({ organiserId, eventId }) => {
  await syncEventStatuses();
  const event = await loadOwnedEvent(eventId, organiserId);
  const { registrations, attByReg } = await gatherEventAttendance(eventId);

  const activeRegIds = new Set(
    registrations.filter((r) => r.status === 'REGISTERED').map((r) => String(r._id)),
  );
  const cancelled = registrations.length - activeRegIds.size;
  const registered = activeRegIds.size;
  let present = 0;
  for (const regId of activeRegIds) if (attByReg.has(regId)) present += 1;
  const notCheckedIn = Math.max(0, registered - present);
  const attendancePercentage = registered > 0 ? Math.round((present / registered) * 100) : 0;

  return {
    event: { id: String(event._id), title: event.title, status: event.status },
    summary: { registered, present, notCheckedIn, cancelled, attendancePercentage },
  };
};

/**
 * Attendance list for an owned event (§31/§32/§33): one row per registration
 * with its attendance state, optional status filter + name/email search.
 */
export const listEventAttendance = async ({ organiserId, eventId, status, search }) => {
  await syncEventStatuses();
  const event = await loadOwnedEvent(eventId, organiserId);
  const { registrations, attByReg, attendances } = await gatherEventAttendance(eventId);

  const filter = String(status || 'all').toLowerCase();
  const validFilters = ['all', 'present', 'not_checked_in', 'cancelled'];
  if (!validFilters.includes(filter)) throw ApiError.badRequest('Invalid attendance filter.');

  const term = String(search || '').trim().toLowerCase();

  let rows = registrations.map((r) => {
    const att = attByReg.get(String(r._id)) || null;
    return {
      registrationId: String(r._id),
      participant: r.user
        ? { name: r.user.name, email: r.user.email }
        : { name: 'Unknown participant', email: null },
      registrationStatus: r.status,
      attendance: att ? { status: att.status, checkedInAt: att.checkedInAt } : null,
    };
  });

  if (term) {
    rows = rows.filter(
      (row) =>
        row.participant.name.toLowerCase().includes(term) ||
        (row.participant.email || '').toLowerCase().includes(term),
    );
  }
  if (filter === 'present') rows = rows.filter((row) => row.attendance);
  else if (filter === 'not_checked_in') {
    rows = rows.filter((row) => row.registrationStatus === 'REGISTERED' && !row.attendance);
  } else if (filter === 'cancelled') rows = rows.filter((row) => row.registrationStatus === 'CANCELLED');

  const activeRegIds = new Set(
    registrations.filter((r) => r.status === 'REGISTERED').map((r) => String(r._id)),
  );
  const registered = activeRegIds.size;
  let present = 0;
  for (const regId of activeRegIds) if (attByReg.has(regId)) present += 1;

  const recentCheckIns = attendances
    .slice(0, 8)
    .map((a) => {
      const reg = registrations.find((r) => String(r._id) === String(a.registration));
      return {
        name: reg?.user?.name ?? 'Participant',
        checkedInAt: a.checkedInAt,
      };
    });

  return {
    event: { id: String(event._id), title: event.title, status: event.status },
    summary: {
      registered,
      present,
      notCheckedIn: Math.max(0, registered - present),
      cancelled: registrations.length - registered,
      attendancePercentage: registered > 0 ? Math.round((present / registered) * 100) : 0,
    },
    filter,
    rows,
    recentCheckIns,
  };
};

/** Attendance rows for the authenticated participant, keyed by registration id. */
export const attendanceByRegistrationForUser = async (userId, registrationIds) => {
  if (!registrationIds.length) return new Map();
  const rows = await Attendance.find({
    user: userId,
    registration: { $in: registrationIds },
  }).lean();
  return new Map(rows.map((a) => [String(a.registration), { status: a.status, checkedInAt: a.checkedInAt }]));
};

const NOT_CHECKED_IN = 'NOT_CHECKED_IN';

/** One CSV field, quoted only when it needs to be (contains a comma, quote or newline). */
const csvField = (value) => {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * GET /api/events/:id/attendance/export — CSV attendance sheet for an event
 * (Phase 14). Reuses `loadEventForAnalytics` for access control: ADMIN → any
 * event; ORGANISER → owned events only (400 bad id / 404 missing / 403 denied).
 * Built entirely from Registration/Attendance/Team — never from whatever rows
 * happen to be visible in the frontend table.
 */
export const getEventAttendanceExport = async ({ actor, eventId }) => {
  await syncEventStatuses();
  const event = await loadEventForAnalytics({ actor, eventId });

  const [registrations, attendances, teams] = await Promise.all([
    Registration.find({ event: eventId }).populate('user', 'name email').sort({ registeredAt: 1 }).lean(),
    Attendance.find({ event: eventId }).lean(),
    Team.find({ event: eventId }).populate('leader', 'name').lean(),
  ]);
  const attByReg = new Map(attendances.map((a) => [String(a.registration), a]));
  const teamById = new Map(teams.map((t) => [String(t._id), t]));

  const header = [
    'Event Name',
    'Event Date',
    'Registration ID',
    'Participant Name',
    'Participant Email',
    'Team ID',
    'Team Name',
    'Team Leader',
    'Registration Status',
    'Attendance Status',
    'Check-in Time',
  ];

  const lines = [header.map(csvField).join(',')];
  for (const r of registrations) {
    const attendance = attByReg.get(String(r._id)) || null;
    const team = r.team ? teamById.get(String(r.team)) : null;
    lines.push(
      [
        event.title,
        event.startDate ? new Date(event.startDate).toISOString() : '',
        String(r._id),
        r.user?.name ?? 'Unknown participant',
        r.user?.email ?? '',
        team?.teamId ?? '',
        team?.name ?? '',
        team?.leader?.name ?? '',
        r.status,
        attendance ? attendance.status : NOT_CHECKED_IN,
        attendance ? new Date(attendance.checkedInAt).toISOString() : '',
      ]
        .map(csvField)
        .join(','),
    );
  }

  return { csv: lines.join('\r\n'), event: { id: String(event._id), title: event.title } };
};
