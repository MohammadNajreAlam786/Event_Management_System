import { asyncHandler } from '../utils/asyncHandler.js';
import * as registrationService from '../services/registration.service.js';

/* ---------------- Public discovery (no auth required) ---------------- */

/** GET /api/events/public/featured — small anonymous-safe preview for the Home page. */
export const listFeaturedEvents = asyncHandler(async (req, res) => {
  const data = await registrationService.listFeaturedEvents({ limit: req.query.limit });
  res.status(200).json({ success: true, data });
});

/* ---------------- Participant discovery (USER) ---------------- */

/** GET /api/events/public */
export const listPublicEvents = asyncHandler(async (req, res) => {
  const data = await registrationService.listPublicEvents({
    userId: req.user.id,
    search: req.query.search,
    category: req.query.category,
    upcoming: req.query.upcoming,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.status(200).json({ success: true, data });
});

/** GET /api/events/public/:id */
export const getPublicEvent = asyncHandler(async (req, res) => {
  const event = await registrationService.getPublicEvent({ userId: req.user.id, eventId: req.params.id });
  res.status(200).json({ success: true, data: { event } });
});

/* ---------------- Registration (USER) ---------------- */

/** POST /api/events/:id/register */
export const register = asyncHandler(async (req, res) => {
  const data = await registrationService.registerForEvent({ userId: req.user.id, eventId: req.params.id });
  res.status(201).json({ success: true, data, message: 'Registration successful.' });
});

/** POST /api/events/:id/register/team */
export const registerTeam = asyncHandler(async (req, res) => {
  const data = await registrationService.registerTeamForEvent({
    userId: req.user.id,
    eventId: req.params.id,
    teamName: req.body?.teamName,
    teamSize: req.body?.teamSize,
    memberEmails: req.body?.memberEmails,
  });
  res.status(201).json({ success: true, data, message: 'Team registration successful.' });
});

/** PATCH /api/registrations/teams/:teamId/cancel */
export const cancelTeamRegistration = asyncHandler(async (req, res) => {
  const data = await registrationService.cancelTeamRegistration({
    userId: req.user.id,
    teamId: req.params.teamId,
  });
  res.status(200).json({ success: true, data, message: 'Team registration cancelled.' });
});

/** GET /api/registrations/mine */
export const listMyRegistrations = asyncHandler(async (req, res) => {
  const data = await registrationService.listMyRegistrations({ userId: req.user.id, status: req.query.status });
  res.status(200).json({ success: true, data });
});

/** PATCH /api/registrations/:registrationId/cancel */
export const cancelRegistration = asyncHandler(async (req, res) => {
  const data = await registrationService.cancelRegistration({
    userId: req.user.id,
    registrationId: req.params.registrationId,
  });
  res.status(200).json({ success: true, data, message: 'Registration cancelled.' });
});

/* ---------------- Organiser participant view (ORGANISER, owner) ---------------- */

/** GET /api/events/:id/registrations */
export const listEventRegistrations = asyncHandler(async (req, res) => {
  const data = await registrationService.listEventRegistrationsForOrganiser({
    organiserId: req.user.id,
    eventId: req.params.id,
    type: req.query.type,
  });
  res.status(200).json({ success: true, data });
});
