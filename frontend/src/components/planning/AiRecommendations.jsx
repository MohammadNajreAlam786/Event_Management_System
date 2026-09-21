import PlanningBadge from './PlanningBadge.jsx';
import AiCategoryTag from './AiCategoryTag.jsx';
import Icon from '../ui/Icon.jsx';

/**
 * AI Recommendations — informational only (Phase 5). Ordered most-important
 * first. Each item explains what, why, and a suggested action the organiser
 * can choose to take manually; nothing is applied automatically.
 */
const AiRecommendations = ({ items = [] }) => (
  <section className="rounded-lg border border-violet-100 bg-white p-4 sm:p-5">
    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
      <Icon name="clipboard-check" className="h-4 w-4 text-violet-500" />
      AI recommendations
    </h3>
    <p className="mt-0.5 text-sm text-slate-500">Ordered by importance — work from the top down.</p>

    {items.length === 0 ? (
      <p className="mt-3 text-sm text-emerald-700">
        No preparation gaps were found in the current plan.
      </p>
    ) : (
      <ol className="mt-4 space-y-3">
        {items.map((r, i) => (
          <li
            key={`${r.category}-${r.title}-${i}`}
            className="rounded-md border border-slate-200 p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <PlanningBadge value={r.priority} />
              <AiCategoryTag value={r.category} />
              <span className="font-medium text-slate-900">{r.title}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{r.description}</p>
            <div className="mt-2 space-y-1 text-sm">
              <p className="text-slate-600">
                <span className="font-medium text-slate-500">Why: </span>
                {r.reason}
              </p>
              <p className="text-slate-600">
                <span className="font-medium text-slate-500">Suggested action: </span>
                {r.suggestedAction}
              </p>
            </div>
          </li>
        ))}
      </ol>
    )}
  </section>
);

export default AiRecommendations;
