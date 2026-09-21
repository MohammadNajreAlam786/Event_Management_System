import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import attendanceService from '../../services/attendanceService.js';
import StatCard from '../../components/StatCard.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import RegistrationStatusBadge from '../../components/event/RegistrationStatusBadge.jsx';
import AttendanceStatusBadge from '../../components/attendance/AttendanceStatusBadge.jsx';
import QrScanner from '../../components/attendance/QrScanner.jsx';
import ScanResultCard from '../../components/attendance/ScanResultCard.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { formatDateTime } from '../../utils/eventMeta.js';

/**
 * Attendance scanning is only ever meaningful while an event is actually in
 * progress (Phase 13) — the scanner component (and therefore any camera
 * permission prompt or manual-entry fallback) must not even mount for any
 * other status. The backend independently enforces the same ONGOING-only
 * rule on the check-in endpoint, so this is UX, not the only guard.
 */
const NOT_OPEN_MESSAGE = {
  DRAFT: 'Attendance is not open yet. QR check-in will be available when this event is ongoing.',
  PLANNED: 'Attendance is not open yet. QR check-in will be available when this event is ongoing.',
  UPCOMING: 'Attendance is not open yet. QR check-in will be available when this event is ongoing.',
  COMPLETED: 'Attendance is closed because this event has ended.',
  CANCELLED: 'Attendance is unavailable because this event was cancelled.',
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'present', label: 'Present' },
  { value: 'not_checked_in', label: 'Not checked in' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** /organiser/events/:id/attendance — QR check-in + attendance dashboard for an owned event. */
const OrganiserEventAttendance = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const inFlight = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    (opts = {}) => {
      const quiet = opts.quiet === true;
      if (!quiet) setLoadState('loading');
      attendanceService
        .getEventAttendance(id, { status: filter, search: debouncedSearch })
        .then((res) => {
          setData(res);
          setLoadState('ready');
        })
        .catch((err) => {
          if (err.status === 401) {
            navigate('/login', { replace: true });
            return;
          }
          setError(
            err.status === 403
              ? 'You can only view attendance for your own events.'
              : err.status === 404
                ? 'Event not found.'
                : err.message || 'Unable to load attendance. Please try again.',
          );
          setLoadState('error');
        });
    },
    [id, filter, debouncedSearch, navigate],
  );

  useEffect(() => load(), [load]);

  const handleDownloadAttendance = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    try {
      await attendanceService.exportAttendance(id);
    } catch (err) {
      if (err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setExportError(err.message || 'Could not download the attendance sheet. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleScan = useCallback(
    async (text) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setVerifying(true);
      try {
        const outcome = await attendanceService.checkIn(id, text);
        if (outcome.ok) {
          setResult({
            kind: 'success',
            participantName: outcome.data.participant.name,
            checkedInAt: outcome.data.attendance.checkedInAt,
          });
        } else {
          setResult({
            kind: 'already',
            participantName: outcome.data.participant?.name ?? 'Participant',
            checkedInAt: outcome.data.attendance?.checkedInAt ?? null,
          });
        }
        load({ quiet: true });
      } catch (err) {
        setResult({
          kind: 'invalid',
          message:
            err.status == null
              ? 'Unable to verify attendance. Check your connection and try again.'
              : err.message || 'This QR code could not be verified.',
        });
      } finally {
        setVerifying(false);
        inFlight.current = false;
      }
    },
    [id, load],
  );

  if (loadState === 'loading') {
    return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;
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

  const { event, summary, rows, recentCheckIns } = data;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/organiser/events/${id}`} className="text-xs font-medium text-indigo-600 hover:underline">
            ← Event details
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{event.title}</h1>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Scan participant QR codes and track event-day attendance.</p>
        </div>
        <button
          type="button"
          onClick={handleDownloadAttendance}
          disabled={exporting}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon name="download" className="h-4 w-4" />
          {exporting ? 'Preparing…' : 'Download Attendance'}
        </button>
      </div>

      {exportError && <ErrorBanner message={exportError} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Registered" value={summary.registered} accent="indigo" icon="users" />
        <StatCard label="Present" value={summary.present} accent="emerald" icon="check-circle" />
        <StatCard label="Not checked in" value={summary.notCheckedIn} accent="amber" icon="clock" />
        <StatCard label="Attendance" value={`${summary.attendancePercentage}%`} accent="slate" icon="trending-up" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
          <SectionHeader icon="qr-code" title="Scan QR" />
          {event.status === 'ONGOING' ? (
            <>
              <p className="mt-0.5 text-xs text-slate-500">
                Use the device camera, or enter a participant&apos;s code manually.
              </p>
              <div className="mt-4">
                <QrScanner onDetected={handleScan} busy={verifying} />
              </div>
              {result && (
                <div className="mt-4">
                  <ScanResultCard result={result} eventTitle={event.title} />
                </div>
              )}
            </>
          ) : (
            <div className="mt-3 flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <Icon name="qr-code" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>{NOT_OPEN_MESSAGE[event.status] ?? 'Attendance is not available for this event right now.'}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <SectionHeader icon="clock" title="Recent check-ins" />
          {recentCheckIns.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No participants have checked in yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentCheckIns.map((c, i) => (
                <li key={`${c.name}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{c.name}</span>
                  <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                    {formatDateTime(c.checkedInAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  filter === f.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:max-w-xs"
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          {rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nothing to show"
                description={
                  debouncedSearch || filter !== 'all'
                    ? 'No participants match this filter.'
                    : 'No participants have registered for this event yet.'
                }
                icon="qr-code"
              />
            </div>
          ) : (
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Participant</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Registration</th>
                  <th className="px-4 py-3 font-medium">Attendance</th>
                  <th className="px-4 py-3 font-medium">Checked in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.registrationId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 align-top font-medium text-slate-800">{r.participant.name}</td>
                    <td className="px-4 py-3 align-top text-slate-600">{r.participant.email ?? '—'}</td>
                    <td className="px-4 py-3 align-top">
                      <RegistrationStatusBadge status={r.registrationStatus} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <AttendanceStatusBadge status={r.attendance?.status} />
                    </td>
                    <td className="px-4 py-3 align-top text-slate-500">
                      {r.attendance ? formatDateTime(r.attendance.checkedInAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
};

export default OrganiserEventAttendance;
