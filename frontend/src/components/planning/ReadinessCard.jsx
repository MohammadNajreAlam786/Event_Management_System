import PlanningBadge from './PlanningBadge.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';
import { READINESS_STATUS_LABEL, READINESS_STATUS_TONE } from '../../utils/planningMeta.js';

const COMPONENT_LABEL = {
  tasks: 'Tasks',
  schedule: 'Schedule',
  resources: 'Resources',
  budget: 'Budget',
  team: 'Team',
};

/**
 * Event readiness — a single score + its component breakdown. Explicitly a
 * planning indicator, not a guarantee of success.
 */
const ReadinessCard = ({ readiness, compact = false }) => {
  if (!readiness) return null;
  const { overallScore, status, components, detail, weights } = readiness;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Event readiness</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{overallScore}%</p>
        </div>
        <PlanningBadge tone={READINESS_STATUS_TONE[status]} text={READINESS_STATUS_LABEL[status] ?? status} />
      </div>

      <p className="mt-2 text-xs text-slate-400">
        A planning indicator based on your data — not a guarantee the event will succeed.
      </p>

      <div className="mt-4 space-y-3">
        {Object.keys(COMPONENT_LABEL).map((key) => {
          const d = detail?.[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {COMPONENT_LABEL[key]}
                  {weights?.[key] != null && !compact && (
                    <span className="ml-1 text-xs text-slate-400">(weight {weights[key]}%)</span>
                  )}
                </span>
                <span className="text-slate-500">
                  {d ? `${d.done}/${d.total} · ` : ''}
                  {components[key]}%
                </span>
              </div>
              <div className="mt-1">
                <ProgressBar value={components[key]} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReadinessCard;
