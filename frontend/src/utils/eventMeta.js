/**
 * Event status + category vocabulary, mirroring the backend enums exactly.
 * Admin and Organiser UIs both import from here so terminology never diverges.
 */
export const EVENT_STATUSES = ['DRAFT', 'PLANNED', 'UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'];

export const EVENT_STATUS_LABEL = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  UPCOMING: 'Upcoming',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const EVENT_CATEGORIES = [
  'WORKSHOP',
  'SEMINAR',
  'CONFERENCE',
  'HACKATHON',
  'CULTURAL',
  'SPORTS',
  'TECHNICAL',
  'ACADEMIC',
  'OTHER',
];

export const EVENT_CATEGORY_LABEL = Object.fromEntries(
  EVENT_CATEGORIES.map((c) => [c, c.charAt(0) + c.slice(1).toLowerCase()]),
);

/** Decorative header gradients keyed by event category — no image dependency. */
export const CATEGORY_GRADIENT = {
  WORKSHOP: 'from-indigo-600 via-indigo-700 to-blue-800',
  SEMINAR: 'from-violet-600 via-purple-700 to-indigo-800',
  CONFERENCE: 'from-sky-600 via-blue-700 to-indigo-900',
  HACKATHON: 'from-teal-600 via-emerald-700 to-cyan-900',
  CULTURAL: 'from-rose-600 via-pink-700 to-amber-700',
  SPORTS: 'from-amber-600 via-orange-600 to-rose-700',
  TECHNICAL: 'from-cyan-600 via-blue-600 to-indigo-800',
  ACADEMIC: 'from-slate-700 via-indigo-800 to-slate-900',
  OTHER: 'from-indigo-700 via-purple-700 to-pink-800',
};

/** Category icons matching Icon.jsx supported icon names. */
export const CATEGORY_ICON = {
  WORKSHOP: 'sparkles',
  SEMINAR: 'message-square',
  CONFERENCE: 'building',
  HACKATHON: 'layers',
  CULTURAL: 'star',
  SPORTS: 'trending-up',
  TECHNICAL: 'dashboard',
  ACADEMIC: 'file-text',
  OTHER: 'calendar-check',
};

/** Category accent colors for badges and tags. */
export const CATEGORY_ACCENT = {
  WORKSHOP: { text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  SEMINAR: { text: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  CONFERENCE: { text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  HACKATHON: { text: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  CULTURAL: { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  SPORTS: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  TECHNICAL: { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  ACADEMIC: { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  OTHER: { text: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
};

/** Format an ISO date for display. */
export const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/** Format an ISO date as DD-MM-YYYY (Phase 13 — public Home page event cards). */
export const formatDateDMY = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
};

/** Format an ISO datetime for display. */
export const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Convert an ISO string to the value a <input type="datetime-local"> expects
 * (local wall time, `YYYY-MM-DDTHH:mm`).
 */
export const toDatetimeLocalValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/**
 * Convert a datetime-local input value back to a full ISO (UTC) string so the
 * backend always receives an unambiguous instant. Empty input -> undefined.
 */
export const fromDatetimeLocalValue = (value) => {
  if (!value) return undefined;
  const d = new Date(value); // parsed in the browser's local timezone
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
};
