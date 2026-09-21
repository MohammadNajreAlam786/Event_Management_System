import PlanningBadge from './PlanningBadge.jsx';
import AiCategoryTag from './AiCategoryTag.jsx';
import Icon from '../ui/Icon.jsx';

// Border tint by severity — uses the project's existing warning/error colours.
const BORDER_BY_SEVERITY = {
  CRITICAL: 'border-rose-300',
  HIGH: 'border-amber-300',
  MEDIUM: 'border-slate-200',
  LOW: 'border-slate-200',
};

/**
 * Potential Risks — planning risks the analysis found, most severe first. Each
 * carries a suggested mitigation. Informational; nothing is changed for you.
 */
const AiRisks = ({ items = [] }) => (
  <section className="rounded-lg border border-violet-100 bg-white p-4 sm:p-5">
    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
      <Icon name="alert-triangle" className="h-4 w-4 text-violet-500" />
      Potential risks
    </h3>
    <p className="mt-0.5 text-sm text-slate-500">Things that could go wrong, with a way to reduce each.</p>

    {items.length === 0 ? (
      <p className="mt-3 text-sm text-emerald-700">No significant planning risks were identified.</p>
    ) : (
      <ol className="mt-4 space-y-3">
        {items.map((r, i) => (
          <li
            key={`${r.category}-${r.title}-${i}`}
            className={`rounded-md border p-3 sm:p-4 ${BORDER_BY_SEVERITY[r.severity] ?? 'border-slate-200'}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <PlanningBadge value={r.severity} />
              <AiCategoryTag value={r.category} />
              <span className="font-medium text-slate-900">{r.title}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{r.description}</p>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-500">Mitigation: </span>
              {r.mitigation}
            </p>
          </li>
        ))}
      </ol>
    )}
  </section>
);

export default AiRisks;
