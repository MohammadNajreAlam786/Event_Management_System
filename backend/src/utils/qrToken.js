import crypto from 'node:crypto';

import { env } from '../config/env.js';

/**
 * QR attendance credential — a signed, opaque token (Phase 7).
 *
 * Design (documented per the phase brief §47 "signed-token design"):
 *   token = base64url(payload) + "." + base64url(HMAC_SHA256(secret, base64url(payload)))
 *   payload = { v: 1, rid, eid, n }
 *     rid — registration id the credential belongs to
 *     eid — event id the credential is valid for
 *     n   — the registration's current `qrNonce` (rotated on cancel, re-issued
 *           on re-register) so a specific QR can be invalidated
 *
 * The server stores ONLY the per-registration `qrNonce`. The token itself is a
 * pure function of (rid, eid, nonce, secret), so the participant's QR page can
 * re-render the same code every time with no stored plaintext and no race.
 *
 * What the QR never contains: passwords, password hashes, JWTs, session tokens,
 * emails or any user document field (§7, §8, §48).
 */

const SIGNING_SECRET =
  env.qr.secret ||
  crypto.createHmac('sha256', env.jwt.secret || 'insecure-dev-secret').update('qr-attendance-credential-v1').digest('hex');

const b64urlEncode = (buf) => Buffer.from(buf).toString('base64url');
const b64urlDecode = (str) => Buffer.from(String(str), 'base64url');

const sign = (part) => crypto.createHmac('sha256', SIGNING_SECRET).update(part).digest();

/** A fresh, unpredictable per-registration nonce. */
export const issueQrNonce = () => crypto.randomBytes(18).toString('base64url');

/**
 * Build the signed attendance token for a registration.
 * @param {{ registrationId: string, eventId: string, nonce: string }} args
 */
export const signAttendanceToken = ({ registrationId, eventId, nonce }) => {
  const payload = b64urlEncode(
    JSON.stringify({ v: 1, rid: String(registrationId), eid: String(eventId), n: String(nonce) }),
  );
  const sig = b64urlEncode(sign(payload));
  return `${payload}.${sig}`;
};

/**
 * Verify a scanned credential. Returns `{ rid, eid, nonce }` on success.
 * Throws a plain Error (never leaks why) on any malformed / bad-signature input.
 */
export const verifyAttendanceToken = (token) => {
  if (typeof token !== 'string' || token.length < 8 || token.length > 4096) {
    throw new Error('Malformed credential.');
  }
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1 || token.indexOf('.', dot + 1) !== -1) {
    throw new Error('Malformed credential.');
  }
  const part = token.slice(0, dot);
  const provided = b64urlDecode(token.slice(dot + 1));
  const expected = sign(part);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new Error('Bad signature.');
  }

  let json;
  try {
    json = JSON.parse(b64urlDecode(part).toString('utf8'));
  } catch {
    throw new Error('Malformed payload.');
  }
  if (!json || json.v !== 1 || !json.rid || !json.eid || !json.n) {
    throw new Error('Malformed payload.');
  }
  return { rid: String(json.rid), eid: String(json.eid), nonce: String(json.n) };
};

/** The exact string a participant's QR image encodes. */
export const buildQrPayload = (credential) =>
  JSON.stringify({ typ: 'EVENT_ATTENDANCE', cred: credential });

/**
 * Accept what a scanner produced — either the wrapped `{typ,cred}` JSON or a
 * bare token — and return the bare credential string.
 */
export const extractCredential = (scanned) => {
  const raw = String(scanned ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('{')) {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.cred === 'string') return obj.cred.trim();
    } catch {
      return raw;
    }
  }
  return raw;
};
