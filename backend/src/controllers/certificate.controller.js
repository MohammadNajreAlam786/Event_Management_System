import { asyncHandler } from '../utils/asyncHandler.js';
import * as certificateService from '../services/certificate.service.js';

/* ---------------- Organiser (owner of the event) ---------------- */

/** GET /api/events/:id/certificates/eligibility */
export const eligibility = asyncHandler(async (req, res) => {
  const data = await certificateService.listEligibility({
    organiserId: req.user.id,
    eventId: req.params.id,
  });
  res.status(200).json({ success: true, data });
});

/** POST /api/events/:id/certificates/generate */
export const generate = asyncHandler(async (req, res) => {
  const data = await certificateService.generateForEvent({
    organiserId: req.user.id,
    eventId: req.params.id,
  });
  res.status(200).json({ success: true, data, message: 'Certificate generation complete.' });
});

/* ---------------- Participant ---------------- */

/** GET /api/certificates/mine */
export const listMine = asyncHandler(async (req, res) => {
  const data = await certificateService.listMyCertificates({ userId: req.user.id });
  res.status(200).json({ success: true, data });
});

/* ---------------- Download (USER owner OR the event's ORGANISER) ---------------- */

/** GET /api/certificates/:certificateId/download  (?inline=1 to preview) */
export const download = asyncHandler(async (req, res) => {
  const { pdf, filename } = await certificateService.getCertificateForDownload({
    actorId: req.user.id,
    actorRole: req.user.role,
    certificateId: req.params.certificateId,
  });
  const disposition = req.query.inline === '1' || req.query.inline === 'true' ? 'inline' : 'attachment';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
  res.setHeader('Content-Length', pdf.length);
  res.status(200).end(pdf);
});

/* ---------------- Public verification ---------------- */

/** GET /api/certificates/verify/:verificationCode */
export const verify = asyncHandler(async (req, res) => {
  const data = await certificateService.verifyByCode(req.params.verificationCode);
  res.status(200).json({ success: true, data });
});
