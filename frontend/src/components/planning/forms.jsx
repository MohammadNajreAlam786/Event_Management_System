import PlanningForm from './PlanningForm.jsx';
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_PRIORITIES,
  SCHEDULE_TYPES,
  RESOURCE_STATUSES,
  RESOURCE_CATEGORIES,
  BUDGET_STATUSES,
  BUDGET_CATEGORIES,
  TEAM_STATUSES,
  label,
} from '../../utils/planningMeta.js';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../utils/eventMeta.js';

const opts = (arr, labeller = label) => arr.map((v) => ({ value: v, label: labeller(v) }));
const num = (v) => (v === '' || v === null || v === undefined ? '' : Number(v));
const nonNeg = (v, msg) => (v !== '' && Number(v) < 0 ? msg : undefined);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* --------------------------------------------------------------- Task */
export const TaskForm = (props) => (
  <PlanningForm
    {...props}
    fields={[
      { name: 'title', label: 'Title', type: 'text', required: true, colSpan: 2 },
      { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
      { name: 'priority', label: 'Priority', type: 'select', options: opts(TASK_PRIORITIES) },
      { name: 'status', label: 'Status', type: 'select', options: opts(TASK_STATUSES, (v) => TASK_STATUS_LABEL[v]) },
      { name: 'assignedTo', label: 'Assigned to', type: 'text', help: 'A name or label (optional)' },
      { name: 'dueDate', label: 'Due date', type: 'datetime-local' },
    ]}
    toInitial={(t) => ({
      title: t?.title ?? '',
      description: t?.description ?? '',
      priority: t?.priority ?? 'MEDIUM',
      status: t?.status ?? 'TODO',
      assignedTo: t?.assignedTo ?? '',
      dueDate: toDatetimeLocalValue(t?.dueDate),
    })}
    validate={(v) => {
      const e = {};
      if (!v.title.trim()) e.title = 'Title is required.';
      else if (v.title.trim().length < 2) e.title = 'Title must be at least 2 characters.';
      return e;
    }}
    toPayload={(v) => ({
      title: v.title.trim(),
      description: v.description.trim(),
      priority: v.priority,
      status: v.status,
      assignedTo: v.assignedTo.trim(),
      dueDate: v.dueDate ? fromDatetimeLocalValue(v.dueDate) : null,
    })}
  />
);

/* --------------------------------------------------------------- Schedule */
export const ScheduleForm = (props) => (
  <PlanningForm
    {...props}
    fields={[
      { name: 'title', label: 'Title', type: 'text', required: true, colSpan: 2 },
      { name: 'startTime', label: 'Start time', type: 'datetime-local', required: true },
      { name: 'endTime', label: 'End time', type: 'datetime-local', required: true },
      { name: 'type', label: 'Type', type: 'select', options: opts(SCHEDULE_TYPES) },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
    ]}
    toInitial={(s) => ({
      title: s?.title ?? '',
      startTime: toDatetimeLocalValue(s?.startTime),
      endTime: toDatetimeLocalValue(s?.endTime),
      type: s?.type ?? 'SESSION',
      location: s?.location ?? '',
      description: s?.description ?? '',
    })}
    validate={(v) => {
      const e = {};
      if (!v.title.trim()) e.title = 'Title is required.';
      if (!v.startTime) e.startTime = 'Start time is required.';
      if (!v.endTime) e.endTime = 'End time is required.';
      if (v.startTime && v.endTime && new Date(v.endTime) < new Date(v.startTime)) {
        e.endTime = 'End time must not be before the start time.';
      }
      return e;
    }}
    toPayload={(v) => ({
      title: v.title.trim(),
      startTime: fromDatetimeLocalValue(v.startTime),
      endTime: fromDatetimeLocalValue(v.endTime),
      type: v.type,
      location: v.location.trim(),
      description: v.description.trim(),
    })}
  />
);

/* --------------------------------------------------------------- Resource */
export const ResourceForm = (props) => (
  <PlanningForm
    {...props}
    fields={[
      { name: 'name', label: 'Name', type: 'text', required: true, colSpan: 2 },
      { name: 'category', label: 'Category', type: 'select', options: opts(RESOURCE_CATEGORIES) },
      { name: 'status', label: 'Status', type: 'select', options: opts(RESOURCE_STATUSES) },
      { name: 'quantity', label: 'Quantity', type: 'number', min: 1 },
      { name: 'unit', label: 'Unit', type: 'text', help: 'e.g. pcs, sets' },
      { name: 'estimatedUnitCost', label: 'Estimated unit cost', type: 'number', min: 0 },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 },
    ]}
    toInitial={(r) => ({
      name: r?.name ?? '',
      category: r?.category ?? 'OTHER',
      status: r?.status ?? 'REQUIRED',
      quantity: r?.quantity ?? 1,
      unit: r?.unit ?? '',
      estimatedUnitCost: r?.estimatedUnitCost ?? 0,
      notes: r?.notes ?? '',
    })}
    validate={(v) => {
      const e = {};
      if (!v.name.trim()) e.name = 'Name is required.';
      if (v.quantity !== '' && Number(v.quantity) < 1) e.quantity = 'Quantity must be at least 1.';
      const c = nonNeg(v.estimatedUnitCost, 'Cost cannot be negative.');
      if (c) e.estimatedUnitCost = c;
      return e;
    }}
    toPayload={(v) => ({
      name: v.name.trim(),
      category: v.category,
      status: v.status,
      quantity: num(v.quantity) || 1,
      unit: v.unit.trim(),
      estimatedUnitCost: num(v.estimatedUnitCost) || 0,
      notes: v.notes.trim(),
    })}
  />
);

