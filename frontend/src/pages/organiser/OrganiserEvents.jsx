import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import eventService from '../../services/eventService.js';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EVENT_STATUSES, EVENT_STATUS_LABEL, formatDate } from '../../utils/eventMeta.js';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

/** My Events — the authenticated organiser's own events only (backend-scoped). */
const OrganiserEvents = () => {
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

  const [confirmDelete, setConfirmDelete] = useState(null); // event | null
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
    eventService
      .getMyEvents({ search: search || undefined, status: status || undefined, page, limit: PAGE_SIZE })
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
        setError(err.message || 'Failed to load your events.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [search, status, page, reloadKey, navigate]);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    setActionError('');
    try {
      await eventService.deleteEvent(confirmDelete.id);
      setConfirmDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setActionError(err.message || 'Failed to delete the event.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="My Events"
        description="Events you own. Only you can edit or delete them."
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title…"
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
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Venue</th>
              <th className="px-4 py-3 font-medium">Start</th>
              <th className="px-4 py-3 font-medium">End</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loadState === 'loading' &&
              Array.from({ length: 4 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={i}>
                  <td className="px-4 py-3" colSpan={8}>
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))}

            {loadState === 'ready' &&
              events.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{ev.title}</td>
                  <td className="px-4 py-3 text-slate-600">{ev.category}</td>
                  <td className="px-4 py-3 text-slate-600">{ev.venue}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(ev.startDate)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(ev.endDate)}</td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={ev.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(ev.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/organiser/events/${ev.id}`}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        View
                      </Link>
                      {ev.status === 'COMPLETED' && (
                        <Link
                          to={`/organiser/analytics?event=${ev.id}`}
                          className="rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          Analytics
                        </Link>
                      )}
                      <Link
                        to={`/organiser/events/${ev.id}/edit`}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === ev.id}
                        onClick={() => setConfirmDelete(ev)}
                        className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Delete
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
              title="No events yet"
              description="Create your first event to start planning. It will be saved as a draft."
              icon="calendar-plus"
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

      {confirmDelete && (
        <ConfirmDialog
          title="Delete event"
          message={`Delete "${confirmDelete.title}"? It will be removed from your events. This cannot be undone from the interface.`}
          confirmLabel="Delete"
          busy={busyId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={doDelete}
        />
      )}
    </section>
  );
};

export default OrganiserEvents;
