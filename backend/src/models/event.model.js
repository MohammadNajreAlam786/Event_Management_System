import mongoose from 'mongoose';

/**
 * Event — the central entity of the system. Kept deliberately focused: it
 * holds only core event information. Future planning concerns (tasks,
 * schedule, resources, budget, team, readiness) and downstream concerns
 * (registrations, attendance, feedback, certificates, analytics, reports)
 * will each live in their own model with an `event` reference, rather than
 * being crammed into this document.
 */

export const EVENT_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  PLANNED: 'PLANNED',
  UPCOMING: 'UPCOMING',
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const EVENT_CATEGORIES = Object.freeze({
  WORKSHOP: 'WORKSHOP',
  SEMINAR: 'SEMINAR',
  CONFERENCE: 'CONFERENCE',
  HACKATHON: 'HACKATHON',
  CULTURAL: 'CULTURAL',
  SPORTS: 'SPORTS',
  TECHNICAL: 'TECHNICAL',
  ACADEMIC: 'ACADEMIC',
  OTHER: 'OTHER',
});

/** Statuses treated as "currently active" for admin dashboard roll-ups. */
export const ACTIVE_EVENT_STATUSES = Object.freeze([
  EVENT_STATUSES.UPCOMING,
  EVENT_STATUSES.ONGOING,
]);

/** Registration modes (Phase 14). INDIVIDUAL is the safe default for every
 * pre-existing event — nothing changes for them unless an organiser opts in. */
export const EVENT_REGISTRATION_TYPES = Object.freeze({
  INDIVIDUAL: 'INDIVIDUAL',
  TEAM: 'TEAM',
});

const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required.'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters.'],
      maxlength: [150, 'Title must be at most 150 characters.'],
    },
    description: {
      type: String,
      required: [true, 'Description is required.'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters.'],
      maxlength: [5000, 'Description must be at most 5000 characters.'],
    },
    category: {
      type: String,
      enum: {
        values: Object.values(EVENT_CATEGORIES),
        message: '{VALUE} is not a valid category.',
      },
      default: EVENT_CATEGORIES.OTHER,
    },
    // Owner. Always set from the authenticated session on the server — never
    // from the request body. Must reference an ORGANISER user.
    organiser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An organiser is required.'],
      index: true,
    },
    venue: {
      type: String,
      required: [true, 'Venue is required.'],
      trim: true,
      maxlength: [300, 'Venue must be at most 300 characters.'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required.'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required.'],
    },
    registrationStartDate: { type: Date, default: null },
    registrationEndDate: { type: Date, default: null },
    maxParticipants: {
      type: Number,
      default: null,
      min: [1, 'Maximum participants must be at least 1.'],
      validate: {
        validator: (v) => v === null || v === undefined || Number.isInteger(v),
        message: 'Maximum participants must be a whole number.',
      },
    },
    image: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: (v) => !v || HTTP_URL_PATTERN.test(v),
        message: 'Image must be a valid http(s) URL.',
      },
    },
    status: {
      type: String,
      enum: {
        values: Object.values(EVENT_STATUSES),
        message: '{VALUE} is not a valid event status.',
      },
      default: EVENT_STATUSES.DRAFT,
    },
    // Soft delete — see §23 of the phase brief. Events are never physically
    // removed so that later phases (registrations, attendance, certificates,
    // reports) keep a stable reference. Every query filters these out.
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    // Phase 14 — team registration. Safe default keeps every existing event
    // behaving exactly as before; only an organiser opting into TEAM sets
    // `maxTeamSize`.
    registrationType: {
      type: String,
      enum: {
        values: Object.values(EVENT_REGISTRATION_TYPES),
        message: '{VALUE} is not a valid registration type.',
      },
      default: EVENT_REGISTRATION_TYPES.INDIVIDUAL,
    },
    maxTeamSize: {
      type: Number,
      default: null,
      min: [2, 'Maximum team size must be at least 2.'],
      validate: {
        validator: (v) => v === null || v === undefined || Number.isInteger(v),
        message: 'Maximum team size must be a whole number.',
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

// Cross-field date rules. Run on save() and on validate().
eventSchema.pre('validate', function validateDateOrder(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must not be before the start date.');
  }
  if (
    this.registrationStartDate &&
    this.registrationEndDate &&
    this.registrationEndDate < this.registrationStartDate
  ) {
    this.invalidate('registrationEndDate', 'Registration end must not be before registration start.');
  }
  next();
});

// Helpful compound/simple indexes (see §63): owner listings, status filters,
// date sorting.
eventSchema.index({ organiser: 1, startDate: -1 });
eventSchema.index({ status: 1 });
eventSchema.index({ startDate: -1 });

/**
 * Safe representation returned by the APIs. `organiser` is included only as
 * { id, name, email } when populated, or as the raw id string otherwise.
 */
eventSchema.methods.toPublicObject = function toPublicObject() {
  const organiser =
    this.organiser && this.organiser._id
      ? { id: this.organiser._id.toString(), name: this.organiser.name, email: this.organiser.email }
      : this.organiser?.toString?.() ?? this.organiser;

  return {
    id: this._id.toString(),
    title: this.title,
    description: this.description,
    category: this.category,
    organiser,
    venue: this.venue,
    startDate: this.startDate,
    endDate: this.endDate,
    registrationStartDate: this.registrationStartDate,
    registrationEndDate: this.registrationEndDate,
    maxParticipants: this.maxParticipants,
    image: this.image || '',
    status: this.status,
    registrationType: this.registrationType,
    maxTeamSize: this.maxTeamSize ?? null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Event = mongoose.model('Event', eventSchema);

export default Event;
