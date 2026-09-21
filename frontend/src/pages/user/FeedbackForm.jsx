import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import feedbackService from '../../services/feedbackService.js';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import StarRating from '../../components/feedback/StarRating.jsx';
import SentimentBadge from '../../components/feedback/SentimentBadge.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import SuccessBanner from '../../components/ui/SuccessBanner.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { formatDateTime } from '../../utils/eventMeta.js';

const COMMENT_MAX = 1000;

/**
 * /user/feedback/:eventId — submit or edit feedback for one attended event.
 *
 * The form is shown only when the participant is eligible (registered + present
 * + event completed — §33). If feedback already exists it is shown read-only
 * with an Edit toggle (§11/§33).
 */
const FeedbackForm = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null); // { event, eligible, reason, feedback }

  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setState('loading');
    setError('');
    feedbackService
      .getMine(eventId)
      .then((data) => {
        if (!active) return;
        setPayload(data);
        if (data.feedback) {
          setRating(data.feedback.rating);
          setComment(data.feedback.comment || '');
          setEditing(false);
        } else {
          setRating(0);
          setComment('');
          setEditing(true);
        }
        setState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(
          err.status === 404
            ? 'Event not found.'
            : err.message || 'Unable to load this feedback form. Please try again.',
        );
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [eventId, navigate]);

  useEffect(() => load(), [load]);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const trimmed = comment.trim();
    if (!rating) {
      setFormError('Please select a rating from 1 to 5 stars.');
      return;
    }
    if (trimmed && trimmed.length < 5) {
      setFormError('Your comment is very short — add a little more, or clear it to leave a rating only.');
      return;
    }
    setSubmitting(true);
    try {
      const existing = payload.feedback;
      const result = existing
        ? await feedbackService.update(eventId, existing.id, { rating, comment: trimmed })
        : await feedbackService.submit(eventId, { rating, comment: trimmed });
      setPayload((prev) => ({ ...prev, feedback: result.feedback }));
      setEditing(false);
      setJustSaved(true);
    } catch (err) {
      setFormError(err.message || 'Could not save your feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;
  if (state === 'error') {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Link to="/user/feedback" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Back to Feedback
        </Link>
      </div>
    );
  }

  const { event, eligible, reason, feedback } = payload;

  return (
    <section className="space-y-6">
      <div>
        <Link to="/user/feedback" className="text-xs font-medium text-indigo-600 hover:underline">
          ← Back to Feedback
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">{event.title}</h1>
          <EventStatusBadge status={event.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {formatDateTime(event.startDate)}
          {event.venue ? ` · ${event.venue}` : ''}
        </p>
      </div>

      {!eligible && !feedback && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="alert-triangle" className="h-4 w-4 shrink-0" />
          {reason || 'Feedback is not available for this event.'}
        </div>
      )}

      {justSaved && (
        <SuccessBanner
          message={
            <>
              <span className="block font-semibold">Feedback submitted successfully.</span>
              {feedback?.comment ? (
                <span className="mt-1 flex items-center gap-1.5">
                  Sentiment:{' '}
                  <SentimentBadge
                    sentiment={feedback.sentiment}
                    status={feedback.sentimentStatus}
                    score={feedback.sentimentScore}
                  />
                </span>
              ) : null}
            </>
          }
        />
      )}

      {/* Existing feedback, read-only */}
      {feedback && !editing && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Your rating</p>
            <div className="mt-1">
              <StarRating value={feedback.rating} readOnly />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Your comment</p>
            {feedback.comment ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{feedback.comment}</p>
            ) : (
              <p className="mt-1 text-sm italic text-slate-400">No comment — rating only.</p>
            )}
          </div>
          {feedback.comment && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">AI sentiment</p>
              <div className="mt-1">
                <SentimentBadge
                  sentiment={feedback.sentiment}
                  status={feedback.sentimentStatus}
                  score={feedback.sentimentScore}
                />
              </div>
            </div>
          )}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setJustSaved(false);
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Edit feedback
            </button>
          </div>
        </div>
      )}

      {/* Form — new submission or editing */}
      {(editing && (eligible || feedback)) && (
        <form onSubmit={submit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <label className="block text-sm font-medium text-slate-700">Rating</label>
            <p className="text-xs text-slate-400">1 = Very Poor · 5 = Excellent</p>
            <div className="mt-2">
              <StarRating value={rating} onChange={setRating} />
            </div>
          </div>

          <div>
            <label htmlFor="fb-comment" className="block text-sm font-medium text-slate-700">
              Comment <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="fb-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              maxLength={COMMENT_MAX}
              placeholder="What worked well? What could be improved?"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {comment.length}/{COMMENT_MAX}
            </p>
          </div>

          {formError && <ErrorBanner message={formError} />}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Saving…' : feedback ? 'Save changes' : 'Submit feedback'}
            </button>
            {feedback && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setRating(feedback.rating);
                  setComment(feedback.comment || '');
                  setEditing(false);
                  setFormError('');
                }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
};

export default FeedbackForm;
