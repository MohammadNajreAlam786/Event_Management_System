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
  WORKSHOP: 'from-indigo-500 to-blue-500',
  SEMINAR: 'from-violet-500 to-purple-600',
  CONFERENCE: 'from-sky-500 to-cyan-500',
  HACKATHON: 'from-sky-500 to-cyan-500',
  CULTURAL: 'from-rose-500 to-orange-500',
  SPORTS: 'from-rose-500 to-orange-500',
  TECHNICAL: 'from-indigo-500 to-blue-500',
  ACADEMIC: 'from-violet-500 to-purple-600',
  OTHER: 'from-emerald-500 to-teal-500',
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
