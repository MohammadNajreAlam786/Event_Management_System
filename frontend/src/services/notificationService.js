import api from './api.js';

/**
 * Notification centre API (Phase 8). Every call is scoped to the authenticated
 * participant by the backend — there is no way to pass another user's id.
 */
export const notificationService = {
  /** @param {{ unread?: boolean, page?: number, limit?: number }} params */
  async list(params = {}) {
    const { data } = await api.get('/notifications', { params });
    return data.data; // { notifications, unreadCount, pagination }
  },

  async unreadCount() {
    const { data } = await api.get('/notifications/unread-count');
    return data.data.unreadCount;
  },

  async markRead(notificationId) {
    const { data } = await api.patch(`/notifications/${notificationId}/read`);
    return data.data;
  },

  async markAllRead() {
    const { data } = await api.post('/notifications/read-all', {});
    return data.data; // { updated }
  },
};

export default notificationService;
