import { asyncHandler } from '../utils/asyncHandler.js';
import { analyzeEventPlan } from '../services/aiPlanning.service.js';

/**
 * POST /api/events/:eventId/ai/analyze
 *
 * Mounted on the planning router, so the request is already: authenticated +
 * ORGANISER + owner of :eventId (requireEventOwnership). USER and ADMIN get 403,
 * a bad id gets 400, an unknown/foreign event gets 404/403 — same as every
 * other Phase 4 planning endpoint.
 */
export const analyze = asyncHandler(async (req, res) => {
  const data = await analyzeEventPlan(String(req.event._id), req.event);
  res.json({ success: true, data });
});
