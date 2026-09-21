import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import planningService from '../../../services/planningService.js';
import aiPlanningService from '../../../services/aiPlanningService.js';
import EventStatusBadge from '../../../components/EventStatusBadge.jsx';
import AiSummaryCard from '../../../components/planning/AiSummaryCard.jsx';
import AiRecommendations from '../../../components/planning/AiRecommendations.jsx';
import AiRisks from '../../../components/planning/AiRisks.jsx';
import ErrorBanner from '../../../components/ui/ErrorBanner.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { formatDateTime } from '../../../utils/eventMeta.js';

const REVIEW_AREAS = ['Tasks', 'Schedule', 'Resources', 'Budget', 'Team', 'Readiness'];

/**
 * AI Planning Assistant (Phase 5). One action — "Analyze Event Plan" — sends the
 * current planning data to the backend, which runs the analysis and returns a
 * structured result (summary, prioritised recommendations, risks). Nothing is
 * modified automatically; every suggestion is informational.
 */
const PlanningAiAssistant = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { event } = useOutletContext() ?? {};

  const [readiness, setReadiness] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | analyzing | ready | error
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    planningService
      .getReadiness(id)
      .then((d) => active && setReadiness(d))
      .catch((err) => {
        if (err.status === 401) navigate('/login', { replace: true });
      });
    return () => {
      active = false;
    };
  }, [id, navigate]);

  const runAnalysis = () => {
    if (status === 'analyzing') return;
    setStatus('analyzing');
    setErrorMessage('');
    aiPlanningService
      .analyze(id)
      .then((data) => {
        setResult(data);
        if (data?.readiness) setReadiness((prev) => ({ ...(prev ?? {}), ...data.readiness }));
        setStatus('ready');
      })
      .catch((err) => {
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setErrorMessage(err.message || 'AI planning assistance is temporarily unavailable.');
        setStatus('error');
      });
  };

  const readinessPct = result?.readiness?.overallScore ?? readiness?.overallScore;
  const readinessStatus = result?.readiness?.status ?? readiness?.status;

  return (
    <section className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <Icon name="sparkles" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">AI Planning Assistant</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Use AI to review your event preparation and identify possible improvements before the event.
          </p>
        </div>
      </div>

      {/* Event context — a compact strip, not a copy of the Event Overview page. */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-slate-900">{event?.title ?? 'This event'}</span>
          {event?.status && <EventStatusBadge status={event.status} />}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {event?.startDate ? formatDateTime(event.startDate) : '—'}
          {event?.endDate ? ` — ${formatDateTime(event.endDate)}` : ''}
        </p>
        {readinessPct != null && (
          <p className="mt-1 text-sm text-slate-500">
            Current readiness: <span className="font-medium text-slate-700">{readinessPct}%</span>
            {readinessStatus ? ` (${readinessStatus.replace(/_/g, ' ').toLowerCase()})` : ''}
          </p>
        )}
      </div>

      {status === 'idle' && (
        <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/30 px-6 py-10 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
            <Icon name="sparkles" className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-700">No analysis yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Analyze your event plan to receive AI-assisted recommendations. It reviews your tasks,
            schedule, resources, budget and team, and explains your readiness score.
          </p>
          <button
            type="button"
            onClick={runAnalysis}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <Icon name="sparkles" className="h-4 w-4" />
            Analyze Event Plan
          </button>
        </div>
      )}

      {status === 'analyzing' && (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-10 text-center">
          <span
            className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-medium text-slate-700">Analyzing your planning data…</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            The review covers {REVIEW_AREAS.join(' · ')}.
          </p>
        </div>
      )}

      {status === 'error' && (
        <ErrorBanner
          message={
            <>
              <span className="block font-medium">{errorMessage}</span>
              <span className="mt-1 block text-rose-600">
                The rest of the planning workspace is unaffected — tasks, schedule, resources, budget,
                team and readiness all keep working.
              </span>
            </>
          }
          onRetry={runAnalysis}
          retryLabel="Try Again"
        />
      )}

      {status === 'ready' && result && (
        <div className="space-y-4">
          <AiSummaryCard result={result} />
          <AiRecommendations items={result.recommendations} />
          <AiRisks items={result.risks} />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">
              Analysis based on your planning data
              {result.generatedAt ? ` at ${new Date(result.generatedAt).toLocaleString()}` : ''}. Re-run it
              after you change tasks, schedule, resources, budget or team.
            </p>
            <button
              type="button"
              onClick={runAnalysis}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Icon name="refresh-cw" className="h-4 w-4" />
              Analyze Again
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default PlanningAiAssistant;
