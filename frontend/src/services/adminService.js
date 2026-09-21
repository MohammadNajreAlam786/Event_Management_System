import api from './api.js';

/**
 * Admin API calls. Uses the shared Axios instance (frontend/src/services/api.js)
 * — no separate client, no duplicated auth handling. Every call below hits an
 * endpoint that requires an authenticated ADMIN; the backend enforces that
 * independently of anything here.
 */
export const adminService = {
  async getDashboardStats() {
    const { data } = await api.get('/admin/dashboard/stats');
    return data.data; // { totalUsers, totalOrganisers, totalEvents, activeEvents, completedEvents, cancelledEvents, recentActivity }
  },

  /** @param {{ search?: string, role?: string, status?: string, page?: number, limit?: number }} params */
  async getUsers(params = {}) {
    const { data } = await api.get('/admin/users', { params });
    return data.data; // { users, pagination }
  },

  async updateUserStatus(id, status) {
    const { data } = await api.patch(`/admin/users/${id}/status`, { status });
    return data; // { success, data: { user }, message }
  },

  /** @param {{ search?: string, status?: string, page?: number, limit?: number }} params */
  async getOrganisers(params = {}) {
    const { data } = await api.get('/admin/organisers', { params });
    return data.data;
  },

  async updateOrganiserStatus(id, status) {
    const { data } = await api.patch(`/admin/organisers/${id}/status`, { status });
    return data;
  },

  /** @param {{ search?: string, status?: string, page?: number, limit?: number }} params */
  async getEvents(params = {}) {
    const { data } = await api.get('/admin/events', { params });
    return data.data; // { events, pagination }
  },

  async updateEventStatus(id, status) {
    const { data } = await api.patch(`/admin/events/${id}/status`, { status });
    return data; // { success, data: { event }, message }
  },
};

export default adminService;
