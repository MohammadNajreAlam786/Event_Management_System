import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import eventService from '../../services/eventService.js';
import StatCard from '../../components/StatCard.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Icon from '../../components/ui/Icon.jsx';

/**
 * Organiser overview: per-status event counts, all from the backend
 * (GET /api/events/my/stats). No hardcoded numbers; 0 when there are no events.
 */
const OrganiserDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    eventService
      .getMyEventStats()
      .then((data) => {
        if (!active) return;
        setStats(data);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Failed to load your dashboard.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (loadState === 'error') {
    return <ErrorBanner message={error} />;
  }

  const loading = loadState === 'loading';
  const cards = [
    { label: 'Total Events', value: stats?.total ?? 0, accent: 'indigo', icon: 'layers' },
    { label: 'Draft Events', value: stats?.draft ?? 0, accent: 'slate', icon: 'file-text' },
    { label: 'Planned Events', value: stats?.planned ?? 0, accent: 'indigo', icon: 'clipboard-list' },
    { label: 'Upcoming Events', value: stats?.upcoming ?? 0, accent: 'amber', icon: 'clock' },
    { label: 'Ongoing Events', value: stats?.ongoing ?? 0, accent: 'emerald', icon: 'trending-up' },
    { label: 'Completed Events', value: stats?.completed ?? 0, accent: 'slate', icon: 'calendar-check' },
    { label: 'Cancelled Events', value: stats?.cancelled ?? 0, accent: 'rose', icon: 'x-circle' },
  ];

  return (
    <section className="space-y-8">
      <PageHeader
        title="Your events"
        description="A snapshot of the events you organise."
        actions={
          <Link
            to="/organiser/events/create"
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Icon name="plus" className="h-4 w-4" />
            Create event
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} loading={loading} accent={c.accent} icon={c.icon} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link
          to="/organiser/events"
          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
            <Icon name="clipboard-list" className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Manage events</p>
            <p className="text-xs text-slate-500">Plan tasks, schedule, resources, budget and team.</p>
          </div>
        </Link>
        <Link
          to="/organiser/analytics"
          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
            <Icon name="chart-bar" className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">View analytics</p>
            <p className="text-xs text-slate-500">Registration, attendance and feedback for completed events.</p>
          </div>
        </Link>
        <Link
          to="/organiser/improvements"
          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/40"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-600">
            <Icon name="sparkles" className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">AI improvements</p>
            <p className="text-xs text-slate-500">Data-grounded recommendations for your next event.</p>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default OrganiserDashboard;
