import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import adminService from '../../services/adminService.js';
import analyticsService from '../../services/analyticsService.js';
import StatCard from '../../components/StatCard.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import BarChart from '../../components/analytics/BarChart.jsx';
import AnalyticsView from '../../components/analytics/AnalyticsView.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { EVENT_STATUS_LABEL } from '../../utils/eventMeta.js';

const fileNameFor = (title) =>
  `${String(title || 'Event').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'Event'}_Report.pdf`;

/** /admin/statistics — a basic platform roll-up plus per-event analytics for any event. */
const AdminStatistics = () => {
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [summaryState, setSummaryState] = useState('loading');

  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  const [analytics, setAnalytics] = useState(null);
  const [analyticsState, setAnalyticsState] = useState('idle');
  const [analyticsError, setAnalyticsError] = useState('');

  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([analyticsService.getPlatformSummary(), adminService.getEvents({ limit: 100 })])
      .then(([s, ev]) => {
        if (!active) return;
        setSummary(s);
        setEvents(ev.events);
        setSummaryState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setSummaryState('error');
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  const loadAnalytics = useCallback(
    (id) => {
      if (!id) {
        setAnalytics(null);
        setAnalyticsState('idle');
        return;
      }
      setAnalyticsState('loading');
      setAnalyticsError('');
      setReportError('');
      analyticsService
        .getEventAnalytics(id)
        .then((data) => {
          setAnalytics(data);
          setAnalyticsState('ready');
        })
        .catch((err) => {
          if (err.status === 401) {
            navigate('/login', { replace: true });
            return;
          }
          setAnalyticsError(
            err.status === 404 ? 'Event not found.' : err.message || 'Unable to load analytics. Please try again.',
          );
          setAnalyticsState('error');
        });
    },
    [navigate],
  );

  useEffect(() => loadAnalytics(selectedId), [selectedId, loadAnalytics]);

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

  if (summaryState === 'loading') {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        ))}
      </div>
    );
  }

  if (summaryState === 'error') {
    return <ErrorBanner message="Unable to load platform statistics. Please refresh the page." />;
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Statistics"
        description="A basic platform roll-up, plus post-event analytics for any single event."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Events" value={summary.events.total} accent="indigo" icon="calendar" />
        <StatCard label="Completed events" value={summary.events.completed} accent="emerald" icon="calendar-check" />
        <StatCard label="Cancelled events" value={summary.events.cancelled} accent="rose" icon="x-circle" />
        <StatCard label="Upcoming / ongoing" value={summary.events.upcoming + summary.events.ongoing} accent="slate" icon="clock" />
        <StatCard label="Registrations" value={summary.totalRegistrations} accent="indigo" icon="users" />
        <StatCard label="Attendees" value={summary.totalAttendees} accent="emerald" icon="check-circle" />
        <StatCard label="Feedback responses" value={summary.feedback.total} accent="amber" icon="message-square" />
        <StatCard
          label="Average rating"
          value={summary.feedback.averageRating != null ? `${summary.feedback.averageRating} / 5` : '—'}
          accent="amber"
          icon="star"
        />
      </div>

      {summary.sentiment.analyzed > 0 && (
        <BarChart
          title="Platform sentiment (all analysed feedback)"
          caption={`${summary.sentiment.analyzed} analysed · ${summary.certificatesIssued} certificates issued`}
          bars={[
            { label: 'Positive', value: summary.sentiment.positive, max: summary.sentiment.analyzed, display: `${summary.sentiment.positive} (${summary.sentiment.positivePct}%)`, color: 'emerald' },
            { label: 'Neutral', value: summary.sentiment.neutral, max: summary.sentiment.analyzed, display: `${summary.sentiment.neutral} (${summary.sentiment.neutralPct}%)`, color: 'slate' },
            { label: 'Negative', value: summary.sentiment.negative, max: summary.sentiment.analyzed, display: `${summary.sentiment.negative} (${summary.sentiment.negativePct}%)`, color: 'rose' },
          ]}
        />
      )}

      <div className="border-t border-slate-200 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="admin-analytics-event" className="text-sm font-medium text-slate-700">
            Event analytics
          </label>
          <select
            id="admin-analytics-event"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-w-[16rem] max-w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">— choose an event —</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} — {EVENT_STATUS_LABEL[e.status] ?? e.status}
                {e.organiser?.name ? ` (${e.organiser.name})` : ''}
              </option>
            ))}
          </select>
        </div>

        {events.length === 0 && (
          <div className="mt-4">
            <EmptyState title="No events on the platform" description="Event analytics will be available once organisers create events." icon="calendar" />
          </div>
        )}

        {analyticsState === 'loading' && (
          <div className="mt-4 h-48 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        )}

        {analyticsState === 'error' && (
          <div className="mt-4">
            <ErrorBanner message={analyticsError} onRetry={() => loadAnalytics(selectedId)} />
          </div>
        )}

        {analyticsState === 'ready' && analytics && (
          <div className="mt-4">
            <AnalyticsView
              analytics={analytics}
              onDownloadReport={analytics.analyticsAvailable ? doDownload : undefined}
              reportBusy={reportBusy}
              reportError={reportError}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminStatistics;
