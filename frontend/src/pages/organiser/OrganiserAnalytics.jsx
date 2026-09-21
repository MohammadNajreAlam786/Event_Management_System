import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import eventService from '../../services/eventService.js';
import analyticsService from '../../services/analyticsService.js';
import EmptyState from '../../components/EmptyState.jsx';
import AnalyticsView from '../../components/analytics/AnalyticsView.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { EVENT_STATUS_LABEL } from '../../utils/eventMeta.js';

const fileNameFor = (title) =>
  `${String(title || 'Event').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'Event'}_Report.pdf`;

/** Order events for the selector: completed first, then the rest, each newest-first. */
const sortForSelector = (events) => {
  const rank = (s) => (s === 'COMPLETED' ? 0 : s === 'CANCELLED' ? 2 : 1);
  return [...events].sort(
    (a, b) => rank(a.status) - rank(b.status) || new Date(b.startDate) - new Date(a.startDate),
  );
};

/** /organiser/analytics — pick one of the organiser's own events and view its post-event analytics. */
const OrganiserAnalytics = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('event') || '';

  const [events, setEvents] = useState([]);
  const [eventsState, setEventsState] = useState('loading'); // loading | ready | error

  const [analytics, setAnalytics] = useState(null);
  const [analyticsState, setAnalyticsState] = useState('idle'); // idle | loading | ready | error
  const [analyticsError, setAnalyticsError] = useState('');

  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');

  // Load the organiser's own events for the selector.
  useEffect(() => {
    let active = true;
    setEventsState('loading');
    eventService
      .getMyEvents({ limit: 100 })
      .then((data) => {
        if (!active) return;
        setEvents(sortForSelector(data.events));
        setEventsState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setEventsState('error');
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  // Load analytics for the selected event (one request per selection — §78).
  const loadAnalytics = useCallback(
    (eventId) => {
      if (!eventId) {
        setAnalytics(null);
        setAnalyticsState('idle');
        return;
      }
      let active = true;
      setAnalyticsState('loading');
      setAnalyticsError('');
      setReportError('');
      analyticsService
        .getEventAnalytics(eventId)
        .then((data) => {
          if (!active) return;
          setAnalytics(data);
          setAnalyticsState('ready');
        })
        .catch((err) => {
          if (!active) return;
          if (err.status === 401) {
            navigate('/login', { replace: true });
            return;
          }
          setAnalyticsError(
            err.status === 403
              ? 'You can only view analytics for your own events.'
              : err.status === 404
                ? 'Event not found.'
                : err.message || 'Unable to load analytics. Please try again.',
          );
          setAnalyticsState('error');
        });
      return () => {
        active = false;
      };
    },
    [navigate],
  );

  useEffect(() => loadAnalytics(selectedId), [selectedId, loadAnalytics]);

  const onSelect = (id) => {
    if (id) setParams({ event: id });
    else setParams({});
  };

  const doDownload = async () => {
    setReportBusy(true);
    setReportError('');
    try {
      await analyticsService.downloadReport(selectedId, fileNameFor(analytics?.event?.title));
    } catch (err) {
      setReportError(err.message || 'Could not generate the report.');
    } finally {
      setReportBusy(false);
    }
  };

  const doPreview = async () => {
    setReportBusy(true);
    setReportError('');
    try {
      await analyticsService.openReport(selectedId);
    } catch (err) {
      setReportError(err.message || 'Could not open the report.');
    } finally {
      setReportBusy(false);
    }
  };

  const selectorOptions = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        label: `${e.title} — ${EVENT_STATUS_LABEL[e.status] ?? e.status}`,
      })),
    [events],
  );

  return (
    <section className="space-y-5">
      <PageHeader
        title="Event analytics"
        description="Post-event statistics for your events — registrations, attendance, feedback, sentiment and certificates."
      />

      {eventsState === 'error' && <ErrorBanner message="Unable to load your events. Please refresh the page." />}

      {eventsState === 'ready' && events.length === 0 && (
        <EmptyState
          title="No events yet"
          description="Create an event and run it to completion — its analytics will appear here."
          icon="chart-bar"
        />
      )}

      {eventsState === 'ready' && events.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="analytics-event" className="text-sm font-medium text-slate-700">
            Select event
          </label>
          <select
            id="analytics-event"
            value={selectedId}
            onChange={(e) => onSelect(e.target.value)}
            className="min-w-[16rem] max-w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">— choose an event —</option>
            {selectorOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {analyticsState === 'loading' && (
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
            ))}
          </div>
          <div className="h-40 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        </div>
      )}

      {analyticsState === 'error' && <ErrorBanner message={analyticsError} onRetry={() => loadAnalytics(selectedId)} />}

      {analyticsState === 'ready' && analytics && (
        <AnalyticsView
          analytics={analytics}
          onDownloadReport={analytics.analyticsAvailable ? doDownload : undefined}
          onOpenReport={analytics.analyticsAvailable ? doPreview : undefined}
          reportBusy={reportBusy}
          reportError={reportError}
          feedbackHref={`/organiser/events/${analytics.event.id}/feedback`}
        />
      )}
    </section>
  );
};

export default OrganiserAnalytics;
