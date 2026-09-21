import mongoose from 'mongoose';

import Event, { EVENT_STATUSES } from '../models/event.model.js';
import Registration from '../models/registration.model.js';
import Attendance from '../models/attendance.model.js';
import Feedback from '../models/feedback.model.js';
import Certificate from '../models/certificate.model.js';
import { ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Post-event analytics + reporting (Phase 10).
 *
 * Every figure here is DERIVED, on demand, from the current state of the
 * Phase 3/6/7/8/9 records (Event, Registration, Attendance, Certificate,
 * Feedback). Nothing is stored; nothing is mutated — these functions only read
 * and count. If a registration is later cancelled, a check-in changes, or a
 * feedback is edited, the next call reflects it.
 *
 * Access: an ORGANISER may analyse only events they own; an ADMIN may analyse
 * any event (mirrors the existing event-oversight RBAC). USER has no access.
 */

const COMPLETED = EVENT_STATUSES.COMPLETED;
const CANCELLED = EVENT_STATUSES.CANCELLED;
const ONGOING = EVENT_STATUSES.ONGOING;
const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : 0);
/** A plain percentage. 0 when the denominator is 0 — never NaN / Infinity. */
const pct = (part, whole) => (whole > 0 ? round1((part / whole) * 100) : 0);
/**
 * A "rate that cannot logically exceed 100 %" — clamped to [0, 100]. Used for
 * the certificate-issuance and feedback-participation rates, whose numerators
 * are, by construction, a subset of the denominator (Issue 1 / Issue 9).
 */
const ratePct = (part, whole) => Math.max(0, Math.min(100, pct(part, whole)));

/**
 * Load a non-deleted event for analytics with role-aware access control.
 * ORGANISER → must own it; ADMIN → any. 400 bad id / 404 missing / 403 denied.
 */
export const loadEventForAnalytics = async ({ actor, eventId }) => {
  if (!mongoose.isValidObjectId(eventId)) throw ApiError.badRequest('Invalid event id.');

  const event = await Event.findOne({ _id: eventId, isDeleted: { $ne: true } })
    .populate('organiser', 'name email')
    .lean();
  if (!event) throw ApiError.notFound('Event not found.');

  const ownerId = event.organiser?._id ? String(event.organiser._id) : String(event.organiser);
  const allowed =
    actor.role === ROLES.ADMIN || (actor.role === ROLES.ORGANISER && ownerId === String(actor.id));
  if (!allowed) throw ApiError.forbidden('You can only view analytics for your own events.');

  return event;
};

const stateFor = (status) => {
  if (status === COMPLETED) return 'COMPLETED';
  if (status === CANCELLED) return 'CANCELLED';
  return 'PENDING'; // DRAFT / PLANNED / UPCOMING / ONGOING
};

/**
 * Explicit analytics-availability policy (Issue 2) — the single source of truth
 * that the frontend and the report gate both consume:
 *   AVAILABLE      COMPLETED  — full completed-event analytics + report
 *   PARTIAL        ONGOING    — only currently-available facts (registrations,
 *                              check-ins so far); no completed-event framing, no report
 *   NOT_AVAILABLE  else       — DRAFT/PLANNED/UPCOMING (nothing yet) or CANCELLED
 *                              (never framed as a completed performance report)
 */
const analyticsStatusFor = (status) => {
  if (status === COMPLETED) return 'AVAILABLE';
  if (status === ONGOING) return 'PARTIAL';
  return 'NOT_AVAILABLE';
};

/** Build the plain-language, strictly factual performance summary (§29/§53). No recommendations. */
const buildSummary = ({ state, reg, att, fb, sent, cert }) => {
  if (state === 'PENDING') return null;

  if (state === 'CANCELLED') {
    return reg.total > 0
      ? `This event was cancelled. ${reg.total} participant${reg.total === 1 ? ' had' : 's had'} registered before it was cancelled.`
      : 'This event was cancelled. No participants had registered.';
  }

  const parts = [];
  parts.push(
    `${reg.total} participant${reg.total === 1 ? '' : 's'} registered and ${att.present} ${
      att.present === 1 ? 'was' : 'were'
    } marked present, an attendance rate of ${att.rate}%.`,
  );
  if (fb.total > 0) {
    parts.push(
      `${fb.total} feedback response${fb.total === 1 ? ' was' : 's were'} received${
        fb.averageRating != null ? ` with an average rating of ${fb.averageRating} out of 5` : ''
      }.`,
    );
    if (sent.analyzed > 0) {
      parts.push(
        `Of ${sent.analyzed} analysed response${sent.analyzed === 1 ? '' : 's'}, ${sent.positive} ${
          sent.positive === 1 ? 'was' : 'were'
        } positive, ${sent.neutral} neutral and ${sent.negative} negative.`,
      );
    } else {
      parts.push('No feedback comments have been analysed for sentiment.');
    }
  } else {
    parts.push('No feedback was submitted for this event.');
  }
  parts.push(
    `${cert.issued} certificate${cert.issued === 1 ? ' has' : 's have'} been issued.`,
  );
  return parts.join(' ');
};

