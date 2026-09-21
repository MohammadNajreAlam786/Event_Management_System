import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import participantService from '../../services/participantService.js';
import EmptyState from '../../components/EmptyState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import RegistrationStatusBadge from '../../components/event/RegistrationStatusBadge.jsx';
import AttendanceStatusBadge from '../../components/attendance/AttendanceStatusBadge.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import { formatDate, formatDateTime } from '../../utils/eventMeta.js';

const CANCELLABLE_EVENT = (s) => s !== 'COMPLETED' && s !== 'CANCELLED';

/** /user/my-events — the participant's own registrations. */
const MyEvents = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [confirm, setConfirm] = useState(null); // registration row | null
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => {
    let active = true;
    setLoadState('loading');
    setError('');
    participantService
      .getMyRegistrations()
      .then((data) => {
        if (!active) return;
        setRows(data);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Unable to load your registrations. Please try again.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => load(), [load, reloadKey]);

  const doCancel = async () => {
    if (!confirm) return;
    setBusyId(confirm.id);
    setActionError('');
    try {
      if (confirm.team?.isLeader) {
        await participantService.cancelTeamRegistration(confirm.team.teamId);
      } else {
        await participantService.cancelRegistration(confirm.id);
      }
      setConfirm(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setActionError(err.message || 'Could not cancel this registration.');
      setConfirm(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900">My events</h1>
        <p className="mt-0.5 text-sm text-slate-500">Events you have registered for.</p>
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      {loadState === 'error' && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {loadState === 'loading' && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-20 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {loadState === 'ready' && rows.length === 0 && (
        <EmptyState
          title="No registrations yet"
          description="You haven't registered for any events yet. Browse events to find something to attend."
          icon="calendar"
        />
      )}

      {loadState === 'ready' && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((r) => {
            const canCancel = r.status === 'REGISTERED' && CANCELLABLE_EVENT(r.event.status) && !r.event.isDeleted;
            return (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{r.event.title}</span>
                    <EventStatusBadge status={r.event.status} />
                    <RegistrationStatusBadge status={r.status} />
                    {r.attendance?.status === 'PRESENT' && <AttendanceStatusBadge status="PRESENT" />}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                      {r.team ? 'Team Event' : 'Individual Event'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDateTime(r.event.startDate)} · {r.event.venue}
                  </p>
                  {r.team && (
                    <p className="mt-1 text-xs text-slate-500">
                      Team <span className="font-medium text-slate-700">{r.team.name}</span> ({r.team.teamId}) ·{' '}
                      {r.team.members.length} members
                      {r.team.isLeader ? ' · you are the leader' : ''}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {r.status === 'CANCELLED' && r.cancelledAt
                      ? `Cancelled ${formatDate(r.cancelledAt)}`
                      : r.attendance?.status === 'PRESENT'
                        ? `Checked in ${formatDateTime(r.attendance.checkedInAt)}`
                        : `Registered ${formatDate(r.registeredAt)}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {r.status === 'REGISTERED' && !r.event.isDeleted && (
                    <Link
                      to={`/user/my-events/${r.id}/qr`}
                      className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      Attendance QR
                    </Link>
                  )}
                  {r.event.status === 'COMPLETED' && r.attendance?.status === 'PRESENT' && (
                    <Link
                      to="/user/certificates"
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Certificate
                    </Link>
                  )}
                  {r.event.status === 'COMPLETED' && r.attendance?.status === 'PRESENT' && (
                    <Link
                      to={`/user/feedback/${r.event.id}`}
                      className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      Feedback
                    </Link>
                  )}
                  {!r.event.isDeleted && (
                    <Link
                      to={`/user/events/${r.event.id}`}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      View event
                    </Link>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setConfirm(r)}
                      className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {r.team ? (r.team.isLeader ? 'Cancel team registration' : 'Leave team') : 'Cancel registration'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.team?.isLeader ? 'Cancel team registration' : confirm.team ? 'Leave team' : 'Cancel registration'}
          message={
            confirm.team?.isLeader
              ? `Are you sure you want to cancel your whole team's ("${confirm.team.name}") registration for "${confirm.event.title}"? This cancels every member's registration.`
              : confirm.team
                ? `Are you sure you want to leave team "${confirm.team.name}" for "${confirm.event.title}"?`
                : `Are you sure you want to cancel your registration for "${confirm.event.title}"?`
          }
          confirmLabel={confirm.team?.isLeader ? 'Cancel team registration' : confirm.team ? 'Leave team' : 'Cancel registration'}
          busy={busyId === confirm.id}
          onCancel={() => setConfirm(null)}
          onConfirm={doCancel}
        />
      )}
    </section>
  );
};

export default MyEvents;
