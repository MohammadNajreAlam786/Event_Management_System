import mongoose from 'mongoose';

import Notification from '../models/notification.model.js';
import Registration from '../models/registration.model.js';
import Attendance from '../models/attendance.model.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';

/**
 * Notification domain logic (Phase 8).
 *
 * The `notify*` producers are called as side effects of registration, check-in,
 * certificate issue and event cancellation/update. They MUST NOT break the
 * primary operation, so every one swallows and logs its own errors and never
 * throws. De-duplication for the "once per event" types is backed by a partial
 * unique index on the model (E11000 is treated as "already sent").
 */

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Create one notification. Returns `{ created }`. Never throws:
 *  - a duplicate (partial unique index) resolves to `{ created: false }`
 *  - any other failure is logged and resolves to `{ created: false }`
 */
export const createNotification = async ({ recipient, event = null, type, title, message }) => {
  try {
    await Notification.create({ recipient, event, type, title, message });
    return { created: true };
  } catch (err) {
    if (err && err.code === 11000) return { created: false };
    logger.warn(`notification create failed (${type} -> ${recipient}): ${err.message}`);
    return { created: false };
  }
};

const notifyRegisteredParticipants = async ({ eventId, type, title, message, exclude }) => {
  try {
    const regs = await Registration.find({ event: eventId, status: 'REGISTERED' }).select('user').lean();
    const seen = new Set();
    let sent = 0;
    for (const r of regs) {
      const uid = String(r.user);
      if (seen.has(uid) || (exclude && uid === String(exclude))) continue;
      seen.add(uid);
      // eslint-disable-next-line no-await-in-loop
      const { created } = await createNotification({ recipient: r.user, event: eventId, type, title, message });
      if (created) sent += 1;
    }
    return sent;
  } catch (err) {
    logger.warn(`notifyRegisteredParticipants failed (${type}, event ${eventId}): ${err.message}`);
    return 0;
  }
};

/* ---------------- producers (side effects — never throw) ---------------- */

export const notifyRegistrationConfirmed = ({ userId, eventId, eventTitle }) =>
  createNotification({
    recipient: userId,
    event: eventId,
    type: 'EVENT_REGISTRATION_CONFIRMED',
    title: 'Registration confirmed',
    message: `You have successfully registered for "${eventTitle}".`,
  });

export const notifyAttendanceRecorded = ({ userId, eventId, eventTitle }) =>
  createNotification({
    recipient: userId,
    event: eventId,
    type: 'ATTENDANCE_RECORDED',
    title: 'Attendance recorded',
    message: `Your attendance for "${eventTitle}" has been recorded.`,
  });

export const notifyCertificateIssued = ({ userId, eventId, eventTitle }) =>
  createNotification({
    recipient: userId,
    event: eventId,
    type: 'CERTIFICATE_ISSUED',
    title: 'Certificate available',
    message: `Your certificate for "${eventTitle}" is now available.`,
  });

export const notifyEventCancelled = ({ eventId, eventTitle }) =>
  notifyRegisteredParticipants({
    eventId,
    type: 'EVENT_CANCELLED',
    title: 'Event cancelled',
    message: `"${eventTitle}" has been cancelled.`,
  });

export const notifyEventUpdated = ({ eventId, eventTitle, summary }) =>
  notifyRegisteredParticipants({
    eventId,
    type: 'EVENT_UPDATED',
    title: 'Event details updated',
    message: `Details for "${eventTitle}" have changed${summary ? `: ${summary}.` : '.'}`,
  });

/**
 * FEEDBACK_AVAILABLE (Phase 9) — sent only to participants who are actually
 * eligible for feedback: a currently-REGISTERED registration AND a PRESENT
 * attendance for the event (§42). De-duplicated per (recipient, event) by the
 * partial unique index, so re-running it (e.g. an event toggled COMPLETED
 * twice) never sends a second copy (§43).
 */
export const notifyFeedbackAvailable = async ({ eventId, eventTitle }) => {
  try {
    const [regs, atts, alreadySent] = await Promise.all([
      Registration.find({ event: eventId, status: 'REGISTERED' }).select('user').lean(),
      Attendance.find({ event: eventId, status: 'PRESENT' }).select('user').lean(),
      Notification.find({ event: eventId, type: 'FEEDBACK_AVAILABLE' }).select('recipient').lean(),
    ]);
    const present = new Set(atts.map((a) => String(a.user)));
    // Safe existence check (§43) — independent of the partial unique index, so a
    // deployment whose index predates this type still never double-notifies.
    const notified = new Set(alreadySent.map((n) => String(n.recipient)));
    const seen = new Set();
    let sent = 0;
    for (const r of regs) {
      const uid = String(r.user);
      if (seen.has(uid) || notified.has(uid) || !present.has(uid)) continue;
      seen.add(uid);
      // eslint-disable-next-line no-await-in-loop
      const { created } = await createNotification({
        recipient: r.user,
        event: eventId,
        type: 'FEEDBACK_AVAILABLE',
        title: 'Feedback available',
        message: `Feedback is now open for "${eventTitle}".`,
      });
      if (created) sent += 1;
    }
    return sent;
  } catch (err) {
    logger.warn(`notifyFeedbackAvailable failed (event ${eventId}): ${err.message}`);
    return 0;
  }
};

/* ---------------- reads / mutations (authenticated USER, own only) ---------------- */

export const listForUser = async ({ userId, unreadOnly, page, limit }) => {
  const filter = { recipient: userId };
  if (unreadOnly === true || unreadOnly === 'true' || unreadOnly === '1') filter.read = false;

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(limit, 10) || DEFAULT_PAGE_SIZE));

  const [docs, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('event', 'title')
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);

  return {
    notifications: docs.map((n) => ({
      id: String(n._id),
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
      event: n.event ? { id: String(n.event._id), title: n.event.title } : null,
    })),
    unreadCount: unread,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

export const unreadCountForUser = async (userId) =>
  Notification.countDocuments({ recipient: userId, read: false });

export const markRead = async ({ userId, notificationId }) => {
  if (!mongoose.isValidObjectId(notificationId)) throw ApiError.badRequest('Invalid notification id.');
  const notification = await Notification.findById(notificationId);
  if (!notification) throw ApiError.notFound('Notification not found.');
  if (String(notification.recipient) !== String(userId)) {
    throw ApiError.forbidden('You can only update your own notifications.');
  }
  if (!notification.read) {
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
  }
  return { id: String(notification._id), read: true };
};

export const markAllRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
  return { updated: result.modifiedCount ?? result.nModified ?? 0 };
};
