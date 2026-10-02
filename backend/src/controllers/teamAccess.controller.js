import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import * as teamAccess from '../services/teamAccess.service.js';

export const listMyInvitations = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await teamAccess.listMyInvitations(req.user.id) });
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const data = await teamAccess.respondToInvitation({ invitationId: req.params.invitationId, userId: req.user.id, accept: true });
  res.json({ success: true, data, message: 'Task invitation accepted.' });
});

export const declineInvitation = asyncHandler(async (req, res) => {
  const data = await teamAccess.respondToInvitation({ invitationId: req.params.invitationId, userId: req.user.id, accept: false });
  res.json({ success: true, data, message: 'Task invitation declined.' });
});

export const listMyTasks = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await teamAccess.listMyAssignedTasks(req.user.id) });
});

export const updateMyTaskStatus = asyncHandler(async (req, res) => {
  const task = await teamAccess.updateMyAssignedTaskStatus({ taskId: req.params.taskId, userId: req.user.id, status: req.body?.status });
  res.json({ success: true, data: { task }, message: 'Task status updated.' });
});

export const requestAccess = asyncHandler(async (req, res) => {
  const request = await teamAccess.requestPostEventAccess({ eventId: req.params.eventId, userId: req.user.id, reason: req.body?.reason });
  res.status(201).json({ success: true, data: { request }, message: 'Access request submitted.' });
});

export const listAccessRequests = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await teamAccess.listAccessRequestsForOrganiser(String(req.event._id)) });
});

export const decideAccessRequest = asyncHandler(async (req, res) => {
  const approved = String(req.body?.decision || '').toUpperCase() === 'APPROVE';
  const rejected = String(req.body?.decision || '').toUpperCase() === 'REJECT';
  if (!approved && !rejected) {
    throw ApiError.badRequest('Decision must be APPROVE or REJECT.');
  }
  const request = await teamAccess.decideAccessRequest({ event: req.event, requestId: req.params.requestId, organiserId: req.user.id, approved });
  res.json({ success: true, data: { request }, message: approved ? 'Access request approved.' : 'Access request rejected.' });
});
