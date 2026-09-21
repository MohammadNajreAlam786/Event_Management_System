import crypto from 'node:crypto';
import mongoose from 'mongoose';

import Certificate from '../models/certificate.model.js';
import Registration from '../models/registration.model.js';
import Attendance from '../models/attendance.model.js';
import { nextSequence } from '../models/counter.model.js';
import { ROLES } from '../models/user.model.js';
import { EVENT_STATUSES } from '../models/event.model.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { loadOwnedEvent } from './event.service.js';
import { buildCertificatePdf, formatVerificationCode } from '../utils/certificatePdf.js';
import { notifyCertificateIssued } from './notification.service.js';

/**
 * Certificate domain logic (Phase 8).
 *
 * Eligibility (§5) — a participant is eligible when ALL hold:
 *   1. a Registration exists for the event
 *   2. that Registration is currently REGISTERED  (see §57 policy below)
 *   3. an Attendance row exists for that Registration
 *   4. Attendance.status === 'PRESENT'
 *   5. Event.status === 'COMPLETED'
 *
 * §57 policy (documented): if a participant checked in and *later* cancelled
 * their registration, they are NOT eligible for a NEW certificate (a cancelled
 * registration is not "valid for the event"). A certificate already issued
 * before the cancel is kept — it is never auto-deleted or revoked.
 *
 * Storage (§18): the PDF is rendered on demand from the Certificate record.
 * No PDF files are written to disk, so there is no filesystem path to traverse
 * (§61) and nothing to clean up.
 */

const CERT_TYPE = 'PARTICIPATION';
const COMPLETED = EVENT_STATUSES.COMPLETED;

// Verification-code alphabet: 32 unambiguous symbols (no I/L/O/U). 256 % 32 === 0,
// so `byte % 32` is uniform.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789';

const makeVerificationCode = () => {
  const b = crypto.randomBytes(16);
  let s = '';
  for (let i = 0; i < 16; i += 1) s += CODE_ALPHABET[b[i] % 32];
  return s;
};

const normaliseCode = (raw) => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const makeCertificateNumber = async () => {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`certificate-${year}`);
  return `CERT-${year}-${String(seq).padStart(6, '0')}`;
};

const safeFilename = (value) =>
  String(value ?? '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'Event';

/** Evaluate one participant's certificate eligibility. */
const evaluate = (registration, attendance, event) => {
  const attendanceStatus = attendance ? attendance.status : null;
  if (event.status !== COMPLETED) return { attendanceStatus, eligible: false, reason: 'Event is not completed yet.' };
  if (registration.status !== 'REGISTERED') return { attendanceStatus, eligible: false, reason: 'Registration was cancelled.' };
  if (!attendance) return { attendanceStatus, eligible: false, reason: 'Did not check in at the event.' };
  if (attendance.status !== 'PRESENT') return { attendanceStatus, eligible: false, reason: 'Not marked present.' };
  return { attendanceStatus, eligible: true, reason: null };
};

const gather = async (eventId) => {
  const [registrations, attendances, certificates] = await Promise.all([
    Registration.find({ event: eventId }).populate('user', 'name email').sort({ registeredAt: -1 }).lean(),
    Attendance.find({ event: eventId }).lean(),
    Certificate.find({ event: eventId }).lean(),
  ]);
  return {
    registrations,
    attByReg: new Map(attendances.map((a) => [String(a.registration), a])),
    certByUser: new Map(certificates.map((c) => [String(c.user), c])),
  };
};

/** GET /api/events/:id/certificates/eligibility — organiser view for an owned event. */
export const listEligibility = async ({ organiserId, eventId }) => {
  const event = await loadOwnedEvent(eventId, organiserId); // 400 bad id / 404 missing / 403 not owner
  const { registrations, attByReg, certByUser } = await gather(eventId);

  const rows = registrations.map((reg) => {
    const userId = String(reg.user?._id ?? reg.user);
    const att = attByReg.get(String(reg._id)) || null;
    const existing = certByUser.get(userId) || null;
    const e = evaluate(reg, att, event);
    return {
      userId,
      name: reg.user?.name ?? 'Unknown participant',
      email: reg.user?.email ?? null,
      registrationStatus: reg.status,
      attendanceStatus: e.attendanceStatus,
      eligible: e.eligible && !existing,
      reason: existing ? 'Certificate already issued.' : e.reason,
      certificate: existing
        ? {
            id: String(existing._id),
            certificateNumber: existing.certificateNumber,
            status: existing.status,
            issueDate: existing.issueDate,
          }
        : null,
    };
  });

  const present = rows.filter((r) => r.attendanceStatus === 'PRESENT').length;
  const issued = rows.filter((r) => r.certificate).length;
  const eligible = rows.filter((r) => r.eligible).length;

  return {
    event: {
      id: String(event._id),
      title: event.title,
      status: event.status,
      startDate: event.startDate,
      eventCompleted: event.status === COMPLETED,
    },
    summary: {
      totalParticipants: rows.length,
      present,
      eligible,
      issued,
      notEligible: rows.length - eligible - issued,
    },
    rows,
  };
};

/** Create one certificate: smoke-render the PDF first, then persist (§28). */
const issueCertificate = async ({ event, registration, attendance }) => {
  const userId = registration.user?._id ?? registration.user;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const draft = {
      certificateNumber: await makeCertificateNumber(),
      verificationCode: makeVerificationCode(),
      event: event._id,
      user: userId,
      registration: registration._id,
      attendance: attendance._id,
      recipientName: registration.user?.name ?? 'Participant',
      eventTitle: event.title,
      eventDate: event.startDate ?? null,
      issuerName: event.organiser?.name ?? '',
      institution: 'Sreyas Institute of Engineering and Technology',
      certificateType: CERT_TYPE,
      status: 'ISSUED',
      issueDate: new Date(),
    };

    // Render before persisting — a PDF failure must NOT leave a fake ISSUED row.
    await buildCertificatePdf(draft, { verifyBaseUrl: env.clientUrl });

    try {
      // eslint-disable-next-line no-await-in-loop
      return await Certificate.create(draft);
    } catch (err) {
      if (
        err &&
        err.code === 11000 &&
        /certificateNumber|verificationCode/.test(err.message || '')
      ) {
        continue; // extremely rare number/code collision — retry with fresh values
      }
      throw err; // a {user,event,type} duplicate bubbles up as E11000 → "already issued"
    }
  }
  throw new Error('Could not allocate a unique certificate number after several attempts.');
};

