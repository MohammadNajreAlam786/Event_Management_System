import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import participantService from '../../services/participantService.js';
import EventCard from '../../components/event/EventCard.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABEL } from '../../utils/eventMeta.js';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 400;

/** /user/events — participant event discovery. */
const BrowseEvents = () => {
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    let active = true;
    setLoadState('loading');
    setError('');
    participantService
      .getEvents({
        search: search || undefined,
        category: category || undefined,
        upcoming: upcomingOnly || undefined,
        page,
        limit: PAGE_SIZE,
      })
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
        setError(err.message || 'Unable to load events. Please try again.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [search, category, upcomingOnly, page, navigate]);

  useEffect(() => load(), [load, reloadKey]);

  const events = data?.events ?? [];
  const pagination = data?.pagination;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Browse events</h1>
        <p className="mt-0.5 text-sm text-slate-500">Find events you can attend and register online.</p>
      </div>

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
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All categories</option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EVENT_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={upcomingOnly}
            onChange={(e) => {
              setUpcomingOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Upcoming only
        </label>
      </div>

      {loadState === 'error' && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {loadState === 'loading' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-52 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {loadState === 'ready' && events.length === 0 && (
        <EmptyState
          title="No events found"
          description={
            search || category || upcomingOnly
              ? 'No events match your search or filters. Try clearing them.'
              : 'No upcoming events are currently available. Please check back later.'
          }
          icon="calendar"
        />
      )}

      {loadState === 'ready' && events.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      )}

      {loadState === 'ready' && pagination && pagination.totalEvents > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.totalEvents} event
            {pagination.totalEvents === 1 ? '' : 's'}
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
    </section>
  );
};

export default BrowseEvents;
