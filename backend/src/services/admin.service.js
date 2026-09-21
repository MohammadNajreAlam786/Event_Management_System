import mongoose from 'mongoose';

import User, { ROLES, USER_STATUS } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { getAdminEventCounts } from './event.service.js';

/**
 * Admin domain logic: dashboard statistics and user/organiser account
 * management. Controllers stay thin — this module owns the rules and
 * persistence. Event oversight lives in event.service.js; this module only
 * pulls the event roll-ups for the dashboard.
 */

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

/** Escape user input before building a MongoDB regex (safe search). */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Map a lean user document to the shape returned by the Admin APIs. */
const toPublicUser = (doc) => ({
  id: String(doc._id),
  name: doc.name,
  email: doc.email,
  role: doc.role,
  status: doc.status,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const clampPage = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
};
const clampLimit = (value) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
};

/**
 * High-level platform statistics for the dashboard, plus a small
 * "recent activity" feed derived from real account-creation data (no
 * synthetic audit log). Event figures are 0 — Event Management is a later
 * phase and no Event model exists yet.
 */
export const getDashboardStats = async () => {
  const [totalUsers, totalOrganisers, recentAccounts, eventCounts] = await Promise.all([
    User.countDocuments({ role: ROLES.USER }),
    User.countDocuments({ role: ROLES.ORGANISER }),
    User.find().sort({ createdAt: -1 }).limit(5).select('name role createdAt').lean(),
    getAdminEventCounts(),
  ]);

  const roleActivityLabel = { ADMIN: 'admin', ORGANISER: 'organiser', USER: 'user' };

  return {
    totalUsers,
    totalOrganisers,
    totalEvents: eventCounts.totalEvents,
    activeEvents: eventCounts.activeEvents,
    completedEvents: eventCounts.completedEvents,
    cancelledEvents: eventCounts.cancelledEvents,
    recentActivity: recentAccounts.map((u) => ({
      type: 'account_registered',
      message: `New ${roleActivityLabel[u.role] ?? u.role.toLowerCase()} registered: ${u.name}`,
      role: u.role,
      at: u.createdAt,
    })),
  };
};

/**
 * Paginated, searchable, filterable account listing.
 * Shared by both User Management (/admin/users) and Organiser Management
 * (/admin/organisers, which calls this with role: 'ORGANISER').
 *
 * Never selects the password field.
 */
export const listAccounts = async ({ search, role, status, page, limit } = {}) => {
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (search && search.trim()) {
    const pattern = new RegExp(escapeRegExp(search.trim()), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const pageNum = clampPage(page);
  const limitNum = clampLimit(limit);

  const [docs, totalUsers] = await Promise.all([
    User.find(filter)
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    users: docs.map(toPublicUser),
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalUsers,
      totalPages: Math.max(1, Math.ceil(totalUsers / limitNum)),
    },
  };
};

/**
 * Activate or deactivate an account.
 *
 * Security rules enforced here (independent of the frontend):
 *  - Only ever writes the `status` field — role is never read from the caller.
 *  - An admin may not deactivate their own account.
 *  - Optionally restricted to a specific expected role (used by the Organiser
 *    endpoint so it cannot be pointed at a USER/ADMIN id by URL manipulation).
 */
export const updateAccountStatus = async ({ actingAdminId, targetUserId, status, expectedRole }) => {
  if (!mongoose.isValidObjectId(targetUserId)) {
    throw ApiError.badRequest('Invalid user id.');
  }
  if (!Object.values(USER_STATUS).includes(status)) {
    throw ApiError.badRequest('Status must be either ACTIVE or INACTIVE.');
  }
  if (String(actingAdminId) === String(targetUserId) && status === USER_STATUS.INACTIVE) {
    throw ApiError.forbidden('You cannot deactivate your own admin account.');
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw ApiError.notFound('User not found.');
  }
  if (expectedRole && user.role !== expectedRole) {
    const article = expectedRole === ROLES.USER ? 'a' : 'an';
    throw ApiError.badRequest(`This account is not ${article} ${expectedRole.toLowerCase()}.`);
  }

  user.status = status; // the only field this function ever assigns
  await user.save();

  return user.toSafeObject();
};
