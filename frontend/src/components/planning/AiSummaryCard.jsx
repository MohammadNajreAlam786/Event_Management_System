import PlanningBadge from './PlanningBadge.jsx';
import Icon from '../ui/Icon.jsx';
import { READINESS_STATUS_LABEL, READINESS_STATUS_TONE } from '../../utils/planningMeta.js';

/**
 * AI Planning Summary card — the short overall read: summary sentence, the
 * (existing) readiness score explained, and the overall AI priority.
 */
const AiSummaryCard = ({ result }) => {
  const { summary, readinessAssessment, readiness, priority, basedOn, generatedAt } = result;
  const b = basedOn ?? {};

  return (
    <section className="rounded-lg border border-violet-100 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Icon name="sparkles" className="h-4 w-4 text-violet-500" />
          AI planning summary
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Overall priority</span>
          <PlanningBadge value={priority} />
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-700">{summary}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Current readiness</p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-2xl font-bold text-slate-900">{readiness?.overallScore ?? 0}%</span>
            {readiness?.status && (
              <PlanningBadge
                tone={READINESS_STATUS_TONE[readiness.status]}
                text={READINESS_STATUS_LABEL[readiness.status] ?? readiness.status}
              />
            )}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            This is the Phase 4 readiness score. The assistant explains it — it does not recalculate it.
          </p>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Analysed</p>
          <p className="mt-1 text-sm text-slate-600">
            {b.tasks ?? 0} tasks · {b.schedule ?? 0} schedule · {b.resources ?? 0} resources ·{' '}
            {b.budget ?? 0} budget · {b.team ?? 0} team
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Rule-based analysis of your planning data
            {generatedAt ? ` · ${new Date(generatedAt).toLocaleString()}` : ''}
          </p>
        </div>
      </div>

      {readinessAssessment && (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">Readiness assessment</p>
          <p className="mt-1 text-sm text-slate-600">{readinessAssessment}</p>
        </div>
      )}
    </section>
  );
};

export default AiSummaryCard;
