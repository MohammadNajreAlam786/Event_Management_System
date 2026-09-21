import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import planningService from '../../../services/planningService.js';
import StatCard from '../../../components/StatCard.jsx';
import NeedsAttention from '../../../components/planning/NeedsAttention.jsx';
import UpcomingDeadlines from '../../../components/planning/UpcomingDeadlines.jsx';
import PlanningBadge from '../../../components/planning/PlanningBadge.jsx';
import ErrorBanner from '../../../components/ui/ErrorBanner.jsx';
import ProgressBar from '../../../components/ui/ProgressBar.jsx';
import { READINESS_STATUS_LABEL, READINESS_STATUS_TONE, money } from '../../../utils/planningMeta.js';

/**
 * Planning overview — a preparation summary answering "what still needs to be
 * done before my event?". Every figure comes from GET /planning/overview.
 */
const PlanningOverview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    planningService
      .getOverview(id)
      .then((d) => {
        if (!active) return;
        setData(d);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) return navigate('/login', { replace: true });
        setError(err.message || 'Could not load the planning overview.');
        setLoadState('error');
        return undefined;
      });
    return () => {
      active = false;
    };
  }, [id, navigate]);

  if (loadState === 'error') {
    return <ErrorBanner message={error} />;
  }

  const loading = loadState === 'loading';
  const base = `/organiser/events/${id}/planning`;

  const cards = [
    { label: 'Total tasks', value: data?.tasks.total ?? 0, accent: 'indigo' },
    { label: 'Completed tasks', value: data?.tasks.completed ?? 0, accent: 'emerald' },
    { label: 'Pending tasks', value: data?.tasks.pending ?? 0, accent: 'amber' },
    { label: 'Overdue tasks', value: data?.tasks.overdue ?? 0, accent: 'rose' },
    { label: 'Schedule items', value: data?.schedule.total ?? 0, accent: 'slate' },
    { label: 'Resource items', value: data?.resources.total ?? 0, accent: 'slate' },
    { label: 'Team members', value: data?.team.total ?? 0, accent: 'slate' },
    { label: 'Planned budget', value: loading ? 0 : money(data?.budget.estimated ?? 0), accent: 'indigo' },
  ];

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} loading={loading} accent={c.accent} />
        ))}
      </div>

      {!loading && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-500">Task completion</p>
              <p className="mt-1 text-3xl font-bold text-indigo-600">{data.progress.taskCompletion}%</p>
              <div className="mt-2">
                <ProgressBar value={data.progress.taskCompletion} />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {data.tasks.completed} of {data.tasks.total} tasks completed
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-500">Overall readiness</p>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-3xl font-bold text-slate-900">{data.readiness.overallScore}%</p>
                <PlanningBadge
                  tone={READINESS_STATUS_TONE[data.readiness.status]}
                  text={READINESS_STATUS_LABEL[data.readiness.status] ?? data.readiness.status}
                />
              </div>
              <Link to={`${base}/readiness`} className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline">
                See the breakdown →
              </Link>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-500">Budget</p>
              <dl className="mt-1 space-y-0.5 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Estimated</dt><dd className="font-medium">{money(data.budget.estimated)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Actual</dt><dd className="font-medium">{money(data.budget.actual)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Variance</dt><dd className="font-medium">{money(data.budget.variance)}</dd></div>
              </dl>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NeedsAttention items={data.needsAttention} />
            <UpcomingDeadlines items={data.upcomingDeadlines} />
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <Link to={`${base}/tasks`} className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">Manage tasks</Link>
            <Link to={`${base}/schedule`} className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">Build schedule</Link>
            <Link to={`${base}/resources`} className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">Plan resources</Link>
            <Link to={`${base}/budget`} className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">Plan budget</Link>
            <Link to={`${base}/team`} className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">Coordinate team</Link>
          </div>
        </>
      )}
    </section>
  );
};

export default PlanningOverview;
