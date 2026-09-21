import SectionHeader from '../ui/SectionHeader.jsx';
import Icon from '../ui/Icon.jsx';

/**
 * "Needs attention" list — real, derived planning issues. When empty it
 * shows the on-track message (never fabricated items).
 */
const NeedsAttention = ({ items = [] }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <SectionHeader icon="alert-triangle" title="Needs attention" />
    {items.length === 0 ? (
      <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700">
        <Icon name="check-circle" className="h-4 w-4 shrink-0" />
        Everything is on track.
      </p>
    ) : (
      <ul className="mt-2 space-y-1.5">
        {items.map((it) => (
          <li key={it.type} className="flex items-center gap-2 text-sm text-slate-700">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
            {it.message}
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default NeedsAttention;
