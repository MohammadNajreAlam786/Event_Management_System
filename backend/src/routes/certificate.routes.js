import { Router } from 'express';

import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/user.model.js';
import * as certificateController from '../controllers/certificate.controller.js';

/**
 * Certificate API (Phase 8). Mounted at /api/certificates.
 *
 *   GET  /verify/:verificationCode   PUBLIC   — limited public verification info
 *   GET  /mine                       USER     — the caller's own certificates
 *   GET  /:certificateId/download    USER (owner) | ORGANISER (owns the event) — the PDF
 *
 * Certificate *generation* + *eligibility* live on the event router
 * (/api/events/:id/certificates/*) so they sit beside the other owner-scoped
 * event operations.
 */
const router = Router();

// Public — declared before `authenticate`. `/verify/...` is literal, so it can
// never be captured by an authenticated `/:certificateId/...` route.
router.get('/verify/:verificationCode', certificateController.verify);

router.use(authenticate);

router.get('/mine', requireRole(ROLES.USER), certificateController.listMine);
router.get('/:certificateId/download', certificateController.download);

export default router;
