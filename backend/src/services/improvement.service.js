import { EVENT_STATUSES } from '../models/event.model.js';
import { ROLES } from '../models/user.model.js';
import ImprovementRecommendation, {
  RECOMMENDATION_PRIORITIES,
  EVIDENCE_STRENGTHS,
} from '../models/improvementRecommendation.model.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { loadOwnedEvent } from './event.service.js';
import { loadEventForAnalytics, getEventAnalytics } from './analytics.service.js';
import { gatherAiContext } from './aiPlanning.service.js';

/**
 * Future-event improvement recommendations (Phase 11).
 *
 * This module does NOT recompute analytics or planning readiness — it calls
 * the existing, corrected Phase 10 `analytics.service` and the existing Phase
 * 5 `gatherAiContext` planning gatherer, and forwards their output to the AI
 * service's rule-based `/improve-event` engine. There is exactly one place
 * each metric formula lives (Phase 10's analytics service); this service only
 * shapes and validates data, and stores the result.
 *
 * Read-only w.r.t. every existing collection: the only write this module makes
 * is to its own `ImprovementRecommendation` document (one per event, upserted).
 * Event / Registration / Attendance / Feedback / Certificate / Notification /
 * planning records are never modified.
 */

const COMPLETED = EVENT_STATUSES.COMPLETED;
const AI_UNAVAILABLE = 'AI-based improvement recommendations are temporarily unavailable.';

const ALLOWED_PRIORITY = new Set(RECOMMENDATION_PRIORITIES);
const ALLOWED_CONFIDENCE = new Set(EVIDENCE_STRENGTHS);

// Wording the AI response must never contain (Issue: no unsupported claims / no
// guaranteed outcomes). Belt-and-braces — the in-tree rule engine never emits
// these, but a malformed/unexpected response is still screened.
const BANNED_PHRASES = [
  /\bwill definitely\b/i,
  /\bguarantee/i,
  /predicted .* will be exactly/i,
  /\bthis event will fail\b/i,
];

const safeNum = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);

const isCleanText = (s) =>
  typeof s === 'string' && s.trim().length > 0 && !BANNED_PHRASES.some((re) => re.test(s));

/** Build the exact payload ai-service/routes/improve.py expects. No formulas duplicated. */
const buildPayload = (event, analytics, planning) => ({
  event: {
    title: event.title ?? '',
    category: event.category ?? '',
    venue: event.venue ?? '',
    status: event.status ?? '',
    startDate: event.startDate ?? null,
    endDate: event.endDate ?? null,
    maxParticipants: event.maxParticipants ?? null,
  },
  registrations: {
    total: safeNum(analytics.registrations.total),
    cancelled: safeNum(analytics.registrations.cancelled),
    allTime: safeNum(analytics.registrations.allTime),
  },
  attendance: {
    present: safeNum(analytics.attendance.present),
    absent: safeNum(analytics.attendance.absent),
    rate: safeNum(analytics.attendance.rate),
  },
  feedback: {
    total: safeNum(analytics.feedback.total),
    averageRating: analytics.feedback.averageRating,
    ratingDistribution: analytics.feedback.ratingDistribution,
  },
  sentiment: {
    positive: safeNum(analytics.sentiment.positive),
    neutral: safeNum(analytics.sentiment.neutral),
    negative: safeNum(analytics.sentiment.negative),
    analyzed: safeNum(analytics.sentiment.analyzed),
    unanalyzed: safeNum(analytics.sentiment.unanalyzed),
    positivePct: safeNum(analytics.sentiment.positivePct),
    neutralPct: safeNum(analytics.sentiment.neutralPct),
    negativePct: safeNum(analytics.sentiment.negativePct),
  },
  certificates: {
    issued: safeNum(analytics.certificates.issued),
    eligible: safeNum(analytics.certificates.eligible),
    issuanceRate: safeNum(analytics.certificates.issuanceRate),
  },
  participation: {
    feedbackParticipationRate: safeNum(analytics.participation.feedbackParticipationRate),
    attendedParticipants: safeNum(analytics.participation.attendedParticipants),
  },
  tasks: planning.tasks,
  schedule: planning.schedule,
  resources: planning.resources,
  budget: planning.budget,
  team: planning.team,
  readiness: planning.readiness,
});

