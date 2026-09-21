import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import eventService from '../../services/eventService.js';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import Icon from '../../components/ui/Icon.jsx';
import {
  EVENT_STATUSES,
  EVENT_STATUS_LABEL,
  formatDateTime,
} from '../../utils/eventMeta.js';

const Detail = ({ label, icon, children }) => (
  <div>
    <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {label}
    </dt>
    <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
  </div>
);

const ACTIONS = [
  { to: 'participants', label: 'Participants', icon: 'users' },
  { to: 'attendance', label: 'Attendance', icon: 'qr-code' },
  { to: 'certificates', label: 'Certificates', icon: 'award' },
  { to: 'feedback', label: 'Feedback', icon: 'message-square' },
];

/** Full details for one owned event + status control + delete + planning entry point. */
const OrganiserEventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [statusValue, setStatusValue] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = () => {
    setLoadState('loading');
    eventService
      .getEvent(id)
      .then((data) => {
        setEvent(data);
        setStatusValue(data.status);
        setLoadState('ready');
      })
      .catch((err) => {
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Could not load this event.');
        setLoadState('error');
      });
  };

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyStatus = async () => {
    if (!statusValue || statusValue === event.status) return;
    setStatusBusy(true);
    setStatusError('');
    try {
      const updated = await eventService.updateEventStatus(id, statusValue);
      setEvent(updated);
    } catch (err) {
      setStatusError(err.message || 'Could not update the status.');
      setStatusValue(event.status);
    } finally {
      setStatusBusy(false);
    }
  };

  const doDelete = async () => {
    setDeleteBusy(true);
    try {
      await eventService.deleteEvent(id);
      navigate('/organiser/events', { replace: true });
    } catch (err) {
      setStatusError(err.message || 'Could not delete the event.');
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  };

  if (loadState === 'loading') {
    return <div className="h-48 animate-pulse rounded-lg bg-slate-100" />;
  }
  if (loadState === 'error') {
    return <ErrorBanner message={error} />;
  }

  const organiserName = typeof event.organiser === 'object' ? event.organiser?.name : event.organiser;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">{event.title}</h2>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{event.category}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/organiser/events/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <Icon name="clipboard" className="h-4 w-4" />
            Edit
          </Link>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            <Icon name="x-circle" className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {statusError && <ErrorBanner message={statusError} />}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={`/organiser/events/${id}/${a.to}`}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-3 text-center transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <Icon name={a.icon} className="h-4 w-4" />
            </span>
            <span className="text-xs font-medium text-slate-700">{a.label}</span>
          </Link>
        ))}
      </div>

      {event.status === 'COMPLETED' && (
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/organiser/analytics?event=${id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            <Icon name="chart-bar" className="h-4 w-4" />
            View Analytics
          </Link>
          <Link
            to={`/organiser/improvements?event=${id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
          >
            <Icon name="sparkles" className="h-4 w-4" />
            View Improvements
          </Link>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Detail label="Description">
              <span className="whitespace-pre-wrap">{event.description}</span>
            </Detail>
          </div>
          <Detail label="Venue" icon="map-pin">{event.venue}</Detail>
          <Detail label="Organiser" icon="user">{organiserName}</Detail>
          <Detail label="Starts" icon="calendar">{formatDateTime(event.startDate)}</Detail>
          <Detail label="Ends" icon="calendar">{formatDateTime(event.endDate)}</Detail>
          <Detail label="Registration opens" icon="clock">{formatDateTime(event.registrationStartDate)}</Detail>
          <Detail label="Registration closes" icon="clock">{formatDateTime(event.registrationEndDate)}</Detail>
          <Detail label="Maximum participants" icon="users">{event.maxParticipants ?? '—'}</Detail>
          <Detail label="Registration type" icon="clipboard-list">
            {event.registrationType === 'TEAM' ? `Team (max ${event.maxTeamSize ?? '—'})` : 'Individual'}
          </Detail>
          <Detail label="Created" icon="clock">{formatDateTime(event.createdAt)}</Detail>
          {event.image && (
            <div className="sm:col-span-2">
              <Detail label="Image">
                <a href={event.image} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                  {event.image}
                </a>
              </Detail>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-800">Status</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EVENT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyStatus}
            disabled={statusBusy || statusValue === event.status}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {statusBusy ? 'Updating…' : 'Update status'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-indigo-600">
              <Icon name="clipboard-list" className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Pre-event planning</h3>
              <p className="mt-1 text-sm text-slate-600">
                Tasks, schedule, resources, budget, team and a readiness score for this event.
              </p>
            </div>
          </div>
          <Link
            to={`/organiser/events/${id}/planning`}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Open Planning Workspace
          </Link>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete event"
          message={`Delete "${event.title}"? It will be removed from your events.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={doDelete}
        />
      )}
    </section>
  );
};

export default OrganiserEventDetails;