/* --------------------------------------------------------------- Budget */
export const BudgetForm = (props) => (
  <PlanningForm
    {...props}
    fields={[
      { name: 'category', label: 'Category', type: 'select', required: true, options: opts(BUDGET_CATEGORIES) },
      { name: 'status', label: 'Status', type: 'select', options: opts(BUDGET_STATUSES) },
      { name: 'estimatedAmount', label: 'Estimated amount', type: 'number', min: 0 },
      { name: 'actualAmount', label: 'Actual amount', type: 'number', min: 0, help: 'Leave blank until known' },
      { name: 'description', label: 'Description', type: 'text', colSpan: 2 },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 },
    ]}
    toInitial={(b) => ({
      category: b?.category ?? 'MISCELLANEOUS',
      status: b?.status ?? 'PLANNED',
      estimatedAmount: b?.estimatedAmount ?? 0,
      actualAmount: b?.actualAmount == null ? '' : b.actualAmount,
      description: b?.description ?? '',
      notes: b?.notes ?? '',
    })}
    validate={(v) => {
      const e = {};
      const a = nonNeg(v.estimatedAmount, 'Estimated amount cannot be negative.');
      if (a) e.estimatedAmount = a;
      const b = nonNeg(v.actualAmount, 'Actual amount cannot be negative.');
      if (b) e.actualAmount = b;
      return e;
    }}
    toPayload={(v) => ({
      category: v.category,
      status: v.status,
      estimatedAmount: num(v.estimatedAmount) || 0,
      actualAmount: v.actualAmount === '' ? null : num(v.actualAmount),
      description: v.description.trim(),
      notes: v.notes.trim(),
    })}
  />
);

/* --------------------------------------------------------------- Team member */
export const TeamMemberForm = (props) => (
  <PlanningForm
    {...props}
    fields={[
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'role', label: 'Role', type: 'text', help: 'e.g. Registration Coordinator' },
      { name: 'status', label: 'Status', type: 'select', options: opts(TEAM_STATUSES) },
      { name: 'responsibility', label: 'Responsibility', type: 'textarea', colSpan: 2, help: 'What this person is responsible for' },
    ]}
    toInitial={(m) => ({
      name: m?.name ?? '',
      email: m?.email ?? '',
      role: m?.role ?? '',
      status: m?.status ?? 'INVITED',
      responsibility: m?.responsibility ?? '',
    })}
    validate={(v) => {
      const e = {};
      if (!v.name.trim()) e.name = 'Name is required.';
      if (v.email.trim() && !EMAIL.test(v.email.trim())) e.email = 'Enter a valid email address.';
      return e;
    }}
    toPayload={(v) => ({
      name: v.name.trim(),
      email: v.email.trim(),
      role: v.role.trim(),
      status: v.status,
      responsibility: v.responsibility.trim(),
    })}
  />
);
