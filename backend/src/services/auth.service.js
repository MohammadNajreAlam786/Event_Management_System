import mongoose from 'mongoose';

import User, {
  ROLES,
  USER_STATUS,
  PUBLIC_REGISTRATION_ROLES,
} from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { normalizeEmail, isValidPassword, PASSWORD_POLICY_TEXT } from '../utils/validators.js';

/**
 * Authentication domain logic. Controllers stay thin: they handle HTTP,
 * this module handles rules and persistence.
 */

/**
 * Resolve the requested registration role.
 * - missing / empty  -> USER
 * - USER / ORGANISER -> as requested
 * - ADMIN            -> 403 (never self-serviceable)
 * - anything else    -> 400
 */
const resolveRegistrationRole = (rawRole) => {
  if (rawRole === undefined || rawRole === null || String(rawRole).trim() === '') {
    return ROLES.USER;
  }

  const role = String(rawRole).trim().toUpperCase();

  if (role === ROLES.ADMIN) {
    throw ApiError.forbidden('Admin accounts cannot be created through registration.');
  }
  if (!PUBLIC_REGISTRATION_ROLES.includes(role)) {
    throw ApiError.badRequest(`"${rawRole}" is not a valid account type.`);
  }
  return role;
};

/**
 * Create a new USER or ORGANISER account.
 * @returns {Promise<object>} safe user object (no password)
 */
export const registerUser = async ({ name, email, password, role }) => {
  const normalizedEmail = normalizeEmail(email);
  const resolvedRole = resolveRegistrationRole(role);

  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  try {
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: resolvedRole,
      status: USER_STATUS.ACTIVE,
    });
    return user.toSafeObject();
  } catch (error) {
    // Backstop for a race between the findOne check and the insert.
    if (error && error.code === 11000) {
      throw ApiError.conflict('An account with this email already exists.');
    }
    throw error;
  }
};

/**
 * Verify credentials and return the safe user object.
 * Uses one generic message for "no such user" and "wrong password" to avoid
 * account enumeration.
 */
export const authenticateUser = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden('Your account is currently inactive.');
  }

  return user.toSafeObject();
};

/**
 * Load a user by id (used by the auth middleware and /me).
 * Returns null when not found or when the id is malformed (e.g. a tampered
 * token subject).
 */
export const getUserById = async (id) => {
  if (!mongoose.isValidObjectId(id)) return null;
  const user = await User.findById(id);
  return user ? user.toSafeObject() : null;
};

/**
 * PATCH /api/auth/me — self-service profile edit (Phase 13).
 *
 * `userId` always comes from the authenticated session (`req.user.id`),
 * never from the request body, so a user can only ever edit their own
 * profile. Only fields the User model actually has are editable here —
 * email/role/status/id are intentionally not accepted (role and status
 * changes remain Admin-only, via the existing admin user-management flow).
 */
export const updateOwnProfile = async ({ userId, name }) => {
  if (typeof name !== 'string' || !name.trim()) {
    throw Object.assign(ApiError.badRequest('Please correct the highlighted fields.'), {
      errors: { name: 'Name is required.' },
    });
  }
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw Object.assign(ApiError.badRequest('Please correct the highlighted fields.'), {
      errors: { name: 'Name must be between 2 and 100 characters.' },
    });
  }

  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('Account not found.');

  user.name = trimmed;
  await user.save();
  return user.toSafeObject();
};

/**
 * PATCH /api/auth/me/password — self-service password change (Phase 13).
 *
 * Only ever operates on the authenticated caller's own account. Verifies the
 * current password with the existing bcrypt `comparePassword` method before
 * accepting a new one; the User model's own `pre('save')` hook re-hashes it
 * — no plaintext password is ever persisted or logged.
 */
export const changeOwnPassword = async ({ userId, currentPassword, newPassword, confirmNewPassword }) => {
  const errors = {};
  if (!currentPassword) errors.currentPassword = 'Current password is required.';
  if (!newPassword) {
    errors.newPassword = 'New password is required.';
  } else if (!isValidPassword(newPassword)) {
    errors.newPassword = `Password must be ${PASSWORD_POLICY_TEXT}.`;
  }
  if (confirmNewPassword !== newPassword) {
    errors.confirmNewPassword = 'Passwords do not match.';
  }
  if (Object.keys(errors).length) {
    throw Object.assign(ApiError.badRequest('Please correct the highlighted fields.'), { errors });
  }

  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('Account not found.');

  const currentMatches = await user.comparePassword(currentPassword);
  if (!currentMatches) {
    throw Object.assign(ApiError.badRequest('Please correct the highlighted fields.'), {
      errors: { currentPassword: 'Current password is incorrect.' },
    });
  }

  const sameAsCurrent = await user.comparePassword(newPassword);
  if (sameAsCurrent) {
    throw Object.assign(ApiError.badRequest('Please correct the highlighted fields.'), {
      errors: { newPassword: 'New password must be different from your current password.' },
    });
  }

  user.password = newPassword; // re-hashed by the model's pre('save') hook
  await user.save();
  // No session-revocation mechanism exists anywhere in this app (e.g.
  // deactivating an account doesn't force out an existing session either) —
  // the current cookie stays valid, matching that existing policy.
};
