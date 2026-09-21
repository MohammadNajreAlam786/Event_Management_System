import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import participantService from '../../services/participantService.js';
import EmptyState from '../../components/EmptyState.jsx';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import RegistrationStatusBadge from '../../components/event/RegistrationStatusBadge.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { formatDateTime } from '../../utils/eventMeta.js';

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'individual', label: 'Individual' },
  { value: 'team', label: 'Team' },
];

/** /organiser/events/:id/participants — the registrations for one owned event. */
const OrganiserEventParticipants = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    participantService
      .getEventRegistrations(id, { type: typeFilter })
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(
          err.status === 403
            ? 'You can only view participants for your own events.'
            : err.status === 404
              ? 'Event not found.'
              : err.message || 'Unable to load participants. Please try again.',
        );
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [id, navigate, typeFilter]);

  if (loadState === 'loading') {
    return <div className="h-48 animate-pulse rounded-lg bg-slate-100" />;
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

  const { event, summary, registrations } = data;

  return (
    <section className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to={`/organiser/events/${id}`} className="text-xs font-medium text-indigo-600 hover:underline">
            ← Event details
          </Link>
          <Link
            to={`/organiser/events/${id}/attendance`}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            Attendance →
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">{event.title}</h1>
          <EventStatusBadge status={event.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">Participants who have registered for this event.</p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
          <Icon name="check-circle" className="h-4 w-4 text-emerald-500" />
          <span className="font-semibold">{summary.registered}</span> registered
        </span>
        <span className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
          <Icon name="x-circle" className="h-4 w-4 text-slate-400" />
          <span className="font-semibold">{summary.cancelled}</span> cancelled
        </span>
        <span className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
          <Icon name="users" className="h-4 w-4 text-indigo-500" />
          {summary.capacity == null
            ? 'No capacity limit'
            : `${summary.spotsLeft} of ${summary.capacity} spots left`}
        </span>
        {summary.teams > 0 && (
          <span className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
            <Icon name="clipboard-list" className="h-4 w-4 text-violet-500" />
            <span className="font-semibold">{summary.teams}</span> teams
          </span>
        )}
      </div>

      {event.registrationType === 'TEAM' && (
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTypeFilter(f.value)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                typeFilter === f.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {registrations.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No participants yet"
              description="No participants have registered for this event yet."
              icon="users"
            />
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Participant</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3 font-medium">Cancelled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registrations.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 align-top font-medium text-slate-800">{r.participant.name}</td>
                  <td className="px-4 py-3 align-top text-slate-600">{r.participant.email ?? '—'}</td>
                  <td className="px-4 py-3 align-top text-slate-600">
                    {r.team ? (
                      <span>
                        <span className="font-medium text-slate-800">{r.team.name}</span>{' '}
                        <span className="text-xs text-slate-400">({r.team.teamId})</span>
                        {r.team.isLeader && (
                          <span className="ml-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                            Leader
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <RegistrationStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 align-top text-slate-500">{formatDateTime(r.registeredAt)}</td>
                  <td className="px-4 py-3 align-top text-slate-500">
                    {r.cancelledAt ? formatDateTime(r.cancelledAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default OrganiserEventParticipants;
