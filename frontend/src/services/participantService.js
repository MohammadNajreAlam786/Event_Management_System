import api from './api.js';

/**
 * Participant-facing API (Phase 6): public event discovery, registration, the
 * user's own registrations, and — for organisers — the participant list of an
 * event they own. All calls go through the shared Axios instance; the backend
 * derives the user from the session, never from a body/param id.
 */
export const participantService = {
  /** @param {{ search?, category?, upcoming?, page?, limit? }} params */
  async getEvents(params = {}) {
    const { data } = await api.get('/events/public', { params });
    return data.data; // { events, pagination }
  },

  /**
   * Small anonymous-safe preview for the public Home page (Phase 13). Works
   * whether or not the visitor is signed in — no `myRegistration` on the
   * returned events, since the caller's identity isn't known/relevant here.
   */
  async getFeaturedEvents(limit = 6) {
    const { data } = await api.get('/events/public/featured', { params: { limit } });
    return data.data.events;
  },

  async getEvent(id) {
    const { data } = await api.get(`/events/public/${id}`);
    return data.data.event;
  },

  async register(eventId) {
    const { data } = await api.post(`/events/${eventId}/register`, {});
    return data.data; // { registration, event }
  },

  /** Team registration (Phase 14) — `memberEmails` excludes the leader (the caller). */
  async registerTeam(eventId, { teamName, teamSize, memberEmails }) {
    const { data } = await api.post(`/events/${eventId}/register/team`, { teamName, teamSize, memberEmails });
    return data.data; // { team, event }
  },

  async getMyRegistrations(params = {}) {
    const { data } = await api.get('/registrations/mine', { params });
    return data.data.registrations;
  },

  async cancelRegistration(registrationId) {
    const { data } = await api.patch(`/registrations/${registrationId}/cancel`);
    return data.data.registration;
  },

  /** Team leader only — cancels the whole team's registration. */
  async cancelTeamRegistration(teamId) {
    const { data } = await api.patch(`/registrations/teams/${teamId}/cancel`);
    return data.data.team;
  },

  /** Organiser: participants for one of their own events. `params`: { type: 'individual'|'team' }. */
  async getEventRegistrations(eventId, params = {}) {
    const { data } = await api.get(`/events/${eventId}/registrations`, { params });
    return data.data; // { event, summary, teams, registrations }
  },
};

export default participantService;
