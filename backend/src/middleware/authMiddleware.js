import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { verifyAuthToken } from '../utils/token.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getUserById } from '../services/auth.service.js';

/**
 * Authentication guard.
 *
 *  1. Read the JWT from the HTTP-only auth cookie.
 *  2. Verify signature + expiry.
 *  3. Load the user from the database (the token is not trusted on its own).
 *  4. Reject inactive accounts.
 *  5. Attach a minimal, server-verified user object to req.user.
 *
 * Internal error details are never sent to the client.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[env.authCookieName];

  if (!token) {
    throw ApiError.unauthorized('Authentication required. Please log in.');
  }

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Your session has expired. Please log in again.');
    }
    throw ApiError.unauthorized('Invalid authentication token. Please log in again.');
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Authentication required. Please log in.');
  }
  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Your account is currently inactive.');
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return next();
});
