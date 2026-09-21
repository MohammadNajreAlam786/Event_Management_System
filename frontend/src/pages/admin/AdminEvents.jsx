import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import adminService from '../../services/adminService.js';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EVENT_STATUSES, EVENT_STATUS_LABEL, formatDate } from '../../utils/eventMeta.js';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

/**
 * Platform-wide event oversight. Real events from every organiser. Admin can
 * cancel an event (status -> CANCELLED); it is never deleted.
 */
const AdminEvents = () => {
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, totalEvents: 0, totalPages: 1 });
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');

  const [confirmCancel, setConfirmCancel] = useState(null); // event | null
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    setError('');
    adminService
      .getEvents({ search: search || undefined, status: status || undefined, page, limit: PAGE_SIZE })
      .then((data) => {
        if (!active) return;
        setEvents(data.events);
        setPagination(data.pagination);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Failed to load events.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [search, status, page, reloadKey, navigate]);

  const applyLocal = (id, next) => setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: next } : e)));

  const doCancel = async () => {
    if (!confirmCancel) return;
    setBusyId(confirmCancel.id);
    setActionError('');
    try {
      await adminService.updateEventStatus(confirmCancel.id, 'CANCELLED');
      applyLocal(confirmCancel.id, 'CANCELLED');
      setConfirmCancel(null);
    } catch (err) {
      setActionError(err.message || 'Failed to cancel the event.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Events"
        description="Every event on the platform. Cancelling sets the status — it does not delete."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title or venue…"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          {EVENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {EVENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      {loadState === 'error' && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Organiser</th>
              <th className="px-4 py-3 font-medium">Venue</th>
              <th className="px-4 py-3 font-medium">Start date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loadState === 'loading' &&
              Array.from({ length: 4 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={i}>
                  <td className="px-4 py-3" colSpan={6}>
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))}

            {loadState === 'ready' &&
              events.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{ev.title}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {ev.organiser?.name}
                    <span className="block text-xs text-slate-400">{ev.organiser?.email}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{ev.venue}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(ev.startDate)}</td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={ev.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busyId === ev.id || ev.status === 'CANCELLED'}
                        onClick={() => setConfirmCancel(ev)}
                        className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {ev.status === 'CANCELLED' ? 'Cancelled' : 'Cancel event'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {loadState === 'ready' && events.length === 0 && (
          <div className="p-4">
            <EmptyState
              title="No events match"
              description="No events on the platform yet, or none match your filters."
              icon="calendar"
            />
          </div>
        )}
      </div>

      {loadState === 'ready' && pagination.totalEvents > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.totalEvents} total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="Cancel event"
          message={`Are you sure you want to cancel "${confirmCancel.title}" by ${confirmCancel.organiser?.name}? The event is kept but its status becomes CANCELLED.`}
          confirmLabel="Cancel event"
          busy={busyId === confirmCancel.id}
          onCancel={() => setConfirmCancel(null)}
          onConfirm={doCancel}
        />
      )}
    </section>
  );
};

export default AdminEvents;
