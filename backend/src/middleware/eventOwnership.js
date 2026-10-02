import { asyncHandler } from '../utils/asyncHandler.js';
import { loadOwnedEvent } from '../services/event.service.js';
import { syncEventStatuses } from '../services/eventStatusTransition.service.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Guard for every planning route under /api/events/:eventId/... .
 * Assumes `authenticate` + `requireRole('ORGANISER')` have already run.
 *
 * Loads the event named by :eventId and 403s unless the authenticated
 * organiser owns it (400 for a malformed id, 404 for a missing/soft-deleted
 * event). On success it attaches the event to `req.event` so controllers
 * don't reload it.
 */
export const requireEventOwnership = asyncHandler(async (req, _res, next) => {
  await syncEventStatuses();
  const event = await loadOwnedEvent(req.params.eventId, req.user.id);
  req.event = event;
  return next();
});

/** Completed events remain viewable, but their planning configuration is immutable. */
export const requireMutableEventPlanning = (req, _res, next) => {
  if (req.event?.status === 'COMPLETED') {
    return next(ApiError.conflict('Completed events are locked and their planning configuration cannot be changed.'));
  }
  return next();
};
