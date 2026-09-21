import { Router } from 'express';

import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/user.model.js';
import * as registrationController from '../controllers/registration.controller.js';
import * as attendanceController from '../controllers/attendance.controller.js';

/**
 * Participant registration API (Phase 6 + Phase 7). Mounted at /api/registrations.
 * Every route: authenticated + USER. A user can only see, cancel and pull the
 * QR for their own registrations — enforced in the service against the
 * authenticated id, never a body/param user id.
 */
const router = Router();

router.use(authenticate, requireRole(ROLES.USER));

router.get('/mine', registrationController.listMyRegistrations);
router.get('/:registrationId/qr', attendanceController.getMyQr);
router.patch('/:registrationId/cancel', registrationController.cancelRegistration);
// Team registration (Phase 14) — leader-only whole-team cancel. A non-leader
// member leaves the team via the per-registration cancel route above.
router.patch('/teams/:teamId/cancel', registrationController.cancelTeamRegistration);

export default router;
