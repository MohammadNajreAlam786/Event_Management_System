import StatCard from '../StatCard.jsx';
import EventStatusBadge from '../EventStatusBadge.jsx';
import EmptyState from '../EmptyState.jsx';
import BarChart from './BarChart.jsx';
import ErrorBanner from '../ui/ErrorBanner.jsx';
import SectionHeader from '../ui/SectionHeader.jsx';
import Icon from '../ui/Icon.jsx';
import { formatDate } from '../../utils/eventMeta.js';

/**
 * Renders an event analytics view from the object returned by
 * analyticsService.getEventAnalytics. Shared by the organiser analytics page
 * and the admin statistics page — the only difference is who can reach it.
 *
 * Which view is shown follows the BACKEND's explicit `analyticsStatus` (Issue 2
 * / Issue 6) — the frontend never re-derives availability from the event status:
 *  - CANCELLED event      → a clear cancelled state (registration data only).
 *  - NOT_AVAILABLE (else)  → "not yet available" notice + current registration count.
 *  - PARTIAL (ONGOING)     → an "in progress" notice + registrations + check-ins so far.
 *  - AVAILABLE (COMPLETED) → the full analytics + charts + summary + report action.
 *
 * @param {{
 *   analytics: object,
 *   onDownloadReport?: () => void,
 *   onOpenReport?: () => void,
 *   reportBusy?: boolean,
 *   reportError?: string,
 *   feedbackHref?: string,
 * }} props
 */
