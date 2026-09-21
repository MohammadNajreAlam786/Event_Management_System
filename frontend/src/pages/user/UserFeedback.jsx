import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import participantService from '../../services/participantService.js';
import feedbackService from '../../services/feedbackService.js';
import EmptyState from '../../components/EmptyState.jsx';
import StarRating from '../../components/feedback/StarRating.jsx';
import SentimentBadge from '../../components/feedback/SentimentBadge.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import { formatDate, formatDateTime } from '../../utils/eventMeta.js';

/**
 * /user/feedback — the participant's feedback hub.
 *
 * Lists every event the participant attended (COMPLETED + attendance PRESENT):
 * those are the only events feedback is available for (§13/§36). For each, it
 * shows whether feedback has been submitted and links to the form.
 */
const UserFeedback = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => {
    let active = true;
    setLoadState('loading');
    setError('');
    participantService
      .getMyRegistrations()
      .then(async (regs) => {
        const eligible = regs.filter(
          (r) => r.status === 'REGISTERED' && r.event.status === 'COMPLETED' && r.attendance?.status === 'PRESENT',
        );
        const withFeedback = await Promise.all(
          eligible.map(async (r) => {
            try {
              const data = await feedbackService.getMine(r.event.id);
              return { reg: r, feedback: data.feedback, eligible: data.eligible, reason: data.reason };
            } catch {
              return { reg: r, feedback: null, eligible: true, reason: null };
            }
          }),
        );
        if (!active) return;
        setRows(withFeedback);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Unable to load your feedback. Please try again.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => load(), [load, reloadKey]);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Feedback</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Share your experience of events you attended. Your comment is analysed for sentiment to help organisers.
        </p>
      </div>

      {loadState === 'error' && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {loadState === 'loading' && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {loadState === 'ready' && rows.length === 0 && (
        <EmptyState
          title="No events are currently available for feedback"
          description="When you attend an event and it is marked completed, you'll be able to leave feedback here."
          icon="message-square"
        />
      )}

      {loadState === 'ready' && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map(({ reg, feedback }) => (
            <li
              key={reg.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <span className="font-medium text-slate-900">{reg.event.title}</span>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDateTime(reg.event.startDate)} · {reg.event.venue}
                </p>
                {feedback ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StarRating value={feedback.rating} readOnly size="sm" />
                    {feedback.comment ? (
                      <SentimentBadge
                        sentiment={feedback.sentiment}
                        status={feedback.sentimentStatus}
                        score={feedback.sentimentScore}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">Rating only</span>
                    )}
                    <span className="text-xs text-slate-400">· submitted {formatDate(feedback.submittedAt)}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-medium text-amber-600">Not submitted yet</p>
                )}
              </div>
              <div className="shrink-0">
                <Link
                  to={`/user/feedback/${reg.event.id}`}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    feedback
                      ? 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {feedback ? 'View / edit' : 'Give feedback'}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default UserFeedback;
