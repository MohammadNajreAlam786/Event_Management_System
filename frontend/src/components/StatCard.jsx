import Icon from './ui/Icon.jsx';

// Full class strings (not interpolated) so Tailwind's scanner picks them up.
const ACCENT_TEXT = {
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
  violet: 'text-violet-600',
  slate: 'text-slate-700',
};
const ACCENT_ICON_BG = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600',
};

/**
 * Dashboard summary card. Pass `loading` while the value is being fetched so
 * the card never flashes a stale/zero value. `icon` (an Icon name) and
 * `hint` (a short supporting description) are optional — every existing
 * call site that omits them still renders exactly the same layout as before.
 */
const StatCard = ({ label, value, loading, accent = 'indigo', icon, hint }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]">
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      {icon && (
        <span className={`shrink-0 rounded-md p-1.5 ${ACCENT_ICON_BG[accent] ?? ACCENT_ICON_BG.indigo}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      )}
    </div>
    {loading ? (
      <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-100" aria-hidden="true" />
    ) : (
      <p className={`mt-1 text-3xl font-bold ${ACCENT_TEXT[accent] ?? ACCENT_TEXT.indigo}`}>{value}</p>
    )}
    {hint && !loading && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
  </div>
);

export default StatCard;
