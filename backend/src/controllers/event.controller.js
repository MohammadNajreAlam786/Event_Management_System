import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { isValidEventStatus } from '../utils/eventValidators.js';
import * as eventService from '../services/event.service.js';

/** Normalise an optional `status` query/body value, or throw 400. */
const normaliseStatus = (raw) => {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (!isValidEventStatus(raw)) throw ApiError.badRequest(`"${raw}" is not a valid event status.`);
  return String(raw).toUpperCase();
};

/**
 * POST /api/events  (ORGANISER only)
 * Owner is taken from the session; body `organiser` is ignored.
 */
export const createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent({ organiserId: req.user.id, body: req.body ?? {} });
  res.status(201).json({ success: true, data: { event }, message: 'Event created as a draft.' });
});

/**
 * GET /api/events/my  (ORGANISER only)
 * Only the caller's own events. Supports ?search=&status=&page=&limit=.
 */
export const getMyEvents = asyncHandler(async (req, res) => {
  const status = normaliseStatus(req.query.status);
  const data = await eventService.listOrganiserEvents({
    organiserId: req.user.id,
    search: req.query.search,
    status,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.status(200).json({ success: true, data });
});

/**
 * GET /api/events/my/stats  (ORGANISER only)
 * Per-status counts for the organiser dashboard.
 */
export const getMyEventStats = asyncHandler(async (req, res) => {
  const data = await eventService.getOrganiserDashboardStats({ organiserId: req.user.id });
  res.status(200).json({ success: true, data });
});

/**
 * GET /api/events/:id  (ORGANISER owner, or ADMIN)
 */
export const getEvent = asyncHandler(async (req, res) => {
  const event = await eventService.getEventForActor({
    eventId: req.params.id,
    actor: { id: req.user.id, role: req.user.role },
  });
  res.status(200).json({ success: true, data: { event } });
});

/**
 * PATCH /api/events/:id  (owning ORGANISER only)
 * Content fields only — ownership and status are not changed here.
 */
export const updateEvent = asyncHandler(async (req, res) => {
  const event = await eventService.updateEvent({
    eventId: req.params.id,
    organiserId: req.user.id,
    body: req.body ?? {},
  });
  res.status(200).json({ success: true, data: { event }, message: 'Event updated.' });
});

/**
 * PATCH /api/events/:id/status  (owning ORGANISER only)
 */
export const updateEventStatus = asyncHandler(async (req, res) => {
  const event = await eventService.updateEventStatusByOwner({
    eventId: req.params.id,
    organiserId: req.user.id,
    status: req.body?.status,
  });
  res.status(200).json({ success: true, data: { event }, message: `Event status set to ${event.status}.` });
});

/**
 * DELETE /api/events/:id  (owning ORGANISER only) — soft delete.
 */
export const deleteEvent = asyncHandler(async (req, res) => {
  const result = await eventService.deleteEvent({ eventId: req.params.id, organiserId: req.user.id });
  res.status(200).json({ success: true, data: result, message: 'Event deleted.' });
});
