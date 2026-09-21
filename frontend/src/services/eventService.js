import api from './api.js';

/**
 * Organiser event API calls, via the shared Axios instance. The backend
 * always derives ownership from the session — nothing here sends an
 * organiser id.
 */
export const eventService = {
  async createEvent(payload) {
    const { data } = await api.post('/events', payload);
    return data.data.event;
  },

  /** @param {{ search?: string, status?: string, page?: number, limit?: number }} params */
  async getMyEvents(params = {}) {
    const { data } = await api.get('/events/my', { params });
    return data.data; // { events, pagination }
  },

  async getMyEventStats() {
    const { data } = await api.get('/events/my/stats');
    return data.data; // { total, draft, planned, upcoming, ongoing, completed, cancelled }
  },

  async getEvent(id) {
    const { data } = await api.get(`/events/${id}`);
    return data.data.event;
  },

  async updateEvent(id, payload) {
    const { data } = await api.patch(`/events/${id}`, payload);
    return data.data.event;
  },

  async updateEventStatus(id, status) {
    const { data } = await api.patch(`/events/${id}/status`, { status });
    return data.data.event;
  },

  async deleteEvent(id) {
    const { data } = await api.delete(`/events/${id}`);
    return data;
  },
};

export default eventService;
