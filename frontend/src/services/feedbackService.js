import api from './api.js';

/**
 * Feedback + sentiment API (Phase 9). Built on the shared Axios instance; the
 * backend derives the participant / organiser from the session and enforces
 * eligibility + ownership — never a body/param id.
 *
 *   USER      — getMine / submit / update  (own feedback only)
 *   ORGANISER — listForEvent               (own events only)
 */
export const feedbackService = {
  /** Participant: eligibility + the caller's feedback (if any) for one event. */
  async getMine(eventId) {
    const { data } = await api.get(`/events/${eventId}/feedback/mine`);
    return data.data; // { event, eligible, reason, feedback }
  },

  /** Participant: submit feedback for one event. */
  async submit(eventId, { rating, comment }) {
    const { data } = await api.post(`/events/${eventId}/feedback`, { rating, comment });
    return data.data; // { feedback, event }
  },

  /** Participant: edit their own feedback. */
  async update(eventId, feedbackId, { rating, comment }) {
    const { data } = await api.patch(`/events/${eventId}/feedback/${feedbackId}`, { rating, comment });
    return data.data; // { feedback }
  },

  /** Organiser: all feedback + a basic summary for an owned event. */
  async listForEvent(eventId) {
    const { data } = await api.get(`/events/${eventId}/feedback`);
    return data.data; // { event, summary, feedback }
  },
};

export default feedbackService;
