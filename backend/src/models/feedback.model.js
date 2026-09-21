import mongoose from 'mongoose';

/**
 * Feedback — one participant's post-event feedback for one event (Phase 9).
 *
 * Eligibility is derived from real Phase-6 Registration + Phase-7 Attendance
 * records (see feedback.service.js): a participant may submit feedback only
 * when they were REGISTERED, marked PRESENT, and the event is COMPLETED.
 * The Registration and Attendance the feedback was created against are stored
 * as references so the link to actual participation is explicit and auditable.
 *
 * One feedback per (user, event) is enforced by a unique compound index — not
 * just the UI.
 *
 * `sentiment` / `sentimentScore` are filled by the AI service
 * (POST /sentiment/analyze, VADER) at submit time and re-computed on edit when
 * the comment changes. If the AI service is unavailable the feedback is still
 * saved with `sentimentStatus: 'FAILED'` — submission never fails because of
 * sentiment analysis (§28/§65). Rating-only feedback (no comment) is stored
 * with `sentimentStatus: 'SKIPPED'` and no sentiment.
 */

export const FEEDBACK_SENTIMENTS = Object.freeze(['POSITIVE', 'NEUTRAL', 'NEGATIVE']);
export const FEEDBACK_SENTIMENT_STATUSES = Object.freeze(['PENDING', 'ANALYZED', 'FAILED', 'SKIPPED']);

export const FEEDBACK_RATING_LABELS = Object.freeze({
  1: 'Very Poor',
  2: 'Poor',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
});

export const COMMENT_MAX_LENGTH = 1000;
export const COMMENT_MIN_LENGTH = 5; // only enforced when a comment is supplied

const feedbackSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', required: true },

    rating: {
      type: Number,
      required: [true, 'A rating is required.'],
      min: [1, 'Rating must be between 1 and 5.'],
      max: [5, 'Rating must be between 1 and 5.'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number between 1 and 5.',
      },
    },
    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: [COMMENT_MAX_LENGTH, `Comment must be at most ${COMMENT_MAX_LENGTH} characters.`],
    },

    sentiment: {
      type: String,
      enum: { values: FEEDBACK_SENTIMENTS, message: '{VALUE} is not a valid sentiment.' },
      default: null,
    },
    // Model confidence for the classification: |compound| from VADER, 0..1.
    // Not a calibrated probability — see the Phase 9 report.
    sentimentScore: { type: Number, default: null, min: 0, max: 1 },
    sentimentStatus: {
      type: String,
      enum: { values: FEEDBACK_SENTIMENT_STATUSES, message: '{VALUE} is not a valid sentiment status.' },
      default: 'PENDING',
    },
    sentimentModel: { type: String, default: '', trim: true },
    sentimentAnalyzedAt: { type: Date, default: null },
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

// One feedback row per (user, event) — the database-level duplicate guard (§6/§49).
feedbackSchema.index({ user: 1, event: 1 }, { unique: true });
// Organiser feedback list (newest first) + sentiment roll-up query (§49).
feedbackSchema.index({ event: 1, createdAt: -1 });
feedbackSchema.index({ event: 1, sentiment: 1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);

export default Feedback;
