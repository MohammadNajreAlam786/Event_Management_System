import api from './api.js';

const teamWorkService = {
  getInvitations: () => api.get('/team-work/invitations').then((r) => r.data.data),
  acceptInvitation: (id) => api.post(`/team-work/invitations/${id}/accept`).then((r) => r.data.data),
  declineInvitation: (id) => api.post(`/team-work/invitations/${id}/decline`).then((r) => r.data.data),
  getTasks: () => api.get('/team-work/tasks').then((r) => r.data.data),
  updateTaskStatus: (id, status) => api.patch(`/team-work/tasks/${id}/status`, { status }).then((r) => r.data.data.task),
  checkInAttendance: (eventId, credential) => api.post(`/team-work/events/${eventId}/attendance/check-in`, { credential }).then((r) => r.data.data),
  requestAccess: (eventId, reason) => api.post(`/team-work/events/${eventId}/access-requests`, { reason }).then((r) => r.data.data.request),
};

export default teamWorkService;
