import { asyncHandler } from '../utils/asyncHandler.js';
import * as planning from '../services/planning.service.js';

/**
 * Thin handlers for the planning sub-resources. `req.event` is set by the
 * requireEventOwnership middleware, so the organiser is already known to own
 * this event; the service scopes every query by `event` id as well.
 */
const eventId = (req) => String(req.event._id);

/* -------- Tasks -------- */
export const listTasks = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await planning.listTasks(eventId(req), req.query) });
});
export const createTask = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { task: await planning.createTask(eventId(req), req.body) }, message: 'Task created.' });
});
export const updateTask = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { task: await planning.updateTask(eventId(req), req.params.taskId, req.body) }, message: 'Task updated.' });
});
export const deleteTask = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await planning.deleteTask(eventId(req), req.params.taskId), message: 'Task deleted.' });
});

/* -------- Schedule -------- */
export const listSchedule = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await planning.listSchedule(eventId(req)) });
});
export const createSchedule = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { item: await planning.createSchedule(eventId(req), req.body) }, message: 'Schedule item created.' });
});
export const updateSchedule = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { item: await planning.updateSchedule(eventId(req), req.params.scheduleId, req.body) }, message: 'Schedule item updated.' });
});
export const deleteSchedule = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await planning.deleteSchedule(eventId(req), req.params.scheduleId), message: 'Schedule item deleted.' });
});

/* -------- Resources -------- */
export const listResources = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await planning.listResources(eventId(req), req.query) });
});
export const createResource = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { resource: await planning.createResource(eventId(req), req.body) }, message: 'Resource added.' });
});
export const updateResource = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { resource: await planning.updateResource(eventId(req), req.params.resourceId, req.body) }, message: 'Resource updated.' });
});
export const deleteResource = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await planning.deleteResource(eventId(req), req.params.resourceId), message: 'Resource deleted.' });
});

/* -------- Budget -------- */
export const listBudget = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await planning.listBudget(eventId(req), req.query) });
});
export const createBudgetItem = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { item: await planning.createBudgetItem(eventId(req), req.body) }, message: 'Budget item added.' });
});
export const updateBudgetItem = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { item: await planning.updateBudgetItem(eventId(req), req.params.budgetId, req.body) }, message: 'Budget item updated.' });
});
export const deleteBudgetItem = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await planning.deleteBudgetItem(eventId(req), req.params.budgetId), message: 'Budget item deleted.' });
});

/* -------- Team -------- */
export const listTeam = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await planning.listTeam(eventId(req), req.query) });
});
export const createTeamMember = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { member: await planning.createTeamMember(eventId(req), req.body) }, message: 'Team member added.' });
});
export const updateTeamMember = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { member: await planning.updateTeamMember(eventId(req), req.params.memberId, req.body) }, message: 'Team member updated.' });
});
export const deleteTeamMember = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await planning.deleteTeamMember(eventId(req), req.params.memberId), message: 'Team member removed.' });
});

/* -------- Derived views -------- */
export const getOverview = asyncHandler(async (req, res) => {
  const [overview, deadlines] = await Promise.all([
    planning.getPlanningOverview(eventId(req)),
    planning.getUpcomingDeadlines(eventId(req)),
  ]);
  const readiness = await planning.getReadiness(eventId(req));
  res.json({
    success: true,
    data: {
      event: {
        id: String(req.event._id),
        title: req.event.title,
        startDate: req.event.startDate,
        endDate: req.event.endDate,
        status: req.event.status,
      },
      ...overview,
      readiness: { overallScore: readiness.overallScore, status: readiness.status },
      needsAttention: readiness.needsAttention,
      upcomingDeadlines: deadlines,
    },
  });
});

export const getReadinessView = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await planning.getReadiness(eventId(req)) });
});