/** POST /api/events/:id/certificates/generate — bulk, idempotent, per-participant safe. */
export const generateForEvent = async ({ organiserId, eventId }) => {
  const event = await loadOwnedEvent(eventId, organiserId);
  if (event.status !== COMPLETED) {
    throw ApiError.conflict('Certificates can only be generated once the event is completed.');
  }
  await event.populate('organiser', 'name');

  const { registrations, attByReg, certByUser } = await gather(eventId);

  let eligible = 0;
  let generated = 0;
  let alreadyIssued = 0;
  let failed = 0;
  let notEligible = 0;
  const failures = [];

  for (const reg of registrations) {
    const userId = String(reg.user?._id ?? reg.user);
    const att = attByReg.get(String(reg._id)) || null;
    const e = evaluate(reg, att, event);

    if (!e.eligible) {
      notEligible += 1;
      continue;
    }
    eligible += 1;

    if (certByUser.has(userId)) {
      alreadyIssued += 1;
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      const cert = await issueCertificate({ event, registration: reg, attendance: att });
      generated += 1;
      certByUser.set(userId, cert);
      notifyCertificateIssued({ userId, eventId: event._id, eventTitle: event.title }).catch(() => {});
    } catch (err) {
      if (err && err.code === 11000) {
        alreadyIssued += 1;
        continue;
      }
      failed += 1;
      failures.push({ name: reg.user?.name ?? 'Unknown participant', reason: 'Certificate could not be generated.' });
      logger.warn(`certificate generation failed (user ${userId}, event ${eventId}): ${err.message}`);
    }
  }

  return {
    event: { id: String(event._id), title: event.title, status: event.status },
    summary: { eligible, generated, alreadyIssued, failed, notEligible },
    failures,
  };
};

/** GET /api/users/me/certificates — the authenticated participant's own certificates. */
export const listMyCertificates = async ({ userId }) => {
  const docs = await Certificate.find({ user: userId })
    .populate('event', 'title status startDate')
    .sort({ issueDate: -1 })
    .lean();

  return {
    certificates: docs.map((c) => ({
      id: String(c._id),
      certificateNumber: c.certificateNumber,
      verificationCode: formatVerificationCode(c.verificationCode),
      eventTitle: c.eventTitle,
      eventDate: c.eventDate,
      issueDate: c.issueDate,
      status: c.status,
      certificateType: c.certificateType,
      institution: c.institution,
      issuerName: c.issuerName,
      event: c.event ? { id: String(c.event._id), title: c.event.title, status: c.event.status } : null,
    })),
  };
};

/** GET /api/certificates/:certificateId/download — owner USER or the event's ORGANISER. */
export const getCertificateForDownload = async ({ actorId, actorRole, certificateId }) => {
  if (!mongoose.isValidObjectId(certificateId)) throw ApiError.badRequest('Invalid certificate id.');

  const cert = await Certificate.findById(certificateId).populate('event', 'organiser title').lean();
  if (!cert) throw ApiError.notFound('Certificate not found.');

  const ownsCert = String(cert.user) === String(actorId);
  const ownsEvent =
    actorRole === ROLES.ORGANISER && cert.event && String(cert.event.organiser) === String(actorId);
  if (!ownsCert && !ownsEvent) {
    throw ApiError.forbidden('You do not have access to this certificate.');
  }

  let pdf;
  try {
    pdf = await buildCertificatePdf(cert, { verifyBaseUrl: env.clientUrl });
  } catch (err) {
    logger.error(`certificate PDF render failed (${certificateId}): ${err.message}`);
    throw new ApiError(500, 'The certificate PDF could not be generated. Please try again.');
  }

  return { pdf, filename: `${safeFilename(cert.eventTitle)}_Certificate.pdf` };
};

/** GET /api/certificates/verify/:verificationCode — PUBLIC, limited public info only. */
export const verifyByCode = async (rawCode) => {
  const code = normaliseCode(rawCode);
  if (code.length < 8 || code.length > 32) return { valid: false };

  const cert = await Certificate.findOne({ verificationCode: code }).lean();
  if (!cert) return { valid: false };

  return {
    valid: cert.status === 'ISSUED',
    certificate: {
      certificateNumber: cert.certificateNumber,
      verificationCode: formatVerificationCode(cert.verificationCode),
      recipientName: cert.recipientName,
      eventTitle: cert.eventTitle,
      eventDate: cert.eventDate,
      issueDate: cert.issueDate,
      status: cert.status,
      certificateType: cert.certificateType,
      institution: cert.institution,
      issuerName: cert.issuerName,
    },
  };
};
