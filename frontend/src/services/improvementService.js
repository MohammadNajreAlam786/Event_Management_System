import api from './api.js';

/**
 * Future-event improvement recommendations API (Phase 11). Read-only view for
 * the owning organiser or any admin; only the owning organiser may generate.
 * The backend derives the actor from the session — nothing here sends an
 * organiser id.
 */
export const improvementService = {
  /** Latest stored recommendations for one event, or a clear "not generated yet" state. */
  async getImprovements(eventId) {
    const { data } = await api.get(`/events/${eventId}/improvements`);
    return data.data;
  },

  /** Generate (or regenerate) recommendations for an owned, COMPLETED event. */
  async generate(eventId) {
    const { data } = await api.post(`/events/${eventId}/improvements/generate`, {});
    return data.data;
  },
};

export default improvementService;
