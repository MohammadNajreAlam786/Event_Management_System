import { Router } from 'express';

import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/user.model.js';
import { adminTest, organiserTest, userTest } from '../controllers/roleTest.controller.js';

/**
 * RBAC verification endpoints (Phase 1 only):
 *   GET /api/admin/test      -> ADMIN only
 *   GET /api/organiser/test  -> ORGANISER only
 *   GET /api/user/test       -> USER only
 */
const router = Router();

router.get('/admin/test', authenticate, requireRole(ROLES.ADMIN), adminTest);
router.get('/organiser/test', authenticate, requireRole(ROLES.ORGANISER), organiserTest);
router.get('/user/test', authenticate, requireRole(ROLES.USER), userTest);

export default router;