const AnalyticsView = ({ analytics, onDownloadReport, onOpenReport, reportBusy, reportError, feedbackHref }) => {
  const a = analytics;
  const { event } = a;
  const status = a.analyticsStatus ?? (a.analyticsAvailable ? 'AVAILABLE' : 'NOT_AVAILABLE');

  const Header = (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-lg font-bold text-slate-900">{event.title}</h2>
      <EventStatusBadge status={event.status} />
      <span className="text-sm text-slate-500">{formatDate(event.startDate)}</span>
    </div>
  );

  if (event.status === 'CANCELLED') {
    return (
      <section className="space-y-4">
        {Header}
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <Icon name="x-circle" className="h-4 w-4 shrink-0" />
          Event Cancelled — this event did not take place. No performance metrics are calculated.
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Registrations before cancellation" value={a.registrations.total} accent="slate" icon="users" />
          <StatCard label="Cancelled registrations" value={a.registrations.cancelled} accent="slate" icon="x-circle" />
        </div>
      </section>
    );
  }

  if (status === 'PARTIAL') {
    return (
      <section className="space-y-4">
        {Header}
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="clock" className="h-4 w-4 shrink-0" />
          This event is in progress. Post-event analytics become available once it is marked completed.
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Registrations" value={a.registrations.total} accent="indigo" icon="users" />
          <StatCard label="Checked in so far" value={a.attendance.present} accent="emerald" icon="check-circle" />
        </div>
      </section>
    );
  }

  if (status !== 'AVAILABLE') {
    return (
      <section className="space-y-4">
        {Header}
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="clock" className="h-4 w-4 shrink-0" />
          Post-event analytics are not yet available. They will appear once this event is completed.
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Registrations so far" value={a.registrations.total} accent="indigo" icon="users" />
        </div>
      </section>
    );
  }

  // ---- AVAILABLE (COMPLETED) ----
  const hasReg = a.registrations.total > 0;
  const hasFeedback = a.feedback.total > 0;
  const hasSentiment = a.sentiment.analyzed > 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {Header}
        {onDownloadReport && (
          <div className="flex flex-wrap items-center gap-2">
            {onOpenReport && (
              <button
                type="button"
                onClick={onOpenReport}
                disabled={reportBusy}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                <Icon name="eye" className="h-4 w-4" />
                Preview report
              </button>
            )}
            <button
              type="button"
              onClick={onDownloadReport}
              disabled={reportBusy}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              {reportBusy ? 'Preparing…' : 'Download report'}
            </button>
          </div>
        )}
      </div>

      {reportError && <ErrorBanner message={reportError} />}

      {/* Overview stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Registrations" value={a.registrations.total} accent="indigo" icon="users" />
        <StatCard label="Attendees" value={a.attendance.present} accent="emerald" icon="check-circle" />
        <StatCard label="Attendance rate" value={`${a.attendance.rate}%`} accent="emerald" icon="trending-up" />
        <StatCard label="Feedback" value={a.feedback.total} accent="amber" icon="message-square" />
        <StatCard
          label="Average rating"
          value={a.feedback.averageRating != null ? `${a.feedback.averageRating} / 5` : '—'}
          accent="amber"
          icon="star"
        />
        <StatCard label="Certificates" value={a.certificates.issued} accent="slate" icon="award" />
      </div>

      {/* Participation */}
      <div>
        <div className="mb-2"><SectionHeader icon="users" title="Participation" /></div>
        {hasReg ? (
          <BarChart
            title="Registration vs attendance"
            caption={`Registered ${a.registrations.total} · Attended ${a.attendance.present} · Not attended ${a.attendance.absent}`}
            bars={[
              { label: 'Registered', value: a.registrations.total, max: a.registrations.total, color: 'indigo' },
              { label: 'Attended', value: a.attendance.present, max: a.registrations.total, color: 'emerald' },
              { label: 'Not attended', value: a.attendance.absent, max: a.registrations.total, color: 'slate' },
            ]}
          />
        ) : (
          <EmptyState title="No registration data available" description="No participants registered for this event." icon="users" />
        )}
        <p className="mt-2 text-xs text-slate-500">
          Feedback participation: {a.participation.feedbackParticipationRate ?? 0}% of the {a.certificates.eligible}{' '}
          who attended · Certificate issuance: {a.certificates.issuanceRate ?? 0}% ({a.certificates.issued} of{' '}
          {a.certificates.eligible} eligible)
        </p>
      </div>

      {/* Feedback — rating distribution */}
      <div>
        <div className="mb-2"><SectionHeader icon="star" title="Feedback ratings" /></div>
        {hasFeedback ? (
          <BarChart
            title="Rating distribution"
            caption={`${a.feedback.total} response${a.feedback.total === 1 ? '' : 's'}${
              a.feedback.averageRating != null ? ` · average ${a.feedback.averageRating} / 5` : ''
            }`}
            bars={[5, 4, 3, 2, 1].map((s) => ({
              label: `${s} star${s === 1 ? '' : 's'}`,
              value: a.feedback.ratingDistribution[s] ?? 0,
              max: a.feedback.total,
              color: 'amber',
            }))}
          />
        ) : (
          <EmptyState title="No feedback data available" description="No participants submitted feedback for this event." icon="message-square" />
        )}
      </div>

      {/* Sentiment */}
      <div>
        <div className="mb-2"><SectionHeader icon="sparkles" title="Sentiment" /></div>
        {hasSentiment ? (
          <BarChart
            title="Sentiment distribution"
            caption={`${a.sentiment.analyzed} analysed · Positive ${a.sentiment.positivePct}% · Neutral ${a.sentiment.neutralPct}% · Negative ${a.sentiment.negativePct}%${
              a.sentiment.unanalyzed > 0 ? ` · ${a.sentiment.unanalyzed} not analysed` : ''
            }`}
            bars={[
              { label: 'Positive', value: a.sentiment.positive, max: a.sentiment.analyzed, display: `${a.sentiment.positive} (${a.sentiment.positivePct}%)`, color: 'emerald' },
              { label: 'Neutral', value: a.sentiment.neutral, max: a.sentiment.analyzed, display: `${a.sentiment.neutral} (${a.sentiment.neutralPct}%)`, color: 'slate' },
              { label: 'Negative', value: a.sentiment.negative, max: a.sentiment.analyzed, display: `${a.sentiment.negative} (${a.sentiment.negativePct}%)`, color: 'rose' },
            ]}
          />
        ) : (
          <EmptyState
            title="No sentiment data available"
            description={
              hasFeedback
                ? 'Feedback was received but no comments have been analysed for sentiment.'
                : 'No feedback comments to analyse.'
            }
            icon="sparkles"
          />
        )}
        {hasFeedback && feedbackHref && (
          <a href={feedbackHref} className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline">
            View all feedback →
          </a>
        )}
      </div>

      {/* Summary */}
      {a.performanceSummary && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <SectionHeader icon="file-text" title="Event performance summary" />
          <p className="mt-1 text-sm text-slate-600">{a.performanceSummary}</p>
          <p className="mt-2 text-xs text-slate-400">
            A factual summary of what happened — it contains no predictions or recommendations.
          </p>
        </div>
      )}
    </section>
  );
};

export default AnalyticsView;
