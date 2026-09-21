import mongoose from 'mongoose';

/**
 * Attendance — a participant's verified event-day check-in (Phase 7).
 *
 * Deliberately a separate model, not a flag on Registration: a QR code is only
 * a credential, and attendance is its own fact with its own timestamp and its
 * own "who scanned it". Every Attendance row references the Registration it was
 * created from, plus the event and user for straightforward querying.
 *
 * One check-in per registration is enforced by a unique index (not just the UI),
 * so two devices scanning the same QR at once can only ever produce one row.
 */

export const ATTENDANCE_STATUSES = Object.freeze(['PRESENT']);

const attendanceSchema = new mongoose.Schema(
  {
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
      unique: true, // one check-in per registration — the DB-level duplicate guard
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The organiser who performed the scan.
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    checkedInAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: { values: ATTENDANCE_STATUSES, message: '{VALUE} is not a valid attendance status.' },
      default: 'PRESENT',
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

// Event-scoped listing + "most recent check-ins" ordering.
attendanceSchema.index({ event: 1, checkedInAt: -1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
