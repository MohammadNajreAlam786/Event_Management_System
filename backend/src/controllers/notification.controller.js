import { asyncHandler } from '../utils/asyncHandler.js';
import * as notificationService from '../services/notification.service.js';

/** GET /api/notifications?unread=&page=&limit= */
export const list = asyncHandler(async (req, res) => {
  const data = await notificationService.listForUser({
    userId: req.user.id,
    unreadOnly: req.query.unread,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.status(200).json({ success: true, data });
});

/** GET /api/notifications/unread-count */
export const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.unreadCountForUser(req.user.id);
  res.status(200).json({ success: true, data: { unreadCount: count } });
});

/** PATCH /api/notifications/:notificationId/read */
export const markRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markRead({
    userId: req.user.id,
    notificationId: req.params.notificationId,
  });
  res.status(200).json({ success: true, data, message: 'Notification marked as read.' });
});

/** POST /api/notifications/read-all */
export const markAllRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllRead(req.user.id);
  res.status(200).json({ success: true, data, message: 'All notifications marked as read.' });
});
