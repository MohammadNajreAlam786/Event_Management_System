import mongoose from 'mongoose';

import Event, {
  EVENT_STATUSES,
  EVENT_REGISTRATION_TYPES,
  ACTIVE_EVENT_STATUSES,
} from '../models/event.model.js';
import { ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  validateEventData,
  isValidEventStatus,
  pickEditableEventFields,
} from '../utils/eventValidators.js';
import {
  notifyEventCancelled,
  notifyEventUpdated,
  notifyFeedbackAvailable,
} from './notification.service.js';
import { syncEventStatuses } from './eventStatusTransition.service.js';

const CANCELLED = EVENT_STATUSES.CANCELLED;
const COMPLETED = EVENT_STATUSES.COMPLETED;

/** Format a Date for the EVENT_UPDATED notification summary. */
const shortDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Event domain logic — creation, ownership-scoped reads/updates/deletes,
 * status changes, organiser dashboard roll-ups, and the admin-oversight
 * queries. Every read filters out soft-deleted events.
 */

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const ORGANISER_FIELDS = 'name email';
const NOT_DELETED = { isDeleted: { $ne: true } };

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clampPage = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
};
const clampLimit = (v) => {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
};

const assertObjectId = (id, label = 'event id') => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest(`Invalid ${label}.`);
};

/** Throw the field-error 400 the frontend expects. */
const throwValidation = (errors) =>
  Object.assign(ApiError.badRequest('Please correct the highlighted fields.'), { errors });

/**
 * Normalise the team-registration fields (Phase 14) after validation: an
 * INDIVIDUAL event never carries a stray `maxTeamSize` (§3 — "Individual
 * events must not require team information"), and a TEAM event always stores
 * a real number.
 */
const normaliseTeamFields = (data) => {
  const registrationType = String(data.registrationType || EVENT_REGISTRATION_TYPES.INDIVIDUAL).toUpperCase();
  if (registrationType !== EVENT_REGISTRATION_TYPES.TEAM) {
    return { registrationType: EVENT_REGISTRATION_TYPES.INDIVIDUAL, maxTeamSize: null };
  }
  return { registrationType, maxTeamSize: Number(data.maxTeamSize) };
};

/**
 * Create a new event. `organiserId` comes from the authenticated session —
 * any `organiser` in the request body is ignored. Status is always DRAFT.
 */
export const createEvent = async ({ organiserId, body }) => {
  const data = pickEditableEventFields(body);

  const { valid, errors } = validateEventData(data);
  if (!valid) throw throwValidation(errors);

  const event = await Event.create({
    ...data,
    maxParticipants:
      data.maxParticipants === '' || data.maxParticipants === undefined
        ? null
        : Number(data.maxParticipants),
    ...normaliseTeamFields(data),
    organiser: organiserId, // authoritative — never from the client
    status: EVENT_STATUSES.DRAFT,
  });

  await event.populate('organiser', ORGANISER_FIELDS);
  return event.toPublicObject();
};

/**
 * List the authenticated organiser's own events (soft-deleted excluded),
 * with optional title search + status filter, newest start date first.
 */
