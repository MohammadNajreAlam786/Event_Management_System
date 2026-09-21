const LABELS = { 1: 'Very Poor', 2: 'Poor', 3: 'Average', 4: 'Good', 5: 'Excellent' };
const STARS = [1, 2, 3, 4, 5];

/**
 * 1–5 star rating.
 *
 *  - interactive (default): a real radiogroup — click or arrow-key a star.
 *  - readOnly: static display of a submitted rating.
 *
 * @param {{ value:number, onChange?:(n:number)=>void, readOnly?:boolean, size?:'sm'|'md' }} props
 */
const StarRating = ({ value = 0, onChange, readOnly = false, size = 'md' }) => {
  const starClass = size === 'sm' ? 'text-lg' : 'text-2xl';

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-1" aria-label={`Rating: ${value} out of 5`}>
        <span className={`${starClass} leading-none tracking-tight text-amber-500`} aria-hidden="true">
          {STARS.map((s) => (s <= value ? '★' : '☆')).join('')}
        </span>
        {LABELS[value] && <span className="text-xs font-medium text-slate-500">{LABELS[value]}</span>}
      </span>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Overall rating"
      className="inline-flex items-center gap-2"
    >
      <span className="inline-flex items-center">
        {STARS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            aria-label={`${s} star${s === 1 ? '' : 's'} — ${LABELS[s]}`}
            onClick={() => onChange?.(s)}
            className={`${starClass} px-0.5 leading-none transition-colors ${
              s <= value ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'
            } focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded`}
          >
            {s <= value ? '★' : '☆'}
          </button>
        ))}
      </span>
      <span className="min-w-[4.5rem] text-xs font-medium text-slate-500">
        {value ? LABELS[value] : 'Not rated'}
      </span>
    </div>
  );
};

export default StarRating;
