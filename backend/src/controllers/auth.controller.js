import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { validateRegistration, validateLogin } from '../utils/validators.js';
import { signAuthToken, authCookieOptions, clearAuthCookieOptions } from '../utils/token.js';
import { env } from '../config/env.js';
import {
  registerUser,
  authenticateUser,
  getUserById,
  updateOwnProfile,
  changeOwnPassword,
} from '../services/auth.service.js';

/**
 * Shape the user object exposed to the client. Adds `status`/`createdAt`/
 * `updatedAt` (Phase 13 — the Profile page needs them; none are sensitive,
 * and this is purely additive to the existing `{id,name,email,role}` shape
 * every existing caller already relies on).
 */
const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/**
 * POST /api/auth/register
 * Public. Creates a USER or ORGANISER account. ADMIN is rejected.
 * Does not log the user in — the client is directed to /login afterwards.
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword, role } = req.body ?? {};

  const { valid, errors } = validateRegistration({ name, email, password, confirmPassword });
  if (!valid) {
    throw Object.assign(ApiError.badRequest('Please correct the highlighted fields.'), { errors });
  }

  const user = await registerUser({ name, email, password, role });

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please log in.',
    user: publicUser(user),
  });
});

/**
 * POST /api/auth/login
 * Public. On success, sets the HTTP-only auth cookie and returns the user.
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};

  const { valid, errors } = validateLogin({ email, password });
  if (!valid) {
    throw Object.assign(ApiError.badRequest('Please correct the highlighted fields.'), { errors });
  }

  const user = await authenticateUser({ email, password });
  const token = signAuthToken({ id: user.id, role: user.role });

  res
    .cookie(env.authCookieName, token, authCookieOptions())
    .status(200)
    .json({
      success: true,
      message: 'Login successful.',
      user: publicUser(user),
    });
});

/**
 * POST /api/auth/logout
 * Clears the auth cookie. Safe to call whether or not a session exists.
 */
export const logout = asyncHandler(async (req, res) => {
  res
    .clearCookie(env.authCookieName, clearAuthCookieOptions())
    .status(200)
    .json({ success: true, message: 'Logged out.' });
});

/**
 * GET /api/auth/me
 * Protected. Returns the currently authenticated user's safe fields.
 */
export const me = asyncHandler(async (req, res) => {
  // req.user is populated by the authenticate middleware.
  const user = await getUserById(req.user.id);
  if (!user) {
    throw ApiError.unauthorized('Authentication required.');
  }

  res.status(200).json({
    success: true,
    user: publicUser(user),
  });
});

/**
 * PATCH /api/auth/me
 * Protected. Self-service profile edit — the caller can only ever change
 * their own account (id comes from the JWT, never the body).
 */
export const updateMe = asyncHandler(async (req, res) => {
  const user = await updateOwnProfile({ userId: req.user.id, name: req.body?.name });
  res.status(200).json({ success: true, message: 'Profile updated.', user: publicUser(user) });
});

/**
 * PATCH /api/auth/me/password
 * Protected. Self-service password change.
 */
export const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body ?? {};
  await changeOwnPassword({ userId: req.user.id, currentPassword, newPassword, confirmNewPassword });
  res.status(200).json({ success: true, message: 'Password updated.' });
});
