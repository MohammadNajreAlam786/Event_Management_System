import { toneClass } from '../../utils/badgeTones.js';

/**
 * Generic status pill — the shared rendering primitive behind every specific
 * badge in the app (EventStatusBadge, AttendanceStatusBadge, PriorityBadge,
 * SentimentBadge, ...). Those keep their own small, semantic prop APIs
 * (so every existing call site is untouched); they resolve a tone + label
 * and hand off rendering here, which is where the one visual definition of
 * "a badge" lives.
 *
 * A leading dot is opt-in (`dot`) for badges that want an extra non-colour-
 * only glance cue in dense tables; the text label is always the primary
 * signal either way.
 */
const Badge = ({ tone = 'slate', children, dot = false, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(tone)} ${className}`}
  >
    {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden="true" />}
    {children}
  </span>
);

export default Badge;
