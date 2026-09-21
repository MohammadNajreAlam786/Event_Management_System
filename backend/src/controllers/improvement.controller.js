import { asyncHandler } from '../utils/asyncHandler.js';
import * as improvementService from '../services/improvement.service.js';

/**
 * The acting identity is taken ONLY from the authenticated session
 * (`req.user`). Query/body params are never read for authorization — ownership
 * is resolved in improvement.service against this id (mirrors analytics.controller).
 */
const actorOf = (req) => ({ id: req.user.id, role: req.user.role });

/** GET /api/events/:id/improvements — ORGANISER (owner) | ADMIN. Read-only. */
export const getImprovements = asyncHandler(async (req, res) => {
  const data = await improvementService.getImprovementsForActor({ actor: actorOf(req), eventId: req.params.id });
  res.status(200).json({ success: true, data });
});

/** POST /api/events/:id/improvements/generate — ORGANISER (owner) only. COMPLETED events only. */
export const generateImprovements = asyncHandler(async (req, res) => {
  const data = await improvementService.generateImprovements({ organiserId: req.user.id, eventId: req.params.id });
  res.status(200).json({ success: true, data, message: 'Improvement recommendations generated.' });
});
