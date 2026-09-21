import api from './api.js';

/**
 * Post-event analytics + reporting API (Phase 10). Read-only. The backend
 * derives the actor from the session and enforces ownership (ORGANISER → own
 * events; ADMIN → any); it never reads an organiser id from the request.
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

export const analyticsService = {
  /** Full analytics for one event (ORGANISER owner or ADMIN). */
  async getEventAnalytics(eventId) {
    const { data } = await api.get(`/events/${eventId}/analytics`);
    return data.data;
  },

  /** Basic platform roll-up (ADMIN only). */
  async getPlatformSummary() {
    const { data } = await api.get('/admin/analytics/summary');
    return data.data;
  },

  /** Fetch the event report PDF as a Blob. `inline` for preview. */
  async fetchReport(eventId, { inline = false } = {}) {
    try {
      const { data } = await api.get(`/events/${eventId}/report`, {
        params: inline ? { inline: 1 } : undefined,
        responseType: 'blob',
      });
      return data; // Blob
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

  async downloadReport(eventId, filename) {
    const blob = await this.fetchReport(eventId);
    triggerBrowserDownload(blob, filename || 'Event_Report.pdf');
  },

  async openReport(eventId) {
    const blob = await this.fetchReport(eventId, { inline: true });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};

export default analyticsService;
