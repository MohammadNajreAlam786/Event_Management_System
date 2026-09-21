import { Router } from 'express';

import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/user.model.js';
import * as adminController from '../controllers/admin.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';

/**
 * Admin API (Phase 2). Every route requires an authenticated ADMIN — enforced
 * here at the router level, not left to individual handlers or the frontend.
 */
const router = Router();

router.use(authenticate, requireRole(ROLES.ADMIN));

router.get('/dashboard/stats', adminController.getDashboardStats);

router.get('/users', adminController.getUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);

router.get('/organisers', adminController.getOrganisers);
router.patch('/organisers/:id/status', adminController.updateOrganiserStatus);

router.get('/events', adminController.getEvents);
router.patch('/events/:id/status', adminController.updateEventStatus);

// Platform analytics roll-up (Phase 10) — basic totals only.
router.get('/analytics/summary', analyticsController.platformSummary);

export default router;
