import api from './api.js';

/**
 * AI Planning Assistant (Phase 5). One call: analyse the current planning data
 * for an event the organiser owns. The backend gathers the data, calls the
 * FastAPI service and returns the structured result. Analysis can take longer
 * than a normal request, so this call gets its own timeout.
 */
export const aiPlanningService = {
  analyze: (eventId) =>
    api.post(`/events/${eventId}/ai/analyze`, {}, { timeout: 45000 }).then((r) => r.data.data),
};

export default aiPlanningService;
