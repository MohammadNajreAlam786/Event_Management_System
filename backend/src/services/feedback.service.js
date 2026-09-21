import mongoose from 'mongoose';

import Feedback, {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  FEEDBACK_RATING_LABELS,
} from '../models/feedback.model.js';
import Event, { EVENT_STATUSES } from '../models/event.model.js';
import Registration from '../models/registration.model.js';
import Attendance from '../models/attendance.model.js';
import { ApiError } from '../utils/apiError.js';
import { loadOwnedEvent } from './event.service.js';
import { analyzeComment } from './sentiment.service.js';

/**
 * Participant feedback + AI sentiment domain logic (Phase 9).
 *
 * Eligibility to submit feedback (§3/§13/§51) — ALL must hold:
 *   1. the event exists and is not soft-deleted
 *   2. Event.status === 'COMPLETED'          (UPCOMING/ONGOING/CANCELLED → no)
 *   3. a Registration exists for (user, event) and is currently REGISTERED
 *   4. an Attendance row exists for that registration with status 'PRESENT'
 *
 * One feedback per (user, event) — enforced by a unique index on the model and
 * re-checked here for a friendly 409.
 *
 * Editing (§11/§16): the owner may edit their own feedback (rating and/or
 * comment). Editing does NOT re-check event eligibility — the feedback is a
 * record of participation that already happened. Changing the comment re-runs
 * sentiment analysis so the stored sentiment always matches the current text
 * (§31/§50).
 *
 * Sentiment (§28): analysis runs synchronously *before* the feedback is saved
 * (the simplest robust design). If the AI service is unavailable the feedback
 * is still saved with sentimentStatus 'FAILED' — submission never fails.
 */

const COMPLETED = EVENT_STATUSES.COMPLETED;
const CANCELLED = EVENT_STATUSES.CANCELLED;
const NOT_DELETED = { isDeleted: { $ne: true } };

const assertObjectId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest(`Invalid ${label}.`);
};

/** Validate + normalise a rating. Throws 400 on anything that is not an integer 1..5. */
const normaliseRating = (raw) => {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 5) {
    throw ApiError.badRequest('Rating must be a whole number from 1 (Very Poor) to 5 (Excellent).');
  }
  return n;
};

/**
 * Validate + normalise a comment. A comment is optional (rating-only feedback is
 * allowed — §9). When supplied it must be 5..1000 characters after trimming.
 */
const normaliseComment = (raw) => {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') throw ApiError.badRequest('Comment must be text.');
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  if (trimmed.length < COMMENT_MIN_LENGTH) {
    throw ApiError.badRequest(`Comment must be at least ${COMMENT_MIN_LENGTH} characters, or left empty.`);
  }
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    throw ApiError.badRequest(`Comment must be at most ${COMMENT_MAX_LENGTH} characters.`);
  }
  return trimmed;
};

/** Shared view of one feedback document (participant + organiser both use this). */
const toFeedbackView = (fb, { includeParticipant = false } = {}) => ({
  id: String(fb._id),
  rating: fb.rating,
  ratingLabel: FEEDBACK_RATING_LABELS[fb.rating] ?? null,
  comment: fb.comment ?? '',
  sentiment: fb.sentiment ?? null,
  sentimentScore: fb.sentimentScore ?? null,
  sentimentStatus: fb.sentimentStatus,
  submittedAt: fb.createdAt,
  updatedAt: fb.updatedAt,
  ...(includeParticipant
    ? { participant: { name: fb.user?.name ?? 'Participant' } }
    : {}),
});

/**
 * Resolve a participant's feedback eligibility for one event.
 * @returns {{ event, registration, attendance, eligible, reason }}
 */
const resolveEligibility = async ({ userId, eventId }) => {
  assertObjectId(eventId, 'event id');

  const event = await Event.findOne({ _id: eventId, ...NOT_DELETED }).lean();
  if (!event || event.status === EVENT_STATUSES.DRAFT) throw ApiError.notFound('Event not found.');

  const base = { event, registration: null, attendance: null };

  if (event.status === CANCELLED) {
    return { ...base, eligible: false, reason: 'This event was cancelled, so feedback is not available.' };
  }
  if (event.status !== COMPLETED) {
    return { ...base, eligible: false, reason: 'Feedback opens once the event is completed.' };
  }

  const registration = await Registration.findOne({ user: userId, event: eventId }).lean();
  if (!registration) {
    return { ...base, eligible: false, reason: 'You did not register for this event.' };
  }
  if (registration.status !== 'REGISTERED') {
    return { ...base, registration, eligible: false, reason: 'Your registration for this event was cancelled.' };
  }

  const attendance = await Attendance.findOne({ registration: registration._id }).lean();
  if (!attendance || attendance.status !== 'PRESENT') {
    return {
      ...base,
      registration,
      eligible: false,
      reason: 'Feedback is only available to participants whose attendance was recorded.',
    };
  }

  return { event, registration, attendance, eligible: true, reason: null };
};

