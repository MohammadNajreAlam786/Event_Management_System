import PDFDocument from 'pdfkit';

/**
 * Render a post-event report as a PDF buffer (Phase 10).
 *
 * A4 portrait, built-in fonts only. Strictly factual — it reports the numbers
 * computed by analytics.service and nothing else (no recommendations, no
 * success claims — §53/§74). The caller guarantees the event is COMPLETED.
 *
 * Layout uses pdfkit's natural top-to-bottom flow so page breaks are automatic
 * and nothing overlaps or is clipped regardless of value length. The report is
 * typically one to two A4 pages.
 */

const MARGIN = 56;
const NAVY = '#1e293b';
const SLATE = '#475569';
const MUTED = '#94a3b8';
const RULE = '#cbd5e1';
const TRACK = '#e2e8f0';
const FILL = '#6366f1';

const longDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};
const longDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

/**
 * @param {object} analytics  the object returned by analytics.service.getEventAnalytics
 * @param {{ reference?: string, institution?: string }} [opts]
 * @returns {Promise<Buffer>}
 */
export const buildEventReportPdf = (analytics, opts = {}) =>
  new Promise((resolve, reject) => {
    try {
      const institution = opts.institution || 'Sreyas Institute of Engineering and Technology';
      const a = analytics;
      // `compress: false` keeps the text streams readable — useful for
      // automated verification of report content and for transparency.
      const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: MARGIN, compress: false });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const contentW = doc.page.width - MARGIN * 2;
      const bottomLimit = doc.page.height - MARGIN - 16;

      const heading = (text) => {
        doc.moveDown(0.7);
        doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text(text);
        doc.moveDown(0.15);
        const yy = doc.y;
        doc.moveTo(MARGIN, yy).lineTo(doc.page.width - MARGIN, yy).lineWidth(0.5).strokeColor(RULE).stroke();
        doc.moveDown(0.45);
      };

      const row = (label, value) => {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(SLATE)
          .text(`${label}:  `, { continued: true })
          .font('Helvetica-Bold')
          .fillColor(NAVY)
          .text(String(value));
        doc.moveDown(0.12);
      };

      const bar = (label, value, max, display) => {
        if (doc.y > bottomLimit - 12) doc.addPage();
        const y = doc.y;
        const trackX = MARGIN + 110;
        const trackW = contentW - 110 - 44;
        // Clamp to [0, 1] and reject non-finite / negative inputs (Issue 9).
        const frac =
          Number.isFinite(value) && Number.isFinite(max) && max > 0 && value > 0
            ? Math.min(1, value / max)
            : 0;
        doc.fillColor(SLATE).font('Helvetica').fontSize(9).text(label, MARGIN, y + 1, { width: 104, lineBreak: false });
        doc.roundedRect(trackX, y, trackW, 9, 2).fillColor(TRACK).fill();
        if (frac > 0) doc.roundedRect(trackX, y, Math.max(2, trackW * frac), 9, 2).fillColor(FILL).fill();
        doc
          .fillColor(NAVY)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(String(display ?? value), trackX + trackW + 4, y, { width: 40, align: 'right', lineBreak: false });
        doc.x = MARGIN;
        doc.y = y + 15;
      };

      // ---- header ----
      doc.fillColor(NAVY).font('Times-Bold').fontSize(16).text(institution, { align: 'center' });
      doc
        .fillColor(SLATE)
        .font('Helvetica')
        .fontSize(9)
        .text('Department of CSE (Artificial Intelligence & Machine Learning)', { align: 'center' });
      doc.moveDown(0.5);
      doc
        .fillColor(NAVY)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('POST-EVENT REPORT', { align: 'center', characterSpacing: 1 });
      doc.moveDown(0.25);
      const hy = doc.y;
      doc.moveTo(MARGIN, hy).lineTo(doc.page.width - MARGIN, hy).lineWidth(1).strokeColor(NAVY).stroke();

      // ---- identification ----
      heading('Event');
      row('Event name', a.event.title);
      row('Event date', longDate(a.event.startDate));
      row('Event status', a.event.status);
      row('Organiser', a.event.organiser?.name || '—');
      row('Report reference', opts.reference || '—');
      row('Event ID', a.event.id);
      row('Generated', longDateTime(a.generatedAt));

      // ---- registration ----
      heading('Registration statistics');
      row('Registered participants', a.registrations.total);
      row('Cancelled registrations', a.registrations.cancelled);

      // ---- attendance ----
      heading('Attendance statistics');
      row('Present', a.attendance.present);
      row('Absent / not present', a.attendance.absent);
      row('Attendance rate', `${a.attendance.rate}%`);
      doc.moveDown(0.2);
      bar('Registered', a.registrations.total, a.registrations.total, a.registrations.total);
      bar('Attended', a.attendance.present, a.registrations.total, a.attendance.present);

      // ---- feedback ----
      heading('Feedback statistics');
      row('Feedback responses', a.feedback.total);
      row('Average rating', a.feedback.averageRating != null ? `${a.feedback.averageRating} / 5` : 'No feedback');
      row('Feedback participation rate', `${a.participation.feedbackParticipationRate ?? 0}% of those who attended`);
      if (a.feedback.total > 0) {
        doc.moveDown(0.2);
        for (const star of [5, 4, 3, 2, 1]) {
          bar(
            `${star} star${star === 1 ? '' : 's'}`,
            a.feedback.ratingDistribution[star],
            a.feedback.total,
            a.feedback.ratingDistribution[star],
          );
        }
      }

      // ---- sentiment ----
      heading('Sentiment distribution');
      if (a.sentiment.analyzed > 0) {
        row('Positive', `${a.sentiment.positive}  (${a.sentiment.positivePct}%)`);
        row('Neutral', `${a.sentiment.neutral}  (${a.sentiment.neutralPct}%)`);
        row('Negative', `${a.sentiment.negative}  (${a.sentiment.negativePct}%)`);
        row('Analysed responses', a.sentiment.analyzed);
        if (a.sentiment.unanalyzed > 0) row('Not analysed', a.sentiment.unanalyzed);
        doc.moveDown(0.2);
        bar('Positive', a.sentiment.positive, a.sentiment.analyzed, a.sentiment.positive);
        bar('Neutral', a.sentiment.neutral, a.sentiment.analyzed, a.sentiment.neutral);
        bar('Negative', a.sentiment.negative, a.sentiment.analyzed, a.sentiment.negative);
      } else {
        row('Analysed responses', '0 (no feedback comments analysed)');
      }

      // ---- certificates ----
      heading('Certificate statistics');
      row('Certificates issued', a.certificates.issued);
      row('Eligible participants', `${a.certificates.eligible}  (everyone who attended)`);
      row('Issuance rate', `${a.certificates.issuanceRate ?? 0}%`);

      // ---- summary ----
      heading('Event performance summary');
      doc
        .fillColor(SLATE)
        .font('Helvetica')
        .fontSize(10)
        .text(a.performanceSummary || 'No statistical summary is available for this event.', {
          width: contentW,
          align: 'left',
          lineGap: 2,
        });
      doc.moveDown(0.7);
      const fy = doc.y;
      doc.moveTo(MARGIN, fy).lineTo(doc.page.width - MARGIN, fy).lineWidth(0.5).strokeColor(RULE).stroke();
      doc.moveDown(0.4);
      doc
        .fillColor(MUTED)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text(
          `This is a factual statistical summary generated from event records on ${longDateTime(
            a.generatedAt,
          )}. It contains no predictions or recommendations. ${institution}.`,
          { width: contentW, align: 'left' },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
