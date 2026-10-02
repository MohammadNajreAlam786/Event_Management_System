import { Router } from 'express';

import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ROLES } from '../models/user.model.js';
import * as teamAccess from '../controllers/teamAccess.controller.js';

const router = Router();

router.use(authenticate, requireRole(ROLES.USER));
router.get('/invitations', teamAccess.listMyInvitations);
router.post('/invitations/:invitationId/accept', teamAccess.acceptInvitation);
router.post('/invitations/:invitationId/decline', teamAccess.declineInvitation);
router.get('/tasks', teamAccess.listMyTasks);
router.patch('/tasks/:taskId/status', teamAccess.updateMyTaskStatus);
router.post('/events/:eventId/access-requests', teamAccess.requestAccess);

export default router;
