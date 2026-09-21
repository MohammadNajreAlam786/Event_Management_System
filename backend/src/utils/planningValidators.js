import { TASK_STATUSES, TASK_PRIORITIES } from '../models/eventTask.model.js';
import { SCHEDULE_TYPES } from '../models/eventSchedule.model.js';
import { RESOURCE_STATUSES, RESOURCE_CATEGORIES } from '../models/eventResource.model.js';
import { BUDGET_STATUSES, BUDGET_CATEGORIES } from '../models/eventBudgetItem.model.js';
import { TEAM_STATUSES } from '../models/eventTeamMember.model.js';

/**
 * Dependency-free validation for planning input. Runs before Mongoose so the
 * API returns clear, field-level messages. Each function returns
 * { valid, errors } with `errors` keyed by field name.
 *
 * Every validator supports a `partial` mode (used by PATCH): only the
 * provided fields are checked, but a field that IS provided must be valid.
 */

const isStr = (v) => typeof v === 'string';
const nonEmpty = (v) => isStr(v) && v.trim().length > 0;
const provided = (v) => v !== undefined;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const collect = (errors) => ({ valid: Object.keys(errors).length === 0, errors });

export const validateTask = (data = {}, { partial = false } = {}) => {
  const e = {};
  if (!partial || provided(data.title)) {
    if (!nonEmpty(data.title)) e.title = 'Task title is required.';
    else if (data.title.trim().length > 200) e.title = 'Task title is too long (max 200).';
  }
  if (provided(data.priority) && !TASK_PRIORITIES.includes(String(data.priority).toUpperCase())) {
    e.priority = `Priority must be one of ${TASK_PRIORITIES.join(', ')}.`;
  }
  if (provided(data.status) && !TASK_STATUSES.includes(String(data.status).toUpperCase())) {
    e.status = `Status must be one of ${TASK_STATUSES.join(', ')}.`;
  }
  if (provided(data.dueDate) && data.dueDate !== null && data.dueDate !== '' && Number.isNaN(new Date(data.dueDate).getTime())) {
    e.dueDate = 'Due date is not a valid date.';
  }
  return collect(e);
};

export const validateSchedule = (data = {}, { partial = false } = {}) => {
  const e = {};
  if (!partial || provided(data.title)) {
    if (!nonEmpty(data.title)) e.title = 'Title is required.';
  }
  const start = provided(data.startTime) ? new Date(data.startTime) : null;
  const end = provided(data.endTime) ? new Date(data.endTime) : null;
  if (!partial || provided(data.startTime)) {
    if (!provided(data.startTime) || Number.isNaN(start?.getTime())) e.startTime = 'A valid start time is required.';
  } else if (provided(data.startTime) && Number.isNaN(start?.getTime())) {
    e.startTime = 'Start time is not a valid date.';
  }
  if (!partial || provided(data.endTime)) {
    if (!provided(data.endTime) || Number.isNaN(end?.getTime())) e.endTime = 'A valid end time is required.';
  } else if (provided(data.endTime) && Number.isNaN(end?.getTime())) {
    e.endTime = 'End time is not a valid date.';
  }
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
    e.endTime = 'End time must not be before the start time.';
  }
  if (provided(data.type) && !SCHEDULE_TYPES.includes(String(data.type).toUpperCase())) {
    e.type = `Type must be one of ${SCHEDULE_TYPES.join(', ')}.`;
  }
  return collect(e);
};

export const validateResource = (data = {}, { partial = false } = {}) => {
  const e = {};
  if (!partial || provided(data.name)) {
    if (!nonEmpty(data.name)) e.name = 'Resource name is required.';
  }
  if (provided(data.category) && !RESOURCE_CATEGORIES.includes(String(data.category).toUpperCase())) {
    e.category = `Category must be one of ${RESOURCE_CATEGORIES.join(', ')}.`;
  }
  if (provided(data.status) && !RESOURCE_STATUSES.includes(String(data.status).toUpperCase())) {
    e.status = `Status must be one of ${RESOURCE_STATUSES.join(', ')}.`;
  }
  if (provided(data.quantity) && data.quantity !== '' && data.quantity !== null) {
    const n = Number(data.quantity);
    if (!Number.isFinite(n) || n < 1) e.quantity = 'Quantity must be a positive number (at least 1).';
  }
  if (provided(data.estimatedUnitCost) && data.estimatedUnitCost !== '' && data.estimatedUnitCost !== null) {
    const n = Number(data.estimatedUnitCost);
    if (!Number.isFinite(n) || n < 0) e.estimatedUnitCost = 'Estimated cost cannot be negative.';
  }
  return collect(e);
};

export const validateBudgetItem = (data = {}, { partial = false } = {}) => {
  const e = {};
  if (!partial || provided(data.category)) {
    if (!nonEmpty(data.category)) e.category = 'Budget category is required.';
    else if (!BUDGET_CATEGORIES.includes(String(data.category).toUpperCase())) {
      e.category = `Category must be one of ${BUDGET_CATEGORIES.join(', ')}.`;
    }
  }
  if (provided(data.status) && !BUDGET_STATUSES.includes(String(data.status).toUpperCase())) {
    e.status = `Status must be one of ${BUDGET_STATUSES.join(', ')}.`;
  }
  for (const field of ['estimatedAmount', 'actualAmount']) {
    if (provided(data[field]) && data[field] !== '' && data[field] !== null) {
      const n = Number(data[field]);
      if (!Number.isFinite(n) || n < 0) e[field] = `${field === 'estimatedAmount' ? 'Estimated' : 'Actual'} amount cannot be negative.`;
    }
  }
  return collect(e);
};

export const validateTeamMember = (data = {}, { partial = false } = {}) => {
  const e = {};
  if (!partial || provided(data.name)) {
    if (!nonEmpty(data.name)) e.name = 'Team member name is required.';
  }
  if (provided(data.email) && nonEmpty(data.email) && !EMAIL.test(data.email.trim())) {
    e.email = 'Please provide a valid email address.';
  }
  if (provided(data.status) && !TEAM_STATUSES.includes(String(data.status).toUpperCase())) {
    e.status = `Status must be one of ${TEAM_STATUSES.join(', ')}.`;
  }
  return collect(e);
};

// re-export enum lists for controllers/tests
export {
  TASK_STATUSES,
  TASK_PRIORITIES,
  SCHEDULE_TYPES,
  RESOURCE_STATUSES,
  RESOURCE_CATEGORIES,
  BUDGET_STATUSES,
  BUDGET_CATEGORIES,
  TEAM_STATUSES,
};
