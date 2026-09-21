import mongoose from 'mongoose';

/**
 * ImprovementRecommendation — the latest AI-based, data-grounded future-event
 * improvement recommendations for one COMPLETED event (Phase 11).
 *
 * One document per event (unique index on `event`) — generating again
 * replaces the previous document rather than accumulating a history, so
 * "Generate" is always safe to re-run as more feedback/certificates arrive
 * for the same completed event.
 *
 * This is a derived analysis artifact, not a source-of-truth record: it never
 * feeds back into Registration/Attendance/Feedback/Certificate/Event, and
 * generating or re-generating it never mutates any of those collections.
 */

export const RECOMMENDATION_PRIORITIES = Object.freeze(['LOW', 'MEDIUM', 'HIGH']);
export const EVIDENCE_STRENGTHS = Object.freeze(['LOW', 'MEDIUM', 'HIGH']);
export const IMPROVEMENT_STATUSES = Object.freeze(['GENERATED']);

const recommendationSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    priority: { type: String, enum: RECOMMENDATION_PRIORITIES, required: true },
    recommendation: { type: String, required: true, trim: true, maxlength: 800 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    // Values copied from the analytics/planning payload only — never invented.
    evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    expectedBenefit: { type: String, default: '', trim: true, maxlength: 400 },
    // Evidence strength (sample-size based), NOT a statistical confidence interval.
    confidence: { type: String, enum: EVIDENCE_STRENGTHS, required: true },
    sourceMetrics: { type: [String], default: [] },
  },
  { _id: false },
);

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    detail: { type: String, required: true, trim: true, maxlength: 500 },
    sourceMetrics: { type: [String], default: [] },
  },
  { _id: false },
);

const improvementRecommendationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, unique: true },
    organiser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    generatedAt: { type: Date, default: Date.now },
    aiMethod: { type: String, default: 'rule-based', trim: true },
    aiEngine: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: { values: IMPROVEMENT_STATUSES, message: '{VALUE} is not a valid improvement status.' },
      default: 'GENERATED',
    },
    // A compact pointer back to the analytics snapshot used — not a full
    // duplicate of the analytics object, and no participant-level data.
    sourceSnapshot: {
      analyticsGeneratedAt: { type: Date, default: null },
      registrations: { type: Number, default: 0 },
      present: { type: Number, default: 0 },
      feedbackTotal: { type: Number, default: 0 },
      certificatesIssued: { type: Number, default: 0 },
    },
    recommendations: { type: [recommendationSchema], default: [] },
    strengths: { type: [noteSchema], default: [] },
    improvementAreas: { type: [noteSchema], default: [] },
    limitations: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

const ImprovementRecommendation = mongoose.model('ImprovementRecommendation', improvementRecommendationSchema);

export default ImprovementRecommendation;
