import mongoose from 'mongoose';

import EventTask from '../models/eventTask.model.js';
import EventSchedule from '../models/eventSchedule.model.js';
import EventResource from '../models/eventResource.model.js';
import EventBudgetItem from '../models/eventBudgetItem.model.js';
import EventTeamMember from '../models/eventTeamMember.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  validateTask,
  validateSchedule,
  validateResource,
  validateBudgetItem,
  validateTeamMember,
  TASK_STATUSES,
  TASK_PRIORITIES,
  RESOURCE_STATUSES,
  RESOURCE_CATEGORIES,
  BUDGET_STATUSES,
  BUDGET_CATEGORIES,
  TEAM_STATUSES,
} from '../utils/planningValidators.js';

/**
 * Planning domain logic — CRUD for the five planning sub-resources plus the
 * derived views (overview, readiness, needs-attention, upcoming deadlines).
 *
 * Every function is called only after middleware has verified that the
 * authenticated ORGANISER owns `eventId`; each query is still scoped by
 * `event: eventId` so a mismatched :eventId/:itemId pair can't reach data
 * from another event.
 */

const MAX_PAGE_SIZE = 100;
const escapeRegExp = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clampPage = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
};
const clampLimit = (v, dflt = 20) => {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return dflt;
  return Math.min(n, MAX_PAGE_SIZE);
};
const assertItemId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid item id.');
};
const throwValidation = (errors) =>
  Object.assign(ApiError.badRequest('Please correct the highlighted fields.'), { errors });

/** Normalise an enum-ish input to UPPER, or undefined. */
const up = (v) => (v === undefined || v === null || v === '' ? undefined : String(v).trim().toUpperCase());

/* ------------------------------------------------------------------ generic CRUD */

const makeCrud = ({ Model, validate, editable, coerce = (x) => x }) => {
  const pick = (body) => {
    const out = {};
    for (const key of editable) if (body[key] !== undefined) out[key] = body[key];
    return coerce(out);
  };

  return {
    create: async (eventId, body) => {
      const data = pick(body ?? {});
      const { valid, errors } = validate(data);
      if (!valid) throw throwValidation(errors);
      const doc = await Model.create({ ...data, event: eventId });
      return doc.toJSON();
    },
    get: async (eventId, itemId) => {
      assertItemId(itemId);
      const doc = await Model.findOne({ _id: itemId, event: eventId });
      if (!doc) throw ApiError.notFound('Item not found.');
      return doc.toJSON();
    },
    update: async (eventId, itemId, body) => {
      assertItemId(itemId);
      const doc = await Model.findOne({ _id: itemId, event: eventId });
      if (!doc) throw ApiError.notFound('Item not found.');
      const data = pick(body ?? {});
      const { valid, errors } = validate({ ...doc.toObject(), ...data }, { partial: true });
      if (!valid) throw throwValidation(errors);
      Object.assign(doc, data);
      await doc.save();
      return doc.toJSON();
    },
    remove: async (eventId, itemId) => {
      assertItemId(itemId);
      const doc = await Model.findOneAndDelete({ _id: itemId, event: eventId });
      if (!doc) throw ApiError.notFound('Item not found.');
      return { id: itemId };
    },
  };
};

/* ------------------------------------------------------------------ Tasks */

const taskCrud = makeCrud({
  Model: EventTask,
  validate: validateTask,
  editable: ['title', 'description', 'assignedTo', 'priority', 'status', 'dueDate'],
  coerce: (d) => {
    if (d.priority) d.priority = String(d.priority).toUpperCase();
    if (d.status) d.status = String(d.status).toUpperCase();
    if (d.dueDate === '' ) d.dueDate = null;
    return d;
  },
});

const isOverdue = (t) => t.dueDate && t.status !== 'COMPLETED' && new Date(t.dueDate) < new Date();

export const createTask = (eventId, body) => taskCrud.create(eventId, body);
export const updateTask = (eventId, id, body) => taskCrud.update(eventId, id, body);
export const deleteTask = (eventId, id) => taskCrud.remove(eventId, id);

const PRIORITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export const listTasks = async (eventId, query = {}) => {
  const filter = { event: eventId };
  const status = up(query.status);
  const priority = up(query.priority);
  if (status && TASK_STATUSES.includes(status)) filter.status = status;
  if (priority && TASK_PRIORITIES.includes(priority)) filter.priority = priority;
  if (query.search && String(query.search).trim()) {
    filter.title = new RegExp(escapeRegExp(String(query.search).trim()), 'i');
  }

  const sortKey = ['dueDate', 'priority', 'created'].includes(query.sort) ? query.sort : 'created';
  const page = clampPage(query.page);
  const limit = clampLimit(query.limit, 20);

  // Fetch matching tasks (bounded per event), sort in memory (needed for the
  // priority ordering), then paginate.
  const all = await EventTask.find(filter).lean();
  const sorters = {
    created: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    dueDate: (a, b) => {
      const av = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bv = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return av - bv || new Date(b.createdAt) - new Date(a.createdAt);
    },
    priority: (a, b) =>
      (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) ||
      new Date(b.createdAt) - new Date(a.createdAt),
  };
  all.sort(sorters[sortKey]);

  const total = all.length;
  const slice = all.slice((page - 1) * limit, (page - 1) * limit + limit);
  return {
    tasks: slice.map((d) => ({
      ...d,
      id: String(d._id),
      _id: undefined,
      __v: undefined,
      overdue: isOverdue(d),
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
};

/* ------------------------------------------------------------------ Schedule */

const scheduleCrud = makeCrud({
  Model: EventSchedule,
  validate: validateSchedule,
  editable: ['title', 'description', 'startTime', 'endTime', 'location', 'type'],
  coerce: (d) => {
    if (d.type) d.type = String(d.type).toUpperCase();
    return d;
  },
});

/** Mark items that overlap another item in the same list. */
const withConflicts = (items) => {
  const flagged = items.map((it) => ({ ...it, conflictsWith: [] }));
  for (let i = 0; i < flagged.length; i += 1) {
    for (let j = i + 1; j < flagged.length; j += 1) {
      const a = flagged[i];
      const b = flagged[j];
      const aS = new Date(a.startTime).getTime();
      const aE = new Date(a.endTime).getTime();
      const bS = new Date(b.startTime).getTime();
      const bE = new Date(b.endTime).getTime();
      if (aS < bE && bS < aE) {
        a.conflictsWith.push(b.id);
        b.conflictsWith.push(a.id);
      }
    }
  }
  return flagged;
};

export const createSchedule = (eventId, body) => scheduleCrud.create(eventId, body);
export const updateSchedule = (eventId, id, body) => scheduleCrud.update(eventId, id, body);
export const deleteSchedule = (eventId, id) => scheduleCrud.remove(eventId, id);

export const listSchedule = async (eventId) => {
  const docs = await EventSchedule.find({ event: eventId }).sort({ startTime: 1, createdAt: 1 });
  const items = withConflicts(docs.map((d) => d.toJSON()));
  return { schedule: items, conflictCount: items.filter((i) => i.conflictsWith.length > 0).length };
};

/* ------------------------------------------------------------------ Resources */

const resourceCrud = makeCrud({
  Model: EventResource,
  validate: validateResource,
  editable: ['name', 'description', 'category', 'quantity', 'unit', 'status', 'estimatedUnitCost', 'notes'],
  coerce: (d) => {
    if (d.category) d.category = String(d.category).toUpperCase();
    if (d.status) d.status = String(d.status).toUpperCase();
    if (d.quantity !== undefined && d.quantity !== '' && d.quantity !== null) d.quantity = Number(d.quantity);
    if (d.estimatedUnitCost !== undefined && d.estimatedUnitCost !== '' && d.estimatedUnitCost !== null) {
      d.estimatedUnitCost = Number(d.estimatedUnitCost);
    }
    return d;
  },
});

export const createResource = (eventId, body) => resourceCrud.create(eventId, body);
export const updateResource = (eventId, id, body) => resourceCrud.update(eventId, id, body);
export const deleteResource = (eventId, id) => resourceCrud.remove(eventId, id);

export const listResources = async (eventId, query = {}) => {
  const filter = { event: eventId };
  const status = up(query.status);
  const category = up(query.category);
  if (status && RESOURCE_STATUSES.includes(status)) filter.status = status;
  if (category && RESOURCE_CATEGORIES.includes(category)) filter.category = category;
  if (query.search && String(query.search).trim()) {
    filter.name = new RegExp(escapeRegExp(String(query.search).trim()), 'i');
  }
  const docs = await EventResource.find(filter).sort({ createdAt: -1 });
  return { resources: docs.map((d) => d.toJSON()) };
};

/* ------------------------------------------------------------------ Budget */

const budgetCrud = makeCrud({
  Model: EventBudgetItem,
  validate: validateBudgetItem,
  editable: ['category', 'description', 'estimatedAmount', 'actualAmount', 'status', 'notes'],
  coerce: (d) => {
    if (d.category) d.category = String(d.category).toUpperCase();
    if (d.status) d.status = String(d.status).toUpperCase();
    for (const f of ['estimatedAmount', 'actualAmount']) {
      if (d[f] === '' ) d[f] = f === 'actualAmount' ? null : 0;
      else if (d[f] !== undefined && d[f] !== null) d[f] = Number(d[f]);
    }
    return d;
  },
});

export const createBudgetItem = (eventId, body) => budgetCrud.create(eventId, body);
export const updateBudgetItem = (eventId, id, body) => budgetCrud.update(eventId, id, body);
export const deleteBudgetItem = (eventId, id) => budgetCrud.remove(eventId, id);

export const listBudget = async (eventId, query = {}) => {
  const filter = { event: eventId };
  const status = up(query.status);
  const category = up(query.category);
  if (status && BUDGET_STATUSES.includes(status)) filter.status = status;
  if (category && BUDGET_CATEGORIES.includes(category)) filter.category = category;
  const docs = await EventBudgetItem.find(filter).sort({ createdAt: -1 });
  const items = docs.map((d) => d.toJSON());
  const estimatedTotal = items.reduce((s, i) => s + (i.estimatedAmount || 0), 0);
  const actualTotal = items.reduce((s, i) => s + (i.actualAmount || 0), 0);
  return {
    budget: items,
    totals: { estimatedTotal, actualTotal, variance: estimatedTotal - actualTotal },
  };
};

/* ------------------------------------------------------------------ Team */

const teamCrud = makeCrud({
  Model: EventTeamMember,
  validate: validateTeamMember,
  editable: ['name', 'email', 'role', 'responsibility', 'status'],
  coerce: (d) => {
    if (d.status) d.status = String(d.status).toUpperCase();
    return d;
  },
});

export const createTeamMember = (eventId, body) => teamCrud.create(eventId, body);
export const updateTeamMember = (eventId, id, body) => teamCrud.update(eventId, id, body);
export const deleteTeamMember = (eventId, id) => teamCrud.remove(eventId, id);

export const listTeam = async (eventId, query = {}) => {
  const filter = { event: eventId };
  const status = up(query.status);
  if (status && TEAM_STATUSES.includes(status)) filter.status = status;
  const docs = await EventTeamMember.find(filter).sort({ createdAt: -1 });
  return { team: docs.map((d) => d.toJSON()) };
};

/* ------------------------------------------------------------------ Derived views */

const CONFIRMED_TEAM = ['CONFIRMED', 'ACTIVE', 'COMPLETED'];
const APPROVED_BUDGET = ['APPROVED', 'PAID'];

/**
 * Aggregate all planning data for one event into the numbers the overview
 * and readiness views need. One pass, reused by both.
 */
const gatherPlanningData = async (eventId) => {
  const [tasks, scheduleDocs, resources, budgetItems, team] = await Promise.all([
    EventTask.find({ event: eventId }).lean(),
    EventSchedule.find({ event: eventId }).lean(),
    EventResource.find({ event: eventId }).lean(),
    EventBudgetItem.find({ event: eventId }).lean(),
    EventTeamMember.find({ event: eventId }).lean(),
  ]);

  const now = Date.now();
  const taskTotal = tasks.length;
  const taskCompleted = tasks.filter((t) => t.status === 'COMPLETED').length;
  const taskOverdue = tasks.filter((t) => t.dueDate && t.status !== 'COMPLETED' && new Date(t.dueDate).getTime() < now).length;
  const taskCritPending = tasks.filter((t) => t.priority === 'CRITICAL' && t.status !== 'COMPLETED').length;

  const schedule = withConflicts(scheduleDocs.map((d) => ({ ...d, id: String(d._id) })));
  const scheduleConflicts = schedule.filter((s) => s.conflictsWith.length > 0).length;

  const resTotal = resources.length;
  const resAvailable = resources.filter((r) => r.status === 'AVAILABLE').length;
  const resNotAvailable = resources.filter((r) => r.status === 'NOT_AVAILABLE').length;

  const budgetTotal = budgetItems.length;
  const budgetApproved = budgetItems.filter((b) => APPROVED_BUDGET.includes(b.status)).length;
  const budgetPlannedOnly = budgetItems.filter((b) => b.status === 'PLANNED').length;
  const estimatedTotal = budgetItems.reduce((s, b) => s + (b.estimatedAmount || 0), 0);
  const actualTotal = budgetItems.reduce((s, b) => s + (b.actualAmount || 0), 0);

  const teamTotal = team.length;
  const teamConfirmed = team.filter((m) => CONFIRMED_TEAM.includes(m.status)).length;
  const teamUnconfirmed = team.filter((m) => m.status === 'INVITED').length;

  return {
    tasks,
    now,
    counts: {
      task: { total: taskTotal, completed: taskCompleted, pending: taskTotal - taskCompleted, overdue: taskOverdue, criticalPending: taskCritPending },
      schedule: { total: schedule.length, conflicts: scheduleConflicts },
      resource: { total: resTotal, available: resAvailable, notAvailable: resNotAvailable },
      budget: { total: budgetTotal, approved: budgetApproved, plannedOnly: budgetPlannedOnly, estimatedTotal, actualTotal },
      team: { total: teamTotal, confirmed: teamConfirmed, unconfirmed: teamUnconfirmed },
    },
  };
};

/** GET /planning/overview */
export const getPlanningOverview = async (eventId) => {
  const { counts } = await gatherPlanningData(eventId);
  const t = counts.task;
  return {
    tasks: {
      total: t.total,
      completed: t.completed,
      pending: t.pending,
      overdue: t.overdue,
    },
    schedule: { total: counts.schedule.total, conflicts: counts.schedule.conflicts },
    resources: { total: counts.resource.total, available: counts.resource.available },
    budget: {
      estimated: counts.budget.estimatedTotal,
      actual: counts.budget.actualTotal,
      variance: counts.budget.estimatedTotal - counts.budget.actualTotal,
    },
    team: { total: counts.team.total, confirmed: counts.team.confirmed },
    progress: {
      // "planning progress" == task completion percentage (dynamic, not stored)
      taskCompletion: t.total === 0 ? 0 : Math.round((t.completed / t.total) * 100),
    },
  };
};

/**
 * Readiness — deterministic and documented.
 *
 *   component scores (0-100):
 *     tasks     = completed / total * 100          (0 if no tasks)
 *     schedule  = 100 if >=1 item and no conflict; 60 if items but a conflict; 0 if none
 *     resources = AVAILABLE / total * 100          (0 if none)
 *     budget    = (APPROVED + PAID) / total * 100  (0 if none)
 *     team      = (CONFIRMED+ACTIVE+COMPLETED) / total * 100  (0 if none)
 *
 *   weights: tasks 30, schedule 20, resources 20, budget 15, team 15  (= 100)
 *   overall = round(sum(score * weight) / 100)
 *
 *   status: 0-39 NOT_READY | 40-69 PARTIALLY_READY | 70-89 MOSTLY_READY | 90-100 READY
 */
export const READINESS_WEIGHTS = Object.freeze({ tasks: 30, schedule: 20, resources: 20, budget: 15, team: 15 });

const pct = (num, den) => (den === 0 ? 0 : Math.round((num / den) * 100));

export const readinessStatus = (score) => {
  if (score >= 90) return 'READY';
  if (score >= 70) return 'MOSTLY_READY';
  if (score >= 40) return 'PARTIALLY_READY';
  return 'NOT_READY';
};

export const getReadiness = async (eventId) => {
  const { counts } = await gatherPlanningData(eventId);

  const scheduleScore =
    counts.schedule.total === 0 ? 0 : counts.schedule.conflicts > 0 ? 60 : 100;

  const components = {
    tasks: pct(counts.task.completed, counts.task.total),
    schedule: scheduleScore,
    resources: pct(counts.resource.available, counts.resource.total),
    budget: pct(counts.budget.approved, counts.budget.total),
    team: pct(counts.team.confirmed, counts.team.total),
  };

  const w = READINESS_WEIGHTS;
  const overallScore = Math.round(
    (components.tasks * w.tasks +
      components.schedule * w.schedule +
      components.resources * w.resources +
      components.budget * w.budget +
      components.team * w.team) /
      100,
  );

  const detail = {
    tasks: { done: counts.task.completed, total: counts.task.total, score: components.tasks },
    schedule: { done: counts.schedule.total, total: counts.schedule.total, score: components.schedule, conflicts: counts.schedule.conflicts },
    resources: { done: counts.resource.available, total: counts.resource.total, score: components.resources },
    budget: { done: counts.budget.approved, total: counts.budget.total, score: components.budget },
    team: { done: counts.team.confirmed, total: counts.team.total, score: components.team },
  };

  return {
    overallScore,
    status: readinessStatus(overallScore),
    weights: w,
    components,
    detail,
    needsAttention: buildNeedsAttention(counts),
  };
};

/** Real-data "needs attention" list (empty => the UI shows "Everything is on track."). */
function buildNeedsAttention(counts) {
  const items = [];
  if (counts.task.overdue > 0) items.push({ type: 'overdue_tasks', count: counts.task.overdue, message: `${counts.task.overdue} overdue task${counts.task.overdue > 1 ? 's' : ''}` });
  if (counts.task.criticalPending > 0) items.push({ type: 'critical_tasks', count: counts.task.criticalPending, message: `${counts.task.criticalPending} critical task${counts.task.criticalPending > 1 ? 's' : ''} pending` });
  if (counts.resource.notAvailable > 0) items.push({ type: 'resources_unavailable', count: counts.resource.notAvailable, message: `${counts.resource.notAvailable} resource${counts.resource.notAvailable > 1 ? 's' : ''} not available` });
  if (counts.schedule.conflicts > 0) items.push({ type: 'schedule_conflict', count: counts.schedule.conflicts, message: `${counts.schedule.conflicts} schedule conflict${counts.schedule.conflicts > 1 ? 's' : ''}` });
  if (counts.budget.plannedOnly > 0) items.push({ type: 'budget_unapproved', count: counts.budget.plannedOnly, message: `Budget has ${counts.budget.plannedOnly} item${counts.budget.plannedOnly > 1 ? 's' : ''} awaiting approval` });
  if (counts.team.unconfirmed > 0) items.push({ type: 'team_unconfirmed', count: counts.team.unconfirmed, message: `${counts.team.unconfirmed} team member${counts.team.unconfirmed > 1 ? 's' : ''} not confirmed` });
  return items;
}

/** Next task deadlines (not completed, due today or later), soonest first. */
export const getUpcomingDeadlines = async (eventId, limit = 5) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const docs = await EventTask.find({
    event: eventId,
    status: { $ne: 'COMPLETED' },
    dueDate: { $ne: null, $gte: startOfToday },
  })
    .sort({ dueDate: 1 })
    .limit(limit)
    .lean();
  return docs.map((d) => ({ id: String(d._id), title: d.title, dueDate: d.dueDate, priority: d.priority }));
};
