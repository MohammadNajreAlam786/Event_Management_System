import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import * as teamAccess from '../services/teamAccess.service.js';
import * as attendance from '../services/attendance.service.js';

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

/** QR attendance is a narrow capability granted only by an accepted attendance task. */
export const checkInAttendance = asyncHandler(async (req, res) => {
  try {
    const data = await attendance.checkInByCredential({
      organiserId: req.user.id,
      eventId: req.params.eventId,
      credential: req.body?.credential,
      teamMember: true,
    });
    res.status(201).json({ success: true, data, message: 'Attendance marked.' });
  } catch (err) {
    if (err?.code === attendance.ALREADY_CHECKED_IN) {
      res.status(409).json({ success: false, message: err.message, data: err.payload });
      return;
    }
    throw err;
  }
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
