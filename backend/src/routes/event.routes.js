import { Router } from 'express';

import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/user.model.js';
import * as eventController from '../controllers/event.controller.js';
import * as registrationController from '../controllers/registration.controller.js';
import * as attendanceController from '../controllers/attendance.controller.js';
import * as certificateController from '../controllers/certificate.controller.js';
import * as feedbackController from '../controllers/feedback.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as improvementController from '../controllers/improvement.controller.js';

/**
 * Organiser-facing Event API (Phase 3). Every route is authenticated except
 * `/public/featured` (Phase 13 — the public Home page's anonymous preview).
 * Ownership (an organiser may only touch their own events) is enforced in
 * the service layer, not left to the frontend.
 *
 *   GET    /api/events/public/featured PUBLIC             small anonymous-safe preview
 *   POST   /api/events                ORGANISER          create (status forced to DRAFT)
 *   GET    /api/events/my             ORGANISER          own events (search/filter/paginate)
 *   GET    /api/events/my/stats       ORGANISER          own per-status counts
 *   GET    /api/events/:id            ORGANISER owner | ADMIN
 *   PATCH  /api/events/:id            ORGANISER owner    edit content
 *   PATCH  /api/events/:id/status     ORGANISER owner    change status
 *   DELETE /api/events/:id            ORGANISER owner    soft delete
 */
const router = Router();

// Public — declared before `authenticate` (same precedent as
// certificate.routes.js's `/verify/:code`). Anonymous-safe preview for the
// public Home page; the full discovery/detail endpoints below remain
// USER-only, unchanged.
router.get('/public/featured', registrationController.listFeaturedEvents);

router.use(authenticate);

// Specific paths before the ':id' param routes.
router.post('/', requireRole(ROLES.ORGANISER), eventController.createEvent);
router.get('/my', requireRole(ROLES.ORGANISER), eventController.getMyEvents);
router.get('/my/stats', requireRole(ROLES.ORGANISER), eventController.getMyEventStats);

// Participant event discovery (Phase 6) — USER only. Literal '/public' before '/:id'.
router.get('/public', requireRole(ROLES.USER), registrationController.listPublicEvents);
router.get('/public/:id', requireRole(ROLES.USER), registrationController.getPublicEvent);

router.get('/:id', requireRole(ROLES.ORGANISER, ROLES.ADMIN), eventController.getEvent);
router.patch('/:id', requireRole(ROLES.ORGANISER), eventController.updateEvent);
router.patch('/:id/status', requireRole(ROLES.ORGANISER), eventController.updateEventStatus);
router.delete('/:id', requireRole(ROLES.ORGANISER), eventController.deleteEvent);

// Participant registration (Phase 6) — USER registers; the owning ORGANISER lists participants.
router.post('/:id/register', requireRole(ROLES.USER), registrationController.register);
// Team registration (Phase 14) — only valid for a TEAM-configured event; enforced in the service.
router.post('/:id/register/team', requireRole(ROLES.USER), registrationController.registerTeam);
router.get('/:id/registrations', requireRole(ROLES.ORGANISER), registrationController.listEventRegistrations);

// QR attendance (Phase 7) — the owning ORGANISER scans credentials and reviews
// attendance for their own event. Ownership is verified in the service via
// loadOwnedEvent (400 bad id / 404 missing / 403 not owner).
router.get('/:id/attendance', requireRole(ROLES.ORGANISER), attendanceController.listEventAttendance);
router.get('/:id/attendance/summary', requireRole(ROLES.ORGANISER), attendanceController.getAttendanceSummary);
router.post('/:id/attendance/check-in', requireRole(ROLES.ORGANISER), attendanceController.checkIn);
// Attendance CSV export (Phase 14) — ORGANISER (own events) or ADMIN (any); enforced in the service.
router.get(
  '/:id/attendance/export',
  requireRole(ROLES.ORGANISER, ROLES.ADMIN),
  attendanceController.exportAttendance,
);

// Certificates (Phase 8) — the owning ORGANISER reviews eligibility and generates
// certificates for their own COMPLETED event. Ownership + completion enforced in
// the service.
router.get('/:id/certificates/eligibility', requireRole(ROLES.ORGANISER), certificateController.eligibility);
router.post('/:id/certificates/generate', requireRole(ROLES.ORGANISER), certificateController.generate);

// Feedback + AI sentiment (Phase 9). Participant submits/edits/views their own
// feedback; the owning ORGANISER reads all feedback for their event. Eligibility
// (registered + PRESENT + COMPLETED) and ownership are enforced in the service.
// '/feedback/mine' is literal, declared before the ':feedbackId' param route.
router.get('/:id/feedback/mine', requireRole(ROLES.USER), feedbackController.getMine);
router.post('/:id/feedback', requireRole(ROLES.USER), feedbackController.submit);
router.patch('/:id/feedback/:feedbackId', requireRole(ROLES.USER), feedbackController.update);
router.get('/:id/feedback', requireRole(ROLES.ORGANISER), feedbackController.listForEvent);

// Post-event analytics + report (Phase 10). Read-only. The owning ORGANISER or
// any ADMIN; ownership + COMPLETED-only (for the report) enforced in the service.
router.get('/:id/analytics', requireRole(ROLES.ORGANISER, ROLES.ADMIN), analyticsController.getEventAnalytics);
router.get('/:id/report', requireRole(ROLES.ORGANISER, ROLES.ADMIN), analyticsController.downloadReport);

// Future-event improvement recommendations (Phase 11). Read-only view for the
// owning ORGANISER or any ADMIN; only the owning ORGANISER may (re)generate —
// generation is left to the organiser's own judgement, like certificate
// generation (§ RBAC). COMPLETED-only, enforced in the service (409 otherwise).
router.get('/:id/improvements', requireRole(ROLES.ORGANISER, ROLES.ADMIN), improvementController.getImprovements);
router.post('/:id/improvements/generate', requireRole(ROLES.ORGANISER), improvementController.generateImprovements);

export default router;
