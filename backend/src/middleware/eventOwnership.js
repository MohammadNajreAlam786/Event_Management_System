import { asyncHandler } from '../utils/asyncHandler.js';
import { loadOwnedEvent } from '../services/event.service.js';

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
  const event = await loadOwnedEvent(req.params.eventId, req.user.id);
  req.event = event;
  return next();
});
