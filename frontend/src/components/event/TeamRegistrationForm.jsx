import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import participantService from '../../services/participantService.js';
import useAuthStore from '../../store/useAuthStore.js';
import ErrorBanner from '../ui/ErrorBanner.jsx';
import Icon from '../ui/Icon.jsx';

/**
 * Team registration (Phase 14) for a TEAM-configured event. Every member slot
 * beyond the leader is a real participant email — the backend resolves and
 * validates each one against an existing, active USER account; nothing here
 * invents a user id (§4).
 */
const TeamRegistrationForm = ({ event, onChanged }) => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const defaultSize = event.maxTeamSize ?? 2;

  const [teamName, setTeamName] = useState('');
  const [teamSize, setTeamSize] = useState(String(defaultSize));
  const [memberEmails, setMemberEmails] = useState(() => Array.from({ length: Math.max(0, defaultSize - 1) }, () => ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(null);

  const applySize = (value) => {
    setTeamSize(value);
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1) {
      setMemberEmails((prev) => {
        const wanted = Math.max(0, n - 1);
        const next = prev.slice(0, wanted);
        while (next.length < wanted) next.push('');
        return next;
      });
    }
  };

  const updateMember = (index) => (e) => {
    const value = e.target.value;
    setMemberEmails((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      const data = await participantService.registerTeam(event.id, {
        teamName,
        teamSize: Number(teamSize),
        memberEmails,
      });
      setSuccess(data.team);
      onChanged(data.event);
    } catch (err) {
      if (err.status === 401) return navigate('/login', { replace: true });
      setFieldErrors(err.fieldErrors ?? {});
      setError(err.message || 'Could not complete the team registration. Please try again.');
      return undefined;
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  if (success) {
    return (
      <div className="mt-3 space-y-3">
        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <Icon name="check-circle" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Team registration successful</p>
            <dl className="mt-2 space-y-0.5 text-emerald-900/90">
              <div><span className="text-emerald-700">Event: </span>{event.title}</div>
              <div><span className="text-emerald-700">Team name: </span>{success.name}</div>
              <div><span className="text-emerald-700">Team ID: </span>{success.teamId}</div>
              <div><span className="text-emerald-700">Team leader: </span>{success.leader.name}</div>
              <div>
                <span className="text-emerald-700">Team members: </span>
                {success.members.map((m) => `${m.name}${m.isLeader ? ' (leader)' : ''}`).join(', ')}
              </div>
              <div><span className="text-emerald-700">Status: </span>Registered</div>
            </dl>
          </div>
        </div>
        <Link
          to="/user/my-events"
          className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          View My Events
        </Link>
      </div>
    );
  }

  const err = (field) => fieldErrors?.[field];

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3" noValidate>
      {error && <ErrorBanner message={error} />}

      <div className="space-y-1">
        <label htmlFor="teamName" className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Team name
        </label>
        <input
          id="teamName"
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 ${
            err('teamName') ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
          }`}
          placeholder="e.g. Code Crushers"
        />
        {err('teamName') && <p className="text-xs text-rose-600">{err('teamName')}</p>}
      </div>

      <div className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Team leader</span>
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {user?.name} (you)
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="teamSize" className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Team size
        </label>
        <input
          id="teamSize"
          type="number"
          min="2"
          max={event.maxTeamSize ?? undefined}
          value={teamSize}
          onChange={(e) => applySize(e.target.value)}
          className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 ${
            err('teamSize') ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
          }`}
        />
        {err('teamSize') && <p className="text-xs text-rose-600">{err('teamSize')}</p>}
        {event.maxTeamSize != null && <p className="text-xs text-slate-400">Maximum {event.maxTeamSize} members.</p>}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Team members</span>
        <p className="text-sm text-slate-500">1. {user?.name} (leader)</p>
        {memberEmails.map((value, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-5 shrink-0 text-slate-400">{i + 2}.</span>
            <input
              type="email"
              value={value}
              onChange={updateMember(i)}
              placeholder="member@example.com"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        ))}
        {err('members') && <p className="text-xs text-rose-600">{err('members')}</p>}
        <p className="text-xs text-slate-400">
          Members must already have an EventFlow participant account.
        </p>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Registering…' : 'Register Team'}
      </button>
    </form>
  );
};

export default TeamRegistrationForm;