const eventSummaryView = (event) => ({
  id: String(event._id),
  title: event.title,
  status: event.status,
  startDate: event.startDate,
  endDate: event.endDate,
  venue: event.venue,
});

/**
 * GET /api/events/:id/feedback/mine — the eligibility + the caller's feedback
 * (if any) for one event. Drives the participant feedback form.
 */
export const getMyFeedbackForEvent = async ({ userId, eventId }) => {
  const { event, eligible, reason } = await resolveEligibility({ userId, eventId });
  const existing = await Feedback.findOne({ user: userId, event: eventId });

  return {
    event: eventSummaryView(event),
    eligible,
    reason: eligible ? null : reason,
    feedback: existing ? toFeedbackView(existing) : null,
  };
};

/** POST /api/events/:id/feedback — create the caller's feedback for one event. */
export const submitFeedback = async ({ userId, eventId, rating, comment }) => {
  const ratingValue = normaliseRating(rating);
  const commentValue = normaliseComment(comment);

  const { event, registration, attendance, eligible, reason } = await resolveEligibility({ userId, eventId });
  if (!eligible) throw ApiError.forbidden(reason);

  const already = await Feedback.findOne({ user: userId, event: eventId }).lean();
  if (already) throw ApiError.conflict('You have already submitted feedback for this event.');

  // Analyse before persisting (§28). Never throws — returns FAILED / SKIPPED.
  const s = await analyzeComment(commentValue);

  let created;
  try {
    created = await Feedback.create({
      event: event._id,
      user: userId,
      registration: registration._id,
      attendance: attendance._id,
      rating: ratingValue,
      comment: commentValue,
      sentiment: s.sentiment,
      sentimentScore: s.score,
      sentimentStatus: s.status,
      sentimentModel: s.model,
      sentimentAnalyzedAt: s.status === 'ANALYZED' ? new Date() : null,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      throw ApiError.conflict('You have already submitted feedback for this event.');
    }
    throw err;
  }

  return { feedback: toFeedbackView(created), event: eventSummaryView(event) };
};

/** PATCH /api/events/:id/feedback/:feedbackId — edit the caller's own feedback. */
export const updateFeedback = async ({ userId, eventId, feedbackId, rating, comment }) => {
  assertObjectId(eventId, 'event id');
  assertObjectId(feedbackId, 'feedback id');

  const feedback = await Feedback.findById(feedbackId);
  if (!feedback) throw ApiError.notFound('Feedback not found.');
  if (String(feedback.user) !== String(userId)) {
    throw ApiError.forbidden('You can only edit your own feedback.');
  }
  if (String(feedback.event) !== String(eventId)) {
    throw ApiError.badRequest('This feedback does not belong to that event.');
  }

  if (rating !== undefined) feedback.rating = normaliseRating(rating);

  if (comment !== undefined) {
    const nextComment = normaliseComment(comment);
    if (nextComment !== (feedback.comment ?? '')) {
      feedback.comment = nextComment;
      // Comment changed → re-run sentiment so it always matches the text (§31/§50).
      const s = await analyzeComment(nextComment);
      feedback.sentiment = s.sentiment;
      feedback.sentimentScore = s.score;
      feedback.sentimentStatus = s.status;
      feedback.sentimentModel = s.model;
      feedback.sentimentAnalyzedAt = s.status === 'ANALYZED' ? new Date() : null;
    }
  }

  await feedback.save();
  return { feedback: toFeedbackView(feedback) };
};

const SENTIMENT_KEYS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];

/**
 * GET /api/events/:id/feedback — every feedback for an event the caller owns,
 * plus a basic summary (§40). Not an analytics dashboard (§41).
 */
export const listEventFeedback = async ({ organiserId, eventId }) => {
  const event = await loadOwnedEvent(eventId, organiserId); // 400 / 404 / 403

  const docs = await Feedback.find({ event: eventId })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const bySentiment = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
  let ratingSum = 0;
  let analysed = 0;
  let pending = 0;
  for (const fb of docs) {
    ratingSum += fb.rating;
    if (fb.sentiment && SENTIMENT_KEYS.includes(fb.sentiment)) {
      bySentiment[fb.sentiment] += 1;
      analysed += 1;
    } else if (fb.sentimentStatus === 'PENDING' || fb.sentimentStatus === 'FAILED') {
      pending += 1;
    }
  }

  return {
    event: eventSummaryView(event),
    summary: {
      total: docs.length,
      positive: bySentiment.POSITIVE,
      neutral: bySentiment.NEUTRAL,
      negative: bySentiment.NEGATIVE,
      analysed,
      unanalysed: pending,
      averageRating: docs.length ? Math.round((ratingSum / docs.length) * 10) / 10 : null,
    },
    feedback: docs.map((fb) => toFeedbackView(fb, { includeParticipant: true })),
  };
};