export const listOrganiserEvents = async ({ organiserId, search, status, page, limit }) => {
  await syncEventStatuses();
  const filter = { ...NOT_DELETED, organiser: organiserId };
  if (status) filter.status = status;
  if (search && search.trim()) {
    filter.title = new RegExp(escapeRegExp(search.trim()), 'i');
  }

  const pageNum = clampPage(page);
  const limitNum = clampLimit(limit);

  const [docs, totalEvents] = await Promise.all([
    Event.find(filter)
      .sort({ startDate: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('organiser', ORGANISER_FIELDS),
    Event.countDocuments(filter),
  ]);

  return {
    events: docs.map((d) => d.toPublicObject()),
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalEvents,
      totalPages: Math.max(1, Math.ceil(totalEvents / limitNum)),
    },
  };
};

/**
 * Load a single event with access control:
 *  - ADMIN: any event (oversight)
 *  - ORGANISER: only their own
 */
export const getEventForActor = async ({ eventId, actor }) => {
  assertObjectId(eventId);
  await syncEventStatuses();
  const event = await Event.findOne({ _id: eventId, ...NOT_DELETED }).populate(
    'organiser',
    ORGANISER_FIELDS,
  );
  if (!event) throw ApiError.notFound('Event not found.');

  const ownerId = event.organiser?._id ? event.organiser._id.toString() : String(event.organiser);
  if (actor.role === ROLES.ADMIN || (actor.role === ROLES.ORGANISER && ownerId === String(actor.id))) {
    return event.toPublicObject();
  }
  throw ApiError.forbidden('You do not have access to this event.');
};

/**
 * Load a non-deleted event owned by `organiserId`, or throw (400 bad id /
 * 404 not found / 403 not owner). Shared by every organiser-scoped and
 * planning-scoped operation so ownership is checked in exactly one place.
 */
export const loadOwnedEvent = async (eventId, organiserId) => {
  assertObjectId(eventId);
  const event = await Event.findOne({ _id: eventId, ...NOT_DELETED });
  if (!event) throw ApiError.notFound('Event not found.');
  if (String(event.organiser) !== String(organiserId)) {
    throw ApiError.forbidden('You can only manage your own events.');
  }
  return event;
};

/**
 * Update editable content of an owned event. `organiser` and `status` in the
 * body are ignored — ownership never changes here, and status has its own
 * endpoint. All fields are revalidated against the merged result.
 */
export const updateEvent = async ({ eventId, organiserId, body }) => {
  const event = await loadOwnedEvent(eventId, organiserId);
  const updates = pickEditableEventFields(body);

  const merged = {
    title: event.title,
    description: event.description,
    category: event.category,
    venue: event.venue,
    startDate: event.startDate,
    endDate: event.endDate,
    registrationStartDate: event.registrationStartDate,
    registrationEndDate: event.registrationEndDate,
    maxParticipants: event.maxParticipants,
    image: event.image,
    registrationType: event.registrationType,
    maxTeamSize: event.maxTeamSize,
    ...updates,
  };

  const { valid, errors } = validateEventData(merged);
  if (!valid) throw throwValidation(errors);
  const team = normaliseTeamFields(merged);

  // Capture the fields that matter to a registered participant, to decide
  // afterwards whether an EVENT_UPDATED notification is warranted (§41 — only
  // for meaningful changes, not every edit).
  const before = {
    venue: event.venue,
    startDate: event.startDate ? new Date(event.startDate).getTime() : null,
    endDate: event.endDate ? new Date(event.endDate).getTime() : null,
  };

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'maxParticipants') {
      event.maxParticipants = value === '' || value === null ? null : Number(value);
    } else if (key === 'registrationType' || key === 'maxTeamSize') {
      // Handled together below so switching back to INDIVIDUAL always clears
      // a stale maxTeamSize, even if the caller only sent one of the two.
    } else {
      event[key] = value;
    }
  }
  event.registrationType = team.registrationType;
  event.maxTeamSize = team.maxTeamSize;
  await event.save();
  await event.populate('organiser', ORGANISER_FIELDS);

  const changed = [];
  if (event.venue !== before.venue) changed.push(`new venue ${event.venue}`);
  const newStart = event.startDate ? new Date(event.startDate).getTime() : null;
  const newEnd = event.endDate ? new Date(event.endDate).getTime() : null;
  if (newStart !== before.startDate || newEnd !== before.endDate) changed.push(`new date ${shortDate(event.startDate)}`);
  if (changed.length && (event.status === EVENT_STATUSES.PLANNED || event.status === EVENT_STATUSES.UPCOMING || event.status === EVENT_STATUSES.ONGOING)) {
    notifyEventUpdated({ eventId: event._id, eventTitle: event.title, summary: changed.join('; ') }).catch(() => {});
  }

  return event.toPublicObject();
};

/**
 * Change the status of an owned event (organiser-driven). Manual transitions
 * only — any valid enum value is accepted.
 */
export const updateEventStatusByOwner = async ({ eventId, organiserId, status }) => {
  if (!isValidEventStatus(status)) {
    throw ApiError.badRequest(`"${status}" is not a valid event status.`);
  }
  const event = await loadOwnedEvent(eventId, organiserId);
  const previousStatus = event.status;
  event.status = String(status).toUpperCase();
  await event.save();
  await event.populate('organiser', ORGANISER_FIELDS);

  if (event.status === CANCELLED && previousStatus !== CANCELLED) {
    notifyEventCancelled({ eventId: event._id, eventTitle: event.title }).catch(() => {});
  }
  // Phase 9 — a completed event opens feedback for participants who attended.
  if (event.status === COMPLETED && previousStatus !== COMPLETED) {
    notifyFeedbackAvailable({ eventId: event._id, eventTitle: event.title }).catch(() => {});
  }
  return event.toPublicObject();
};

