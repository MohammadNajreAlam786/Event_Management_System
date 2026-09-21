import { Router } from 'express';

import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/user.model.js';
import * as notificationController from '../controllers/notification.controller.js';

/**
 * Notification centre API (Phase 8). Mounted at /api/notifications.
 * Every route: authenticated + USER. A participant only ever sees and mutates
 * their own notifications — the service filters/verifies by the authenticated
 * id, never a query/body user id.
 */
const router = Router();

router.use(authenticate, requireRole(ROLES.USER));

router.get('/', notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
router.post('/read-all', notificationController.markAllRead);
router.patch('/:notificationId/read', notificationController.markRead);

export default router;
