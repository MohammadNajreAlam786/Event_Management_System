import { Router } from 'express';

import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { requireEventOwnership, requireMutableEventPlanning } from '../middleware/eventOwnership.js';
import { ROLES } from '../models/user.model.js';
import * as planning from '../controllers/planning.controller.js';
import * as aiPlanning from '../controllers/aiPlanning.controller.js';
import * as teamAccess from '../controllers/teamAccess.controller.js';

/**
 * Pre-event planning API (Phase 4). Mounted at /api/events/:eventId.
 * Every route: authenticated + ORGANISER + owns :eventId (checked once, in
 * requireEventOwnership). USER and ADMIN get 403.
 */
const router = Router({ mergeParams: true });

router.use(authenticate, requireRole(ROLES.ORGANISER), requireEventOwnership);

// Tasks
router.get('/tasks', planning.listTasks);
router.post('/tasks', requireMutableEventPlanning, planning.createTask);
router.patch('/tasks/:taskId', requireMutableEventPlanning, planning.updateTask);
router.delete('/tasks/:taskId', requireMutableEventPlanning, planning.deleteTask);

// Schedule
router.get('/schedule', planning.listSchedule);
router.post('/schedule', requireMutableEventPlanning, planning.createSchedule);
router.patch('/schedule/:scheduleId', requireMutableEventPlanning, planning.updateSchedule);
router.delete('/schedule/:scheduleId', requireMutableEventPlanning, planning.deleteSchedule);

// Resources
router.get('/resources', planning.listResources);
router.post('/resources', requireMutableEventPlanning, planning.createResource);
router.patch('/resources/:resourceId', requireMutableEventPlanning, planning.updateResource);
router.delete('/resources/:resourceId', requireMutableEventPlanning, planning.deleteResource);

// Budget
router.get('/budget', planning.listBudget);
router.post('/budget', requireMutableEventPlanning, planning.createBudgetItem);
router.patch('/budget/:budgetId', requireMutableEventPlanning, planning.updateBudgetItem);
router.delete('/budget/:budgetId', requireMutableEventPlanning, planning.deleteBudgetItem);

// Team
router.get('/team', planning.listTeam);
router.post('/team', requireMutableEventPlanning, planning.createTeamMember);
router.patch('/team/:memberId', requireMutableEventPlanning, planning.updateTeamMember);
router.delete('/team/:memberId', requireMutableEventPlanning, planning.deleteTeamMember);

// Post-event requests are historical workflow data, not planning edits.
router.get('/access-requests', teamAccess.listAccessRequests);
router.post('/access-requests/:requestId/decision', teamAccess.decideAccessRequest);

// Derived views
router.get('/planning/overview', planning.getOverview);
router.get('/planning/readiness', planning.getReadinessView);

// AI Planning Assistant (Phase 5) — analyse the current planning data.
router.post('/ai/analyze', aiPlanning.analyze);

export default router;
