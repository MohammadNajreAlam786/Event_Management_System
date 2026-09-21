import { Router } from 'express';

import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { requireEventOwnership } from '../middleware/eventOwnership.js';
import { ROLES } from '../models/user.model.js';
import * as planning from '../controllers/planning.controller.js';
import * as aiPlanning from '../controllers/aiPlanning.controller.js';

/**
 * Pre-event planning API (Phase 4). Mounted at /api/events/:eventId.
 * Every route: authenticated + ORGANISER + owns :eventId (checked once, in
 * requireEventOwnership). USER and ADMIN get 403.
 */
const router = Router({ mergeParams: true });

router.use(authenticate, requireRole(ROLES.ORGANISER), requireEventOwnership);

// Tasks
router.get('/tasks', planning.listTasks);
router.post('/tasks', planning.createTask);
router.patch('/tasks/:taskId', planning.updateTask);
router.delete('/tasks/:taskId', planning.deleteTask);

// Schedule
router.get('/schedule', planning.listSchedule);
router.post('/schedule', planning.createSchedule);
router.patch('/schedule/:scheduleId', planning.updateSchedule);
router.delete('/schedule/:scheduleId', planning.deleteSchedule);

// Resources
router.get('/resources', planning.listResources);
router.post('/resources', planning.createResource);
router.patch('/resources/:resourceId', planning.updateResource);
router.delete('/resources/:resourceId', planning.deleteResource);

// Budget
router.get('/budget', planning.listBudget);
router.post('/budget', planning.createBudgetItem);
router.patch('/budget/:budgetId', planning.updateBudgetItem);
router.delete('/budget/:budgetId', planning.deleteBudgetItem);

// Team
router.get('/team', planning.listTeam);
router.post('/team', planning.createTeamMember);
router.patch('/team/:memberId', planning.updateTeamMember);
router.delete('/team/:memberId', planning.deleteTeamMember);

// Derived views
router.get('/planning/overview', planning.getOverview);
router.get('/planning/readiness', planning.getReadinessView);

// AI Planning Assistant (Phase 5) — analyse the current planning data.
router.post('/ai/analyze', aiPlanning.analyze);

export default router;
