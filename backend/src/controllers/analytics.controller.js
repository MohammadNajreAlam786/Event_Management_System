import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';
import * as analyticsService from '../services/analytics.service.js';
import { buildEventReportPdf } from '../utils/eventReportPdf.js';

const safeFilename = (value) =>
  String(value ?? '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'Event';

/**
 * The acting identity is taken ONLY from the authenticated session (`req.user`,
 * set by `authenticate` after re-loading the user from the DB). Query / body /
 * route params like `?organiserId=`, `?userId=`, `?ownerId=` are never read for
 * authorization — ownership is resolved in analytics.service against this id
 * (Issue 5).
 */
const actorOf = (req) => ({ id: req.user.id, role: req.user.role });

/** GET /api/events/:id/analytics — ORGANISER (owner) | ADMIN. Read-only. */
export const getEventAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getEventAnalytics({ actor: actorOf(req), eventId: req.params.id });
  res.status(200).json({ success: true, data });
});

/** GET /api/events/:id/report(?inline=1) — ORGANISER (owner) | ADMIN. COMPLETED events only. */
export const downloadReport = asyncHandler(async (req, res) => {
  const { analytics, reference } = await analyticsService.getEventReportData({
    actor: actorOf(req),
    eventId: req.params.id,
  });

  let pdf;
  try {
    pdf = await buildEventReportPdf(analytics, { reference });
  } catch (err) {
    logger.error(`event report render failed (${req.params.id}): ${err.message}`);
    throw new ApiError(500, 'The event report could not be generated. Please try again.');
  }

  const disposition = req.query.inline === '1' || req.query.inline === 'true' ? 'inline' : 'attachment';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeFilename(analytics.event.title)}_Report.pdf"`);
  res.setHeader('Content-Length', pdf.length);
  res.status(200).end(pdf);
});

/** GET /api/admin/analytics/summary — ADMIN only (admin router). */
export const platformSummary = asyncHandler(async (_req, res) => {
  const data = await analyticsService.getPlatformSummary();
  res.status(200).json({ success: true, data });
});