/** Soft-delete an owned event. */
export const deleteEvent = async ({ eventId, organiserId }) => {
  const event = await loadOwnedEvent(eventId, organiserId);
  event.isDeleted = true;
  event.deletedAt = new Date();
  await event.save();
  return { id: event._id.toString() };
};

/** Per-status counts for the authenticated organiser's dashboard. */
export const getOrganiserDashboardStats = async ({ organiserId }) => {
  await syncEventStatuses();
  const rows = await Event.aggregate([
    { $match: { organiser: new mongoose.Types.ObjectId(String(organiserId)), isDeleted: { $ne: true } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const get = (s) => byStatus[s] ?? 0;

  return {
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    draft: get(EVENT_STATUSES.DRAFT),
    planned: get(EVENT_STATUSES.PLANNED),
    upcoming: get(EVENT_STATUSES.UPCOMING),
    ongoing: get(EVENT_STATUSES.ONGOING),
    completed: get(EVENT_STATUSES.COMPLETED),
    cancelled: get(EVENT_STATUSES.CANCELLED),
  };
};

// ---------------------------------------------------------------------------
// Admin oversight
// ---------------------------------------------------------------------------

/**
 * All events (any organiser, soft-deleted excluded) for admin oversight,
 * with search (title/venue) + status filter + pagination. Organiser is
 * returned only as { id, name, email }.
 */
export const listAllEventsForAdmin = async ({ search, status, page, limit }) => {
  await syncEventStatuses();
  const filter = { ...NOT_DELETED };
  if (status) filter.status = status;
  if (search && search.trim()) {
    const pattern = new RegExp(escapeRegExp(search.trim()), 'i');
    filter.$or = [{ title: pattern }, { venue: pattern }];
  }

  const pageNum = clampPage(page);
  const limitNum = clampLimit(limit);

  const [docs, totalEvents] = await Promise.all([
    Event.find(filter)
      .sort({ startDate: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('organiser', ORGANISER_FIELDS),
    Event.countDocuments(filter),
  ]);

  return {
    events: docs.map((d) => d.toPublicObject()),
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalEvents,
      totalPages: Math.max(1, Math.ceil(totalEvents / limitNum)),
    },
  };
};

/** Admin sets an event's status (e.g. an administrative CANCELLED). No ownership check. */
export const updateEventStatusByAdmin = async ({ eventId, status }) => {
  if (!isValidEventStatus(status)) {
    throw ApiError.badRequest(`"${status}" is not a valid event status.`);
  }
  assertObjectId(eventId);
  const event = await Event.findOne({ _id: eventId, ...NOT_DELETED });
  if (!event) throw ApiError.notFound('Event not found.');
  const previousStatus = event.status;
  event.status = String(status).toUpperCase();
  await event.save();
  await event.populate('organiser', ORGANISER_FIELDS);

  if (event.status === CANCELLED && previousStatus !== CANCELLED) {
    notifyEventCancelled({ eventId: event._id, eventTitle: event.title }).catch(() => {});
  }
  if (event.status === COMPLETED && previousStatus !== COMPLETED) {
    notifyFeedbackAvailable({ eventId: event._id, eventTitle: event.title }).catch(() => {});
  }
  return event.toPublicObject();
};

/** Event roll-ups for the Admin dashboard cards (real, from the Event collection). */
export const getAdminEventCounts = async () => {
  await syncEventStatuses();
  const [totalEvents, activeEvents, completedEvents, cancelledEvents] = await Promise.all([
    Event.countDocuments({ ...NOT_DELETED }),
    Event.countDocuments({ ...NOT_DELETED, status: { $in: ACTIVE_EVENT_STATUSES } }),
    Event.countDocuments({ ...NOT_DELETED, status: EVENT_STATUSES.COMPLETED }),
    Event.countDocuments({ ...NOT_DELETED, status: EVENT_STATUSES.CANCELLED }),
  ]);
  return { totalEvents, activeEvents, completedEvents, cancelledEvents };
};
