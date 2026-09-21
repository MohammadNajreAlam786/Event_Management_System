/**
 * Planning vocabulary — mirrors the backend enums exactly. Label maps make
 * `TODO` render as `To do`, etc. `tone` picks a badge colour.
 */
const humanise = (v) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED'];
export const TASK_STATUS_LABEL = { TODO: 'To do', IN_PROGRESS: 'In progress', COMPLETED: 'Completed' };
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const SCHEDULE_TYPES = ['SESSION', 'REGISTRATION', 'CEREMONY', 'BREAK', 'MEAL', 'WORKSHOP', 'OTHER'];

export const RESOURCE_STATUSES = ['REQUIRED', 'ORDERED', 'AVAILABLE', 'NOT_AVAILABLE'];
export const RESOURCE_CATEGORIES = [
  'EQUIPMENT', 'FURNITURE', 'TECHNICAL', 'STATIONERY', 'FOOD', 'TRANSPORT', 'DECORATION', 'OTHER',
];

export const BUDGET_STATUSES = ['PLANNED', 'APPROVED', 'PAID'];
export const BUDGET_CATEGORIES = [
  'VENUE', 'EQUIPMENT', 'FOOD', 'TRANSPORTATION', 'MARKETING', 'DECORATION', 'SPEAKERS', 'CERTIFICATES', 'MISCELLANEOUS',
];

export const TEAM_STATUSES = ['INVITED', 'CONFIRMED', 'ACTIVE', 'COMPLETED'];

export const label = (v) => humanise(String(v));

/** tone -> full Tailwind class string (kept literal for the scanner). */
export const BADGE_TONES = {
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const TONE_BY_VALUE = {
  // task status
  TODO: 'slate', IN_PROGRESS: 'sky', COMPLETED: 'emerald',
  // priority
  LOW: 'slate', MEDIUM: 'indigo', HIGH: 'amber', CRITICAL: 'rose',
  // resource status
  REQUIRED: 'slate', ORDERED: 'sky', AVAILABLE: 'emerald', NOT_AVAILABLE: 'rose',
  // budget status
  PLANNED: 'slate', APPROVED: 'sky', PAID: 'emerald',
  // team status
  INVITED: 'slate', CONFIRMED: 'sky', ACTIVE: 'emerald', /* COMPLETED handled above */
};

export const READINESS_STATUS_LABEL = {
  NOT_READY: 'Not ready',
  PARTIALLY_READY: 'Partially ready',
  MOSTLY_READY: 'Mostly ready',
  READY: 'Ready',
};
export const READINESS_STATUS_TONE = {
  NOT_READY: 'rose',
  PARTIALLY_READY: 'amber',
  MOSTLY_READY: 'sky',
  READY: 'emerald',
};

/** Format a currency-ish number (no locale symbol — an academic demo). */
export const money = (n) => (n == null ? '—' : Number(n).toLocaleString());
