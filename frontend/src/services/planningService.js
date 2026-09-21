import api from './api.js';

/**
 * Pre-event planning API calls (Phase 4). All go through the shared Axios
 * instance. Every endpoint requires the authenticated ORGANISER to own
 * `eventId`; the backend enforces that.
 */
const base = (eventId) => `/events/${eventId}`;

export const planningService = {
  getOverview: (eventId) => api.get(`${base(eventId)}/planning/overview`).then((r) => r.data.data),
  getReadiness: (eventId) => api.get(`${base(eventId)}/planning/readiness`).then((r) => r.data.data),

  // Tasks
  getTasks: (eventId, params = {}) => api.get(`${base(eventId)}/tasks`, { params }).then((r) => r.data.data),
  createTask: (eventId, body) => api.post(`${base(eventId)}/tasks`, body).then((r) => r.data.data.task),
  updateTask: (eventId, id, body) => api.patch(`${base(eventId)}/tasks/${id}`, body).then((r) => r.data.data.task),
  deleteTask: (eventId, id) => api.delete(`${base(eventId)}/tasks/${id}`).then((r) => r.data),

  // Schedule
  getSchedule: (eventId) => api.get(`${base(eventId)}/schedule`).then((r) => r.data.data),
  createSchedule: (eventId, body) => api.post(`${base(eventId)}/schedule`, body).then((r) => r.data.data.item),
  updateSchedule: (eventId, id, body) => api.patch(`${base(eventId)}/schedule/${id}`, body).then((r) => r.data.data.item),
  deleteSchedule: (eventId, id) => api.delete(`${base(eventId)}/schedule/${id}`).then((r) => r.data),

  // Resources
  getResources: (eventId, params = {}) => api.get(`${base(eventId)}/resources`, { params }).then((r) => r.data.data),
  createResource: (eventId, body) => api.post(`${base(eventId)}/resources`, body).then((r) => r.data.data.resource),
  updateResource: (eventId, id, body) => api.patch(`${base(eventId)}/resources/${id}`, body).then((r) => r.data.data.resource),
  deleteResource: (eventId, id) => api.delete(`${base(eventId)}/resources/${id}`).then((r) => r.data),

  // Budget
  getBudget: (eventId, params = {}) => api.get(`${base(eventId)}/budget`, { params }).then((r) => r.data.data),
  createBudgetItem: (eventId, body) => api.post(`${base(eventId)}/budget`, body).then((r) => r.data.data.item),
  updateBudgetItem: (eventId, id, body) => api.patch(`${base(eventId)}/budget/${id}`, body).then((r) => r.data.data.item),
  deleteBudgetItem: (eventId, id) => api.delete(`${base(eventId)}/budget/${id}`).then((r) => r.data),

  // Team
  getTeam: (eventId, params = {}) => api.get(`${base(eventId)}/team`, { params }).then((r) => r.data.data),
  createTeamMember: (eventId, body) => api.post(`${base(eventId)}/team`, body).then((r) => r.data.data.member),
  updateTeamMember: (eventId, id, body) => api.patch(`${base(eventId)}/team/${id}`, body).then((r) => r.data.data.member),
  deleteTeamMember: (eventId, id) => api.delete(`${base(eventId)}/team/${id}`).then((r) => r.data),
};

export default planningService;
