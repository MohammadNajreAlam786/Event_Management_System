import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import participantService from '../../services/participantService.js';
import ConfirmDialog from '../ConfirmDialog.jsx';
import ErrorBanner from '../ui/ErrorBanner.jsx';
import SectionHeader from '../ui/SectionHeader.jsx';
import Icon from '../ui/Icon.jsx';
import TeamRegistrationForm from './TeamRegistrationForm.jsx';
import { formatDateTime } from '../../utils/eventMeta.js';

/**
 * The register / registered / cancel state machine for one event (Phase 6).
 * Informational actions only — no AI, no QR. `onChanged` is called with the
 * fresh event object so the parent can re-render.
 */
const RegistrationPanel = ({ event, onChanged }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  const myStatus = event.myRegistration?.status;
  const registrable = Boolean(event.registration?.registrable);
  const reason = event.registration?.reason;
  const isTeamEvent = event.registrationType === 'TEAM';
  const myTeam = event.myRegistration?.team ?? null;

  const handleRegister = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { event: updated } = await participantService.register(event.id);
      setJustRegistered(true);
      onChanged(updated);
    } catch (err) {
      if (err.status === 401) return navigate('/login', { replace: true });
      setError(err.message || 'Could not complete your registration. Please try again.');
      return undefined;
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const handleCancel = async () => {
    setBusy(true);
    setError('');
    try {
      await participantService.cancelRegistration(event.myRegistration.id);
      setConfirmCancel(false);
      setJustRegistered(false);
      const fresh = await participantService.getEvent(event.id);
      onChanged(fresh);
    } catch (err) {
      if (err.status === 401) return navigate('/login', { replace: true });
      setConfirmCancel(false);
      setError(err.message || 'Could not cancel your registration. Please try again.');
      return undefined;
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  /** Team leader only — cancels the whole team, not just the caller's own row. */
  const handleCancelTeam = async () => {
    setBusy(true);
    setError('');
    try {
      await participantService.cancelTeamRegistration(myTeam.teamId);
      setConfirmCancel(false);
      setJustRegistered(false);
      const fresh = await participantService.getEvent(event.id);
      onChanged(fresh);
    } catch (err) {
      if (err.status === 401) return navigate('/login', { replace: true });
      setConfirmCancel(false);
      setError(err.message || 'Could not cancel the team registration. Please try again.');
      return undefined;
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <SectionHeader icon="clipboard-check" title="Registration" />

      {error && (
        <div className="mt-2">
          <ErrorBanner message={error} />
        </div>
      )}

      {myStatus === 'REGISTERED' ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <Icon name="check-circle" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
            <p className="font-medium">
              {justRegistered ? 'Registration successful.' : "You're registered for this event."}
            </p>
            <dl className="mt-2 space-y-0.5 text-emerald-900/90">
              <div><span className="text-emerald-700">Event: </span>{event.title}</div>
              <div><span className="text-emerald-700">When: </span>{formatDateTime(event.startDate)}</div>
              <div><span className="text-emerald-700">Where: </span>{event.venue}</div>
              {myTeam && <div><span className="text-emerald-700">Team: </span>{myTeam.name} ({myTeam.teamId}){myTeam.isLeader ? ' — you are the leader' : ''}</div>}
              <div><span className="text-emerald-700">Status: </span>Registered</div>
            </dl>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/user/my-events"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              View My Events
            </Link>
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              disabled={busy}
              className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              {myTeam ? (myTeam.isLeader ? 'Cancel Team Registration' : 'Leave Team') : 'Cancel Registration'}
            </button>
          </div>
        </div>
      ) : registrable && isTeamEvent ? (
        <TeamRegistrationForm event={event} onChanged={onChanged} />
      ) : registrable ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-slate-600">
            {myStatus === 'CANCELLED'
              ? 'You previously cancelled. You can register again while this event is open.'
              : 'Spots are open. Register to confirm your place.'}
          </p>
          <button
            type="button"
            onClick={handleRegister}
            disabled={busy}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Registering…' : myStatus === 'CANCELLED' ? 'Register Again' : 'Register Now'}
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-400"
          >
            Registration unavailable
          </button>
          <p className="mt-2 text-sm text-slate-500">{reason || 'Registration is not open for this event.'}</p>
          {myStatus === 'CANCELLED' && (
            <p className="mt-1 text-xs text-slate-400">Your previous registration for this event is cancelled.</p>
          )}
        </div>
      )}

      {confirmCancel && (
        <ConfirmDialog
          title={myTeam?.isLeader ? 'Cancel team registration' : myTeam ? 'Leave team' : 'Cancel registration'}
          message={
            myTeam?.isLeader
              ? `Are you sure you want to cancel your whole team's ("${myTeam.name}") registration for "${event.title}"? This cancels every member's registration.`
              : myTeam
                ? `Are you sure you want to leave team "${myTeam.name}" for "${event.title}"?`
                : `Are you sure you want to cancel your registration for "${event.title}"?`
          }
          confirmLabel={myTeam?.isLeader ? 'Cancel team registration' : myTeam ? 'Leave team' : 'Cancel registration'}
          busy={busy}
          onCancel={() => setConfirmCancel(false)}
          onConfirm={myTeam?.isLeader ? handleCancelTeam : handleCancel}
        />
      )}
    </div>
  );
};

export default RegistrationPanel;
