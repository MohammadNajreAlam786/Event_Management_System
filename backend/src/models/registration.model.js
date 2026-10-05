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
 * Phase 7 adds `attendanceCredential` — a cryptographically random, short
 * credential issued for each active registration. It is `select: false` so it
 * is only returned to the authenticated registration owner by the QR endpoint.
 * `qrNonce` remains solely for backward-compatible validation of previously
 * issued signed QR tokens during the credential migration.
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
    // Phase 15 — short, case-sensitive attendance credential. The database
    // index below guarantees that no two registrations can share a code.
    attendanceCredential: {
      type: String,
      default: null,
      select: false,
      trim: true,
      match: [/^[A-Za-z0-9]{10}$/, 'Attendance credential must be 10 alphanumeric characters.'],
    },
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
registrationSchema.index({ attendanceCredential: 1 }, { unique: true, sparse: true });
// Organiser participant lists + the capacity count.
registrationSchema.index({ event: 1, status: 1 });

const Registration = mongoose.model('Registration', registrationSchema);

export default Registration;
