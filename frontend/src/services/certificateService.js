import api from './api.js';

/**
 * Certificate API (Phase 8).
 *
 *   USER      — getMine, download/view own certificate
 *   ORGANISER — getEligibility / generate for an owned COMPLETED event,
 *               download a certificate for one of their events
 *   PUBLIC    — verify(code)
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

export const certificateService = {
  /** Participant: the caller's own certificates. */
  async getMine() {
    const { data } = await api.get('/certificates/mine');
    return data.data.certificates;
  },

  /** Organiser: eligibility list + certificate status for an owned event. */
  async getEligibility(eventId) {
    const { data } = await api.get(`/events/${eventId}/certificates/eligibility`);
    return data.data; // { event, summary, rows }
  },

  /** Organiser: generate certificates for eligible participants (idempotent). */
  async generate(eventId) {
    const { data } = await api.post(`/events/${eventId}/certificates/generate`, {});
    return data.data; // { event, summary, failures }
  },

  /** Fetch the certificate PDF as a Blob (auth cookie sent automatically). */
  async fetchPdf(certificateId, { inline = false } = {}) {
    try {
      const { data } = await api.get(`/certificates/${certificateId}/download`, {
        params: inline ? { inline: 1 } : undefined,
        responseType: 'blob',
      });
      return data; // Blob
    } catch (err) {
      // An error response also arrives as a Blob — surface its real message.
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

  async download(certificateId, filename) {
    const blob = await this.fetchPdf(certificateId);
    triggerBrowserDownload(blob, filename || 'Certificate.pdf');
  },

  async openInNewTab(certificateId) {
    const blob = await this.fetchPdf(certificateId, { inline: true });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  /** Public verification — no auth. */
  async verify(code) {
    const { data } = await api.get(`/certificates/verify/${encodeURIComponent(code)}`);
    return data.data; // { valid, certificate? }
  },
};

export default certificateService;
