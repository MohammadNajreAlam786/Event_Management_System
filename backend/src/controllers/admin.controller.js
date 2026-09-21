import { ROLES, USER_STATUS } from '../models/user.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { isValidEventStatus } from '../utils/eventValidators.js';
import * as adminService from '../services/admin.service.js';
import * as eventService from '../services/event.service.js';

/** Validate an optional `role` query filter. Returns the normalised value or undefined. */
const parseRoleFilter = (raw) => {
  if (!raw) return undefined;
  const role = String(raw).trim().toUpperCase();
  if (!Object.values(ROLES).includes(role)) {
    throw ApiError.badRequest(`"${raw}" is not a valid role filter.`);
  }
  return role;
};

/** Validate an optional account `status` query filter. Returns the normalised value or undefined. */
const parseStatusFilter = (raw) => {
  if (!raw) return undefined;
  const status = String(raw).trim().toUpperCase();
  if (!Object.values(USER_STATUS).includes(status)) {
    throw ApiError.badRequest(`"${raw}" is not a valid status filter.`);
  }
  return status;
};

/** Validate an optional event `status` query filter. Returns the normalised value or undefined. */
const parseEventStatusFilter = (raw) => {
  if (!raw) return undefined;
  if (!isValidEventStatus(raw)) {
    throw ApiError.badRequest(`"${raw}" is not a valid event status filter.`);
  }
  return String(raw).trim().toUpperCase();
};

/**
 * GET /api/admin/dashboard/stats
 * Real, database-derived platform statistics (no fake data).
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const data = await adminService.getDashboardStats();
  res.status(200).json({ success: true, data });
});

/**
 * GET /api/admin/users?search=&role=&status=&page=&limit=
 * Lists every account (any role). Search matches name/email.
 */
export const getUsers = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const role = parseRoleFilter(req.query.role);
  const status = parseStatusFilter(req.query.status);

  const data = await adminService.listAccounts({ search, role, status, page, limit });
  res.status(200).json({ success: true, data });
});

/**
 * PATCH /api/admin/users/:id/status
 * Body: { status: 'ACTIVE' | 'INACTIVE' }. Only `status` is ever read from
 * the request body — any other field (e.g. a smuggled `role`) is ignored.
 */
export const updateUserStatus = asyncHandler(async (req, res) => {
  const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : req.body?.status;

  const user = await adminService.updateAccountStatus({
    actingAdminId: req.user.id,
    targetUserId: req.params.id,
    status,
  });

  res.status(200).json({
    success: true,
    data: { user },
    message: `User account ${status === USER_STATUS.ACTIVE ? 'activated' : 'deactivated'} successfully.`,
  });
});

/**
 * GET /api/admin/organisers?search=&status=&page=&limit=
 * User Management, scoped to role: ORGANISER. Reuses the same service as
 * getUsers — no duplicated query logic.
 */
export const getOrganisers = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const status = parseStatusFilter(req.query.status);

  const data = await adminService.listAccounts({ search, role: ROLES.ORGANISER, status, page, limit });
  res.status(200).json({ success: true, data });
});

/**
 * PATCH /api/admin/organisers/:id/status
 * Same rules as updateUserStatus, additionally scoped to organiser accounts.
 */
export const updateOrganiserStatus = asyncHandler(async (req, res) => {
  const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : req.body?.status;

  const user = await adminService.updateAccountStatus({
    actingAdminId: req.user.id,
    targetUserId: req.params.id,
    status,
    expectedRole: ROLES.ORGANISER,
  });

  res.status(200).json({
    success: true,
    data: { user },
    message: `Organiser account ${status === USER_STATUS.ACTIVE ? 'activated' : 'deactivated'} successfully.`,
  });
});

/**
 * GET /api/admin/events?search=&status=&page=&limit=
 * All events across every organiser (soft-deleted excluded) for oversight.
 * Organiser is returned only as { id, name, email }.
 */
export const getEvents = asyncHandler(async (req, res) => {
  const status = req.query.status ? parseEventStatusFilter(req.query.status) : undefined;
  const data = await eventService.listAllEventsForAdmin({
    search: req.query.search,
    status,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.status(200).json({ success: true, data });
});

/**
 * PATCH /api/admin/events/:id/status
 * Administrative status change (e.g. cancelling an event). ADMIN only —
 * enforced by the admin router. The event is not deleted.
 */
export const updateEventStatus = asyncHandler(async (req, res) => {
  const event = await eventService.updateEventStatusByAdmin({
    eventId: req.params.id,
    status: req.body?.status,
  });
  res.status(200).json({
    success: true,
    data: { event },
    message: `Event status set to ${event.status}.`,
  });
});
