const COLORS = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
};

/** Coerce anything non-finite / negative to a safe non-negative number (Issue 9). */
const safe = (n) => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/**
 * A small, dependency-free horizontal bar chart.
 *
 * Every bar carries a visible text label and a visible numeric value, so the
 * chart never relies on colour alone (§42). The coloured bar itself is
 * decorative (`aria-hidden`); the data is the `label — value` text.
 *
 * Defensive against bad data (Issue 9): non-finite / negative values and maxes
 * are treated as 0, bar widths are clamped to [0, 100] %, and an all-empty
 * dataset renders a graceful message instead of broken bars.
 *
 * @param {{
 *   title?: string,
 *   caption?: string,
 *   bars: { label: string, value: number, max?: number, display?: string, color?: keyof typeof COLORS }[],
 *   emptyMessage?: string,
 * }} props
 */
const BarChart = ({ title, caption, bars = [], emptyMessage }) => {
  const safeBars = (Array.isArray(bars) ? bars : []).map((b) => ({
    ...b,
    value: safe(b.value),
    max: b.max === undefined || b.max === null ? undefined : safe(b.max),
  }));

  const overallMax = Math.max(1, ...safeBars.map((b) => (typeof b.max === 'number' ? b.max : b.value)));
  const hasData = safeBars.some((b) => b.value > 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
      {caption && <p className="mt-0.5 text-xs text-slate-500">{caption}</p>}

      {safeBars.length === 0 || (!hasData && emptyMessage) ? (
        <p className="mt-3 text-sm text-slate-400">{emptyMessage || 'No data to display.'}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {safeBars.map((b, i) => {
            const max = typeof b.max === 'number' && b.max > 0 ? b.max : overallMax;
            const raw = max > 0 ? (b.value / max) * 100 : 0;
            const pct = Math.max(0, Math.min(100, Number.isFinite(raw) ? Math.round(raw) : 0));
            const width = pct > 0 ? pct : b.value > 0 ? 3 : 0;
            const shown = b.display ?? (Number.isFinite(Number(b.value)) ? b.value : 0);
            return (
              // eslint-disable-next-line react/no-array-index-key
              <li key={`${b.label}-${i}`} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-slate-600">{b.label}</span>
                <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <span
                    className={`block h-full rounded-full ${COLORS[b.color] ?? COLORS.indigo}`}
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right font-semibold text-slate-800">{shown}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default BarChart;
