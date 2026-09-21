const TONES = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
};

/** A simple, safe (clamped, zero/NaN-proof) percentage bar. */
const ProgressBar = ({ value, tone = 'indigo', className = '' }) => {
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full ${TONES[tone] ?? TONES.indigo}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export default ProgressBar;
