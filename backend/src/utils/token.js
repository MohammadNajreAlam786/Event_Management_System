import jwt from 'jsonwebtoken';

import { env, isProduction } from '../config/env.js';

/**
 * JWT helpers and auth-cookie configuration.
 *
 * Strategy: the signed JWT is delivered to the browser in a single HTTP-only
 * cookie (name from AUTH_COOKIE_NAME). The token payload carries only the
 * user id (`sub`) and `role` — nothing sensitive.
 */

const DURATION_UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Convert a short duration string ("30m", "1d", "12h", "3600s") or a plain
 * number of seconds into milliseconds. Falls back to 1 day.
 */
export const durationToMs = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value * 1000;
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+)\s*([smhd])$/i);
    if (match) return Number(match[1]) * DURATION_UNIT_MS[match[2].toLowerCase()];
    if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000;
  }
  return DURATION_UNIT_MS.d;
};

/**
 * Sign a JWT for the given user.
 * @param {{ id: string, role: string }} user
 */
export const signAuthToken = ({ id, role }) =>
  jwt.sign({ sub: String(id), role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

/**
 * Verify a JWT. Throws jwt.TokenExpiredError / jwt.JsonWebTokenError on failure.
 */
export const verifyAuthToken = (token) => jwt.verify(token, env.jwt.secret);

/**
 * Cookie options for setting the auth cookie.
 * `secure` is enabled only in production (dev runs over plain HTTP).
 */
export const authCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
  maxAge: durationToMs(env.jwt.expiresIn),
});

/**
 * Cookie options for clearing the auth cookie — must match the attributes
 * used when setting it (minus maxAge) for the browser to remove it.
 */
export const clearAuthCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
});
