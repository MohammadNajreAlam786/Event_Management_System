import mongoose from 'mongoose';

/**
 * Notification — a database-backed message to a single recipient about an event
 * lifecycle action (Phase 8).
 *
 * Notifications are created as a side effect of the operations that matter to a
 * participant (registration, check-in, certificate issue, event cancellation /
 * update). Creating one must never break the primary operation — the helpers in
 * notification.service.js swallow and log their own errors.
 */

export const NOTIFICATION_TYPES = Object.freeze([
  'EVENT_REGISTRATION_CONFIRMED',
  'EVENT_CANCELLED',
  'EVENT_UPDATED',
  'ATTENDANCE_RECORDED',
  'CERTIFICATE_ISSUED',
  'FEEDBACK_AVAILABLE',
]);

// Types that are "once ever" for a (recipient, event) pair. EVENT_UPDATED is
// deliberately excluded — an event can be meaningfully edited more than once.
export const ONCE_PER_EVENT_TYPES = Object.freeze([
  'EVENT_REGISTRATION_CONFIRMED',
  'EVENT_CANCELLED',
  'ATTENDANCE_RECORDED',
  'CERTIFICATE_ISSUED',
  'FEEDBACK_AVAILABLE',
]);

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
    type: {
      type: String,
      enum: { values: NOTIFICATION_TYPES, message: '{VALUE} is not a valid notification type.' },
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
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

// The notification centre query: a recipient's list, unread first-ish, newest first.
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
// De-duplication backstop for the "once per event" types (partial unique index).
notificationSchema.index(
  { recipient: 1, event: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: { $in: [...ONCE_PER_EVENT_TYPES] } } },
);

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
