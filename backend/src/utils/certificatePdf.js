import PDFDocument from 'pdfkit';

/**
 * Render a participation certificate as a PDF buffer (Phase 8).
 *
 * A4 landscape, built-in fonts only (no external font files, no logos). The
 * layout uses explicit coordinates so nothing overlaps or clips regardless of
 * name / title length (long values are ellipsised by pdfkit's `ellipsis`).
 */

const PAGE = { width: 841.89, height: 595.28 };
const NAVY = '#1e293b';
const GOLD = '#b45309';
const SLATE = '#475569';

/** Group a raw verification code into a readable XXXX-XXXX-… form. */
export const formatVerificationCode = (code) =>
  String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/(.{4})/g, '$1-')
    .replace(/-$/, '');

const formatLongDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * @param {object} cert  a Certificate document / lean object
 * @param {{ verifyBaseUrl?: string }} [opts]
 * @returns {Promise<Buffer>}
 */
export const buildCertificatePdf = (cert, opts = {}) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const cx = PAGE.width / 2;

      // --- decorative double border ---
      doc.lineWidth(3).strokeColor(NAVY).rect(24, 24, PAGE.width - 48, PAGE.height - 48).stroke();
      doc.lineWidth(1).strokeColor(GOLD).rect(33, 33, PAGE.width - 66, PAGE.height - 66).stroke();

      // --- institution header ---
      doc.fillColor(NAVY).font('Times-Bold').fontSize(20)
        .text(cert.institution || 'Sreyas Institute of Engineering and Technology', 60, 62, {
          width: PAGE.width - 120,
          align: 'center',
        });
      doc.fillColor(SLATE).font('Helvetica').fontSize(10)
        .text('Department of CSE (Artificial Intelligence & Machine Learning)', 60, 88, {
          width: PAGE.width - 120,
          align: 'center',
        });

      doc.moveTo(cx - 170, 112).lineTo(cx + 170, 112).lineWidth(1).strokeColor(GOLD).stroke();

      // --- title ---
      doc.fillColor(GOLD).font('Times-Bold').fontSize(30)
        .text('CERTIFICATE OF PARTICIPATION', 60, 132, {
          width: PAGE.width - 120,
          align: 'center',
          characterSpacing: 2,
        });

      // --- body ---
      doc.fillColor(SLATE).font('Times-Italic').fontSize(13)
        .text('This certificate is proudly presented to', 60, 192, {
          width: PAGE.width - 120,
          align: 'center',
        });

      doc.fillColor(NAVY).font('Times-Bold').fontSize(30)
        .text(cert.recipientName || 'Participant', 90, 218, {
          width: PAGE.width - 180,
          align: 'center',
          ellipsis: true,
          lineBreak: false,
        });
      doc.moveTo(cx - 220, 262).lineTo(cx + 220, 262).lineWidth(0.75).strokeColor('#cbd5e1').stroke();

      doc.fillColor(SLATE).font('Times-Roman').fontSize(13)
        .text('for actively participating in', 60, 278, { width: PAGE.width - 120, align: 'center' });

      doc.fillColor(NAVY).font('Times-Bold').fontSize(19)
        .text(cert.eventTitle || 'the event', 90, 300, {
          width: PAGE.width - 180,
          align: 'center',
          ellipsis: true,
          lineBreak: false,
        });

      const dateLine = formatLongDate(cert.eventDate);
      if (dateLine) {
        doc.fillColor(SLATE).font('Times-Roman').fontSize(12)
          .text(`held on ${dateLine}`, 60, 330, { width: PAGE.width - 120, align: 'center' });
      }

      doc.fillColor(SLATE).font('Times-Italic').fontSize(11)
        .text(
          'Attendance was verified through QR-based check-in at the event.',
          120,
          356,
          { width: PAGE.width - 240, align: 'center' },
        );

      // --- signatory ---
      const sigY = 430;
      doc.moveTo(cx - 110, sigY).lineTo(cx + 110, sigY).lineWidth(0.75).strokeColor(NAVY).stroke();
      doc.fillColor(NAVY).font('Times-Bold').fontSize(12)
        .text(cert.issuerName || 'Event Organiser', cx - 150, sigY + 6, { width: 300, align: 'center' });
      doc.fillColor(SLATE).font('Helvetica').fontSize(9)
        .text('Organiser', cx - 150, sigY + 22, { width: 300, align: 'center' });

      // --- footer: number / issue date (left), verification (right) ---
      const footY = PAGE.height - 96;
      doc.fillColor(SLATE).font('Helvetica').fontSize(9);
      doc.text(`Certificate No.  ${cert.certificateNumber || ''}`, 60, footY, { width: 340 });
      doc.text(`Issue Date  ${formatLongDate(cert.issueDate) || ''}`, 60, footY + 14, { width: 340 });

      const codeText = formatVerificationCode(cert.verificationCode);
      doc.text(`Verification Code  ${codeText}`, PAGE.width - 400, footY, { width: 340, align: 'right' });
      if (opts.verifyBaseUrl) {
        doc.fillColor('#94a3b8')
          .text(`Verify at ${opts.verifyBaseUrl.replace(/\/+$/, '')}/verify/${codeText}`, PAGE.width - 400, footY + 14, {
            width: 340,
            align: 'right',
          });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
