import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';

import eventService from '../services/eventService.js';
import EventStatusBadge from '../components/EventStatusBadge.jsx';
import PlanningSubNav from '../components/planning/PlanningSubNav.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import { formatDateTime } from '../utils/eventMeta.js';

/**
 * Shell for /organiser/events/:id/planning/* . Loads the event once (for the
 * always-visible header: name, date, status) and renders the tab bar + the
 * active planning page via <Outlet context={{ event }} />.
 */
const PlanningWorkspaceLayout = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    eventService
      .getEvent(id)
      .then((data) => {
        if (!active) return;
        setEvent(data);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Could not open this planning workspace.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [id, navigate]);

  const base = `/organiser/events/${id}/planning`;

  if (loadState === 'loading') {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div className="h-6 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-52 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }
  if (loadState === 'error') {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Link to="/organiser/events" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to My Events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/organiser/events/${id}`} className="text-xs font-medium text-indigo-600 hover:underline">
            ← Event overview
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{event.title}</h1>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="text-sm text-slate-500">
            {formatDateTime(event.startDate)} — {formatDateTime(event.endDate)}
          </p>
        </div>
      </div>

      <PlanningSubNav base={base} />

      <Outlet context={{ event }} />
    </div>
  );
};

export default PlanningWorkspaceLayout;
