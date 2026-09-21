import api from './api.js';

/**
 * QR attendance API (Phase 7). Built on the shared Axios instance; the backend
 * derives identity + ownership from the session, never from a body/param id.
 *
 *   USER      — getMyQr (own registration only)
 *   ORGANISER — checkIn / getEventAttendance / getAttendanceSummary (own events only)
 *   ORGANISER | ADMIN — exportAttendance (Phase 14, own events only for ORGANISER)
 */

const triggerBrowserDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export const attendanceService = {
  /** The authenticated participant's attendance QR for one of their registrations. */
  async getMyQr(registrationId) {
    const { data } = await api.get(`/registrations/${registrationId}/qr`);
    return data.data; // { registration, event, qr: { credential, payload }, attendance }
  },

  /**
   * Organiser: verify a scanned credential and record attendance for an owned event.
   * Resolves with `{ ok: true, data }` on a fresh check-in, or
   * `{ ok: false, alreadyCheckedIn: true, data }` when the participant was already present.
   */
  async checkIn(eventId, credential) {
    try {
      const { data } = await api.post(`/events/${eventId}/attendance/check-in`, { credential });
      return { ok: true, data: data.data };
    } catch (err) {
      if (err.status === 409 && err.data?.alreadyCheckedIn) {
        return { ok: false, alreadyCheckedIn: true, data: err.data };
      }
      throw err;
    }
  },

  /** Organiser: attendance rows for an owned event. `params`: { status, search }. */
  async getEventAttendance(eventId, params = {}) {
    const { data } = await api.get(`/events/${eventId}/attendance`, { params });
    return data.data; // { event, summary, filter, rows, recentCheckIns }
  },

  /** Organiser: attendance summary for an owned event. */
  async getAttendanceSummary(eventId) {
    const { data } = await api.get(`/events/${eventId}/attendance/summary`);
    return data.data; // { event, summary }
  },

  /** Organiser (own events) | Admin (any): download the attendance sheet as a CSV file. */
  async exportAttendance(eventId) {
    try {
      const response = await api.get(`/events/${eventId}/attendance/export`, { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] || '';
      const match = /filename="?([^"]+)"?/.exec(disposition);
      triggerBrowserDownload(response.data, match?.[1] || 'attendance.csv');
    } catch (err) {
      if (err.responseBlob instanceof Blob) {
        try {
          const json = JSON.parse(await err.responseBlob.text());
          if (json?.message) err.message = json.message;
        } catch {
          /* keep the generic message */
        }
      }
      throw err;
    }
  },
};

export default attendanceService;