/**
 * Full analytics for one event. Figures come from a single `Promise.all` of
 * aggregation `$group`s plus lean, single-field projections of the event's
 * attendance rows and issued-certificate rows (bounded by the event size, used
 * to de-duplicate by participant for the historical certificate-eligibility
 * calculation — Issue 1). No per-user document loads, no N+1. Read-only.
 */
export const getEventAnalytics = async ({ actor, eventId }) => {
  const event = await loadEventForAnalytics({ actor, eventId });
  const eid = oid(event._id);
  const state = stateFor(event.status);
  const analyticsStatus = analyticsStatusFor(event.status);
  const analyticsAvailable = analyticsStatus === 'AVAILABLE';

  const [regByStatus, activeRegs, presentRows, fbAgg, ratingRows, sentimentRows, issuedCertRows] =
    await Promise.all([
      Registration.aggregate([{ $match: { event: eid } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Registration.find({ event: eid, status: 'REGISTERED' }).select('_id').lean(),
      Attendance.find({ event: eid, status: 'PRESENT' }).select('user registration').lean(),
      Feedback.aggregate([
        { $match: { event: eid } },
        { $group: { _id: null, total: { $sum: 1 }, ratingSum: { $sum: '$rating' } } },
      ]),
      Feedback.aggregate([{ $match: { event: eid } }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
      Feedback.aggregate([
        { $match: { event: eid, sentiment: { $in: SENTIMENTS } } },
        { $group: { _id: '$sentiment', count: { $sum: 1 } } },
      ]),
      Certificate.find({ event: eid, status: 'ISSUED' }).select('user').lean(),
    ]);

  const regMap = Object.fromEntries(regByStatus.map((r) => [r._id, r.count]));
  const registered = regMap.REGISTERED ?? 0;
  const cancelledRegs = regMap.CANCELLED ?? 0;

  const activeRegIdSet = new Set(activeRegs.map((r) => String(r._id)));
  // `present` (the attendance metric shown on the analytics + attendance pages):
  // PRESENT check-ins whose registration is still active. Cancelling drops both
  // this and `registered`, so `attendanceRate` can never exceed 100 %.
  const present = presentRows.filter((r) => activeRegIdSet.has(String(r.registration))).length;
  // `presentUserIds` — the HISTORICAL set of unique people who were PRESENT for
  // the event, regardless of any later registration cancellation. This is the
  // certificate-eligibility basis (Issue 1): a participant does not stop having
  // attended just because they later cancel.
  const presentUserIds = new Set(presentRows.map((r) => String(r.user)));
  const attendedParticipants = presentUserIds.size;
  const absent = Math.max(0, registered - present);

  const reg = { total: registered, cancelled: cancelledRegs, allTime: registered + cancelledRegs };
  const att = { present, absent, rate: pct(present, registered) };

  const fbTotalRow = fbAgg[0] ?? { total: 0, ratingSum: 0 };
  const feedbackTotal = fbTotalRow.total;
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of ratingRows) {
    if (row._id >= 1 && row._id <= 5) ratingDistribution[row._id] = row.count;
  }
  const fb = {
    total: feedbackTotal,
    averageRating: feedbackTotal > 0 ? round1(fbTotalRow.ratingSum / feedbackTotal) : null,
    ratingDistribution,
  };

  const sMap = Object.fromEntries(sentimentRows.map((r) => [r._id, r.count]));
  const positive = sMap.POSITIVE ?? 0;
  const neutral = sMap.NEUTRAL ?? 0;
  const negative = sMap.NEGATIVE ?? 0;
  const analyzed = positive + neutral + negative;
  const sent = {
    positive,
    neutral,
    negative,
    analyzed,
    unanalyzed: Math.max(0, feedbackTotal - analyzed),
    positivePct: pct(positive, analyzed),
    neutralPct: pct(neutral, analyzed),
    negativePct: pct(negative, analyzed),
  };

  // Certificate eligibility (Issue 1) — a HISTORICAL definition:
  //   eligibleParticipants  = unique participants who were PRESENT for the event
  //   issuedForEligible     = unique eligible participants who hold an ISSUED cert
  //   issuanceRate          = issuedForEligible / eligibleParticipants * 100, clamped ≤ 100
  // `issuedForEligible ⊆ eligibleParticipants` by construction, so the rate can
  // never exceed 100 % even if a participant attended, was issued a certificate,
  // and then cancelled their registration. `0` when nobody is eligible.
  const issuedTotal = issuedCertRows.length;
  const issuedForEligible = new Set(
    issuedCertRows.map((c) => String(c.user)).filter((u) => presentUserIds.has(u)),
  ).size;
  const eligible = analyticsAvailable ? attendedParticipants : 0;
  const cert = {
    issued: issuedTotal,
    eligible,
    issuanceRate: eligible > 0 ? ratePct(issuedForEligible, eligible) : 0,
  };

  const participation = {
    registered,
    attended: present,
    attendedParticipants,
    attendanceRate: att.rate,
    feedbackResponses: feedbackTotal,
    // Denominator = everyone who attended (historical) so a since-cancelled
    // respondent cannot push this over 100 % (Issue 1 / Issue 9).
    feedbackParticipationRate: attendedParticipants > 0 ? ratePct(feedbackTotal, attendedParticipants) : 0,
    certificatesIssued: issuedTotal,
  };

  return {
    event: {
      id: String(event._id),
      title: event.title,
      status: event.status,
      state,
      category: event.category,
      venue: event.venue,
      startDate: event.startDate,
      endDate: event.endDate,
      organiser: { name: event.organiser?.name ?? null },
    },
    state,
    // Explicit availability policy (Issue 2) — the frontend and the report gate
    // both read these instead of re-deriving from the event status.
    analyticsStatus, // 'AVAILABLE' | 'PARTIAL' | 'NOT_AVAILABLE'
    analyticsAvailable, // === (analyticsStatus === 'AVAILABLE')
    registrations: reg,
    attendance: att,
    feedback: fb,
    sentiment: sent,
    certificates: cert,
    participation,
    performanceSummary: buildSummary({ state, reg, att, fb, sent, cert }),
    generatedAt: new Date().toISOString(),
  };
};

/**
 * Data for the downloadable event report. Same access control as analytics,
 * plus: a report is only produced for a COMPLETED event (§8/§52).
 */
export const getEventReportData = async ({ actor, eventId }) => {
  const analytics = await getEventAnalytics({ actor, eventId });
  // Gate on the explicit availability policy (Issue 2 / Issue 7) — a report is
  // only produced when full completed-event analytics are available.
  if (analytics.analyticsStatus !== 'AVAILABLE') {
    throw ApiError.conflict('An event report is available once the event is completed.');
  }
  const reference = `RPT-${String(analytics.event.id).slice(-6).toUpperCase()}-${new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[-:T]/g, '')}`;
  return { analytics, reference };
};

/**
 * GET /api/admin/analytics/summary — a basic platform roll-up for ADMIN (§49).
 * Deliberately basic: totals only, no cross-event trend/ranking analysis (§50).
 */
export const getPlatformSummary = async () => {
  const notDeleted = { isDeleted: { $ne: true } };

  const [eventsByStatus, totalRegistrations, attendeeRows, fbAgg, sentimentRows, certificatesIssued] =
    await Promise.all([
      Event.aggregate([{ $match: notDeleted }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Registration.countDocuments({ status: 'REGISTERED' }),
      // totalAttendees (Issue 3) — DISTINCT participants who actually attended,
      // counted from valid attendance records: PRESENT check-ins whose
      // registration is still REGISTERED (a check-in whose registration was
      // later cancelled, or is missing, is not counted), de-duplicated by user
      // so a person who attended several events counts once.
      Attendance.aggregate([
        { $match: { status: 'PRESENT' } },
        { $lookup: { from: 'registrations', localField: 'registration', foreignField: '_id', as: 'reg' } },
        { $set: { regStatus: { $arrayElemAt: ['$reg.status', 0] } } },
        { $match: { regStatus: 'REGISTERED' } },
        { $group: { _id: '$user' } },
        { $count: 'n' },
      ]),
      Feedback.aggregate([{ $group: { _id: null, total: { $sum: 1 }, ratingSum: { $sum: '$rating' } } }]),
      Feedback.aggregate([
        { $match: { sentiment: { $in: SENTIMENTS } } },
        { $group: { _id: '$sentiment', count: { $sum: 1 } } },
      ]),
      Certificate.countDocuments({ status: 'ISSUED' }),
    ]);

  const totalAttendees = attendeeRows[0]?.n ?? 0;
  const evMap = Object.fromEntries(eventsByStatus.map((r) => [r._id, r.count]));
  const totalEvents = Object.values(evMap).reduce((a, b) => a + b, 0);
  const fbRow = fbAgg[0] ?? { total: 0, ratingSum: 0 };
  const sMap = Object.fromEntries(sentimentRows.map((r) => [r._id, r.count]));
  const positive = sMap.POSITIVE ?? 0;
  const neutral = sMap.NEUTRAL ?? 0;
  const negative = sMap.NEGATIVE ?? 0;
  const analyzed = positive + neutral + negative;

  return {
    events: {
      total: totalEvents,
      completed: evMap[COMPLETED] ?? 0,
      cancelled: evMap[CANCELLED] ?? 0,
      upcoming: evMap[EVENT_STATUSES.UPCOMING] ?? 0,
      ongoing: evMap[EVENT_STATUSES.ONGOING] ?? 0,
    },
    totalRegistrations,
    totalAttendees,
    feedback: {
      total: fbRow.total,
      averageRating: fbRow.total > 0 ? round1(fbRow.ratingSum / fbRow.total) : null,
    },
    sentiment: {
      positive,
      neutral,
      negative,
      analyzed,
      positivePct: pct(positive, analyzed),
      neutralPct: pct(neutral, analyzed),
      negativePct: pct(negative, analyzed),
    },
    certificatesIssued,
    generatedAt: new Date().toISOString(),
  };
};
