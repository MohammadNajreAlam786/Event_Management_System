import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import adminService from '../../services/adminService.js';
import StatCard from '../../components/StatCard.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Icon from '../../components/ui/Icon.jsx';

const formatTimeAgo = (iso) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/**
 * Admin overview: real database-derived summary cards + a small "recent
 * activity" feed built from the most recently created accounts. Event
 * figures are 0 until events exist — never invented.
 */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    adminService
      .getDashboardStats()
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
        setError(err.message || 'Failed to load dashboard statistics.');
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
    { label: 'Total Users', value: stats?.totalUsers ?? 0, accent: 'indigo', icon: 'users' },
    { label: 'Total Organisers', value: stats?.totalOrganisers ?? 0, accent: 'indigo', icon: 'building' },
    { label: 'Total Events', value: stats?.totalEvents ?? 0, accent: 'slate', icon: 'calendar' },
    { label: 'Active Events', value: stats?.activeEvents ?? 0, accent: 'emerald', icon: 'trending-up' },
    { label: 'Completed Events', value: stats?.completedEvents ?? 0, accent: 'slate', icon: 'calendar-check' },
    { label: 'Cancelled Events', value: stats?.cancelledEvents ?? 0, accent: 'rose', icon: 'x-circle' },
  ];

  return (
    <section className="space-y-8">
      <PageHeader title="Platform overview" description="A live snapshot of accounts and events across the system." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} loading={loading} accent={card.accent} icon={card.icon} />
        ))}
      </div>

      {(stats?.totalEvents ?? 0) === 0 && !loading && (
        <p className="text-xs text-slate-400">No events on the platform yet.</p>
      )}

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Icon name="clock" className="h-4 w-4 text-slate-400" />
          Recent activity
        </h2>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : stats?.recentActivity?.length ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {stats.recentActivity.map((item, i) => (
              <li key={`${item.at}-${i}`} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-slate-700">{item.message}</span>
                <span className="text-xs text-slate-400">{formatTimeAgo(item.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No recent activity" description="New registrations will appear here." icon="inbox" />
        )}
      </div>
    </section>
  );
};

export default AdminDashboard;
