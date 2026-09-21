import { formatDateTime } from '../../utils/eventMeta.js';
import PlanningBadge from './PlanningBadge.jsx';
import SectionHeader from '../ui/SectionHeader.jsx';

const relative = (iso) => {
  const days = Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
};

/** Next task deadlines (incomplete, due today or later), soonest first. */
const UpcomingDeadlines = ({ items = [] }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <SectionHeader icon="calendar" title="Upcoming deadlines" />
    {items.length === 0 ? (
      <p className="mt-2 text-sm text-slate-500">No upcoming task deadlines.</p>
    ) : (
      <ol className="mt-2 space-y-2">
        {items.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-slate-700">
              <PlanningBadge value={t.priority} />
              {t.title}
            </span>
            <span className="whitespace-nowrap text-xs text-slate-400" title={formatDateTime(t.dueDate)}>
              {relative(t.dueDate)}
            </span>
          </li>
        ))}
      </ol>
    )}
  </div>
);

export default UpcomingDeadlines;
