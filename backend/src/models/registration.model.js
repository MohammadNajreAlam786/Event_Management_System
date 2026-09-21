import mongoose from 'mongoose';

/**
 * A participant's registration for an event (Phase 6).
 *
 * One document per (user, event) pair — enforced by a unique compound index.
 * Cancelling flips `status` to CANCELLED and stamps `cancelledAt` rather than
 * deleting the row, so participation history survives for later phases
 * (attendance / certificates). Re-registering reactivates the same row, so a
 * user never ends up with two active registrations for one event and the
 * registration `_id` stays stable for attendance to reference.
 *
 * Phase 7 adds `qrNonce` — an opaque per-registration value baked into the
 * participant's signed QR credential. It is (re)issued whenever the
 * registration becomes active and rotated on cancellation, so a cancelled
 * registration's old QR image stops verifying. It is `select: false` — never
 * returned by an API — and is NOT the QR itself (see utils/qrToken.js).
 *
 * Phase 14 adds `team` — set only for a member of a TEAM-registered event
 * (see team.model.js). Deliberately NOT a redesign: a team member's row is a
 * normal Registration in every other respect, so it gets its own QR
 * credential, its own Attendance row and its own certificate eligibility,
 * exactly like an individual registration.
 */
export const REGISTRATION_STATUSES = Object.freeze(['REGISTERED', 'CANCELLED']);

const registrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: { values: REGISTRATION_STATUSES, message: '{VALUE} is not a valid registration status.' },
      default: 'REGISTERED',
    },
    registeredAt: { type: Date, default: Date.now },
    cancelledAt: { type: Date, default: null },
    // Phase 7 — QR attendance credential nonce. Opaque; never exposed.
    qrNonce: { type: String, default: null, select: false },
    // Phase 14 — set for a team-registration member; null for an individual registration.
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
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

// One registration row per (user, event). Prevents duplicate registrations at
// the database level, not just in the UI.
registrationSchema.index({ user: 1, event: 1 }, { unique: true });
// Organiser participant lists + the capacity count.
registrationSchema.index({ event: 1, status: 1 });

const Registration = mongoose.model('Registration', registrationSchema);

export default Registration;