/** POST the payload to the FastAPI improvement engine. Never throws anything but ApiError(503). */
const requestImprovements = async (payload) => {
  let res;
  try {
    res = await fetch(`${env.ai.serviceUrl}/improve-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(env.ai.timeoutMs),
    });
  } catch (err) {
    logger.warn(`improvement AI call failed: ${err.name || 'Error'} ${err.message}`);
    throw new ApiError(503, AI_UNAVAILABLE);
  }

  if (!res.ok) {
    logger.warn(`improvement AI responded ${res.status}`);
    throw new ApiError(503, AI_UNAVAILABLE);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    logger.warn('improvement AI returned a non-JSON body');
    throw new ApiError(503, AI_UNAVAILABLE);
  }

  if (
    !body ||
    !Array.isArray(body.recommendations) ||
    !Array.isArray(body.strengths) ||
    !Array.isArray(body.improvementAreas) ||
    !Array.isArray(body.limitations)
  ) {
    logger.warn('improvement AI returned an unexpected shape');
    throw new ApiError(503, AI_UNAVAILABLE);
  }

  return body;
};

/** Drop any recommendation that fails validation instead of storing it (never throws). */
const sanitizeRecommendations = (items) => {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const r of items) {
    if (!r || typeof r !== 'object') continue;
    if (!isCleanText(r.category) || !isCleanText(r.title) || !isCleanText(r.recommendation) || !isCleanText(r.reason)) continue;
    if (!ALLOWED_PRIORITY.has(r.priority)) continue;
    if (!ALLOWED_CONFIDENCE.has(r.confidence)) continue;
    if (!Array.isArray(r.sourceMetrics) || r.sourceMetrics.length === 0 || !r.sourceMetrics.every((m) => typeof m === 'string')) continue;
    const evidence = r.evidence && typeof r.evidence === 'object' && !Array.isArray(r.evidence) ? r.evidence : {};
    // Every numeric evidence value must be finite — a non-finite number would
    // mean the engine fabricated or mis-derived a figure.
    if (Object.values(evidence).some((v) => typeof v === 'number' && !Number.isFinite(v))) continue;
    out.push({
      category: String(r.category).slice(0, 60),
      title: String(r.title).slice(0, 160),
      priority: r.priority,
      recommendation: String(r.recommendation).slice(0, 800),
      reason: String(r.reason).slice(0, 500),
      evidence,
      expectedBenefit: isCleanText(r.expectedBenefit) ? String(r.expectedBenefit).slice(0, 400) : '',
      confidence: r.confidence,
      sourceMetrics: r.sourceMetrics.slice(0, 10).map((m) => String(m).slice(0, 80)),
    });
  }
  return out;
};

/** Drop any strength/improvement-area note that fails validation. */
const sanitizeNotes = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .filter((n) => n && isCleanText(n.title) && isCleanText(n.detail))
    .map((n) => ({
      title: String(n.title).slice(0, 160),
      detail: String(n.detail).slice(0, 500),
      sourceMetrics: Array.isArray(n.sourceMetrics) ? n.sourceMetrics.slice(0, 10).map((m) => String(m).slice(0, 80)) : [],
    }));
};

const sanitizeLimitations = (items) =>
  Array.isArray(items) ? items.filter((l) => typeof l === 'string' && l.trim()).map((l) => String(l).slice(0, 500)) : [];

const toView = (doc) => ({
  id: String(doc._id),
  generatedAt: doc.generatedAt,
  aiMethod: doc.aiMethod,
  aiEngine: doc.aiEngine,
  recommendations: doc.recommendations,
  strengths: doc.strengths,
  improvementAreas: doc.improvementAreas,
  limitations: doc.limitations,
});

/**
 * POST /api/events/:id/improvements/generate — ORGANISER (owner) only.
 * Generates (or regenerates) improvement recommendations for one of the
 * organiser's own COMPLETED events. Never modifies the event, its
 * registrations, attendance, feedback, certificates or notifications.
 */
export const generateImprovements = async ({ organiserId, eventId }) => {
  const event = await loadOwnedEvent(eventId, organiserId); // 400 bad id / 404 missing / 403 not owner
  if (event.status !== COMPLETED) {
    throw ApiError.conflict('Improvement recommendations are available once the event is completed.');
  }

  const [analytics, planning] = await Promise.all([
    getEventAnalytics({ actor: { id: organiserId, role: ROLES.ORGANISER }, eventId }),
    gatherAiContext(eventId, event),
  ]);

  const payload = buildPayload(event, analytics, planning);
  const result = await requestImprovements(payload); // throws ApiError(503) on any failure

  const doc = await ImprovementRecommendation.findOneAndUpdate(
    { event: event._id },
    {
      event: event._id,
      organiser: organiserId,
      generatedAt: new Date(),
      aiMethod: typeof result.method === 'string' ? result.method : 'rule-based',
      aiEngine: typeof result.engine === 'string' ? result.engine : '',
      status: 'GENERATED',
      sourceSnapshot: {
        analyticsGeneratedAt: analytics.generatedAt,
        registrations: analytics.registrations.total,
        present: analytics.attendance.present,
        feedbackTotal: analytics.feedback.total,
        certificatesIssued: analytics.certificates.issued,
      },
      recommendations: sanitizeRecommendations(result.recommendations),
      strengths: sanitizeNotes(result.strengths),
      improvementAreas: sanitizeNotes(result.improvementAreas),
      limitations: sanitizeLimitations(result.limitations),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { event: { id: String(event._id), title: event.title, status: event.status }, generated: true, ...toView(doc) };
};

/**
 * GET /api/events/:id/improvements — ORGANISER (owner) or ADMIN (any event).
 * Read-only: returns the latest stored recommendations, or a clear
 * "not generated yet" / "not completed yet" state. Never calls the AI service.
 */
export const getImprovementsForActor = async ({ actor, eventId }) => {
  const event = await loadEventForAnalytics({ actor, eventId }); // 400 / 404 / 403

  const doc = await ImprovementRecommendation.findOne({ event: event._id }).lean();
  if (!doc) {
    return {
      event: { id: String(event._id), title: event.title, status: event.status },
      generated: false,
      reason:
        event.status === COMPLETED
          ? 'Improvement recommendations have not been generated yet for this event.'
          : 'This event is not completed yet, so improvement recommendations are not available.',
    };
  }

  return {
    event: { id: String(event._id), title: event.title, status: event.status },
    generated: true,
    ...toView(doc),
  };
};
