import PriorityBadge from './PriorityBadge.jsx';
import ConfidenceBadge from './ConfidenceBadge.jsx';
import Icon from '../ui/Icon.jsx';

const CATEGORY_LABEL = {
  SCHEDULING: 'Scheduling',
  CAPACITY_PLANNING: 'Capacity Planning',
  REGISTRATION_MANAGEMENT: 'Registration Management',
  ATTENDANCE_IMPROVEMENT: 'Attendance Improvement',
  VENUE_AND_RESOURCES: 'Venue & Resources',
  VOLUNTEER_AND_TEAM: 'Volunteer & Team Planning',
  BUDGET_AND_COST: 'Budget & Cost Planning',
  FEEDBACK_AND_EXPERIENCE: 'Feedback & Participant Experience',
  CERTIFICATE_AND_POST_EVENT: 'Certificates & Post-Event',
};

/** "attendanceRate" -> "Attendance rate" */
const humanize = (key) => {
  const spaced = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const formatValue = (v) => {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
};

/**
 * One AI-generated, data-grounded recommendation: category, priority, the
 * action, why (reason + evidence), the expected (non-guaranteed) benefit, and
 * the evidence strength. `onToggleChecklist` + `checked` wire it into the
 * organiser's optional, purely client-side improvement checklist.
 */
const RecommendationCard = ({ item, checked, onToggleChecklist }) => (
  <li className="rounded-lg border border-slate-200 border-l-4 border-l-violet-400 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {CATEGORY_LABEL[item.category] ?? item.category}
        </span>
        <h4 className="mt-1.5 font-semibold text-slate-900">{item.title}</h4>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <PriorityBadge priority={item.priority} />
        <ConfidenceBadge confidence={item.confidence} />
      </div>
    </div>

    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{item.recommendation}</p>
    <p className="mt-1.5 whitespace-pre-wrap break-words text-xs text-slate-500">
      <span className="font-medium text-slate-600">Why: </span>
      {item.reason}
    </p>
    {item.expectedBenefit && (
      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-500">
        <span className="font-medium text-slate-600">Possible benefit: </span>
        {item.expectedBenefit}
      </p>
    )}

    {item.evidence && Object.keys(item.evidence).length > 0 && (
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
        {Object.entries(item.evidence).map(([k, v]) => (
          <div key={k} className="flex gap-1">
            <dt className="text-slate-400">{humanize(k)}:</dt>
            <dd className="font-medium text-slate-700">{formatValue(v)}</dd>
          </div>
        ))}
      </dl>
    )}

    {item.sourceMetrics?.length > 0 && (
      <p className="mt-1.5 flex items-start gap-1 break-words text-[11px] text-slate-400">
        <Icon name="file-text" className="mt-0.5 h-3 w-3 shrink-0" />
        Source: {item.sourceMetrics.join(', ')}
      </p>
    )}

    {onToggleChecklist && (
      <label className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2 text-xs font-medium text-slate-600">
        <input type="checkbox" checked={checked} onChange={onToggleChecklist} className="h-3.5 w-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
        Add to checklist
      </label>
    )}
  </li>
);

export default RecommendationCard;
