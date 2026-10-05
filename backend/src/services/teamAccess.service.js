import mongoose from 'mongoose';

import Event, { EVENT_STATUSES } from '../models/event.model.js';
import EventTask from '../models/eventTask.model.js';
import EventTeamMember from '../models/eventTeamMember.model.js';
import EventTaskInvitation from '../models/eventTaskInvitation.model.js';
import EventAccessRequest from '../models/eventAccessRequest.model.js';
import User, { ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  notifyAccessRequest,
  notifyAccessRequestDecision,
  notifyInvitationResponse,
  notifyTaskInvitation,
} from './notification.service.js';

const validId = (id) => mongoose.isValidObjectId(id);
const assertId = (id, label) => {
  if (!validId(id)) throw ApiError.badRequest(`Invalid ${label}.`);
};

const publicInvitation = (doc) => ({
  id: String(doc._id),
  status: doc.status,
  respondedAt: doc.respondedAt,
  createdAt: doc.createdAt,
  event: doc.event && doc.event._id ? { id: String(doc.event._id), title: doc.event.title, status: doc.event.status } : null,
  task: doc.task && doc.task._id ? {
    id: String(doc.task._id), title: doc.task.title, description: doc.task.description,
    dueDate: doc.task.dueDate, status: doc.task.status,
  } : null,
  assignedBy: doc.assignedBy && doc.assignedBy._id ? { id: String(doc.assignedBy._id), name: doc.assignedBy.name } : null,
});

/** Resolve a contact to an active participant account without trusting client user IDs. */
export const resolveTeamAssignment = async ({ eventId, teamMemberId }) => {
  assertId(teamMemberId, 'team member id');
  const member = await EventTeamMember.findOne({ _id: teamMemberId, event: eventId });
  if (!member) throw ApiError.notFound('Team member not found for this event.');
  if (!member.email) {
    throw ApiError.badRequest('A team member needs an email linked to an active participant account before a task can be assigned.');
  }
  const recipient = await User.findOne({ email: member.email, role: ROLES.USER, status: 'ACTIVE' });
  if (!recipient) {
    throw ApiError.badRequest('This team member must have an active participant account using the listed email before a task can be assigned.');
  }
  return { member, recipient };
};

/** Create the one pending invitation associated with an assigned task. */
export const createTaskInvitation = async ({ event, task, member, recipient, organiserId }) => {
  const existing = await EventTaskInvitation.findOne({ task: task._id }).lean();
  if (existing) throw ApiError.conflict('This task already has a team invitation.');
  const invitation = await EventTaskInvitation.create({
    event: event._id,
    task: task._id,
    teamMember: member._id,
    recipient: recipient._id,
    assignedBy: organiserId,
  });
  notifyTaskInvitation({ userId: recipient._id, eventId: event._id, eventTitle: event.title, taskTitle: task.title }).catch(() => {});
  return invitation;
};

const ATTENDANCE_TASK_PATTERN = /\b(?:qr\s*attendance|scan\s*qr|qr\s*scan|attendance\s*(?:management|scanner|scan)|manage\s*attendance)\b/i;

/** Grant scanner access only to a member with an accepted, attendance-specific task. */
export const assertTeamAttendanceAccess = async ({ event, userId }) => {
  const access = await getTeamAccess({ event, userId });
  if (access.status !== 'ACTIVE') {
    throw ApiError.forbidden('Your team access is not active for this event.');
  }
  const invitations = await EventTaskInvitation.find({
    event: event._id,
    recipient: userId,
    status: 'ACCEPTED',
  }).populate('task', 'title description').lean();
  const hasAttendanceTask = invitations.some((invitation) =>
    ATTENDANCE_TASK_PATTERN.test(`${invitation.task?.title || ''} ${invitation.task?.description || ''}`),
  );
  if (!hasAttendanceTask) {
    throw ApiError.forbidden('You do not have an accepted QR attendance task for this event.');
  }
};

const findAcceptedInvitations = (eventId, userId) =>
  EventTaskInvitation.find({ event: eventId, recipient: userId, status: 'ACCEPTED' }).lean();

/** The only authorization source for a participant's limited team access. */
export const getTeamAccess = async ({ event, userId }) => {
  const accepted = await findAcceptedInvitations(event._id, userId);
  if (!accepted.length) return { status: 'NOT_ACTIVE', acceptedInvitationIds: [] };

  if (event.status !== EVENT_STATUSES.COMPLETED) {
    return { status: 'ACTIVE', acceptedInvitationIds: accepted.map((i) => String(i._id)) };
  }

  const approved = await EventAccessRequest.findOne({
    event: event._id,
    requester: userId,
    status: 'APPROVED',
  })
    .sort({ resolvedAt: -1, createdAt: -1 })
    .lean();
  return {
    status: approved ? 'ACTIVE' : 'RESTRICTED',
    acceptedInvitationIds: accepted.map((i) => String(i._id)),
    approvedRequestId: approved ? String(approved._id) : null,
  };
};

export const listMyInvitations = async (userId) => {
  const invitations = await EventTaskInvitation.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .populate('event', 'title status')
    .populate('task', 'title description dueDate status')
    .populate('assignedBy', 'name')
    .lean();
  return { invitations: invitations.map(publicInvitation) };
};

export const respondToInvitation = async ({ invitationId, userId, accept }) => {
  assertId(invitationId, 'invitation id');
  const invitation = await EventTaskInvitation.findOne({ _id: invitationId, recipient: userId })
    .populate('event', 'title status organiser')
    .populate('teamMember', 'name');
  if (!invitation) throw ApiError.notFound('Task invitation not found.');
  if (invitation.status !== 'PENDING') throw ApiError.badRequest('This invitation has already been answered.');

  invitation.status = accept ? 'ACCEPTED' : 'DECLINED';
  invitation.respondedAt = new Date();
  await invitation.save();
  if (accept) await EventTeamMember.updateOne({ _id: invitation.teamMember._id }, { $set: { status: 'ACTIVE' } });

  notifyInvitationResponse({
    organiserId: invitation.event.organiser,
    eventId: invitation.event._id,
    eventTitle: invitation.event.title,
    memberName: invitation.teamMember?.name ?? 'A team member',
    accepted: accept,
  }).catch(() => {});
  return { invitation: publicInvitation(invitation), accessStatus: (await getTeamAccess({ event: invitation.event, userId })).status };
};

export const listMyAssignedTasks = async (userId) => {
  const invitations = await EventTaskInvitation.find({ recipient: userId, status: 'ACCEPTED' })
    .populate('event', 'title status')
    .populate('task', 'title description dueDate priority status')
    .lean();
  const eventIds = [...new Set(invitations.filter((i) => i.event && i.task).map((i) => String(i.event._id)))];
  const requests = eventIds.length
    ? await EventAccessRequest.find({ requester: userId, event: { $in: eventIds } }).sort({ createdAt: -1 }).lean()
    : [];
  const latestRequestByEvent = new Map();
  for (const request of requests) {
    const key = String(request.event);
    if (!latestRequestByEvent.has(key)) latestRequestByEvent.set(key, request);
  }
  const items = await Promise.all(invitations.filter((i) => i.event && i.task).map(async (i) => {
    const access = await getTeamAccess({ event: i.event, userId });
    const latestRequest = latestRequestByEvent.get(String(i.event._id));
    return {
      invitationId: String(i._id),
      event: { id: String(i.event._id), title: i.event.title, status: i.event.status },
      task: { id: String(i.task._id), title: i.task.title, description: i.task.description, dueDate: i.task.dueDate, priority: i.task.priority, status: i.task.status },
      accessStatus: access.status,
      // Match the effective authorization state: an approved request remains
      // meaningful even if older request history also exists.
      accessRequestStatus: access.approvedRequestId ? 'APPROVED' : (latestRequest?.status ?? 'NONE'),
      canUpdate: access.status === 'ACTIVE',
      canManageAttendance: access.status === 'ACTIVE' && ATTENDANCE_TASK_PATTERN.test(`${i.task.title || ''} ${i.task.description || ''}`),
    };
  }));
  return { tasks: items };
};

export const updateMyAssignedTaskStatus = async ({ taskId, userId, status }) => {
  assertId(taskId, 'task id');
  const next = String(status || '').toUpperCase();
  if (!['IN_PROGRESS', 'COMPLETED'].includes(next)) {
    throw ApiError.badRequest('Team members may update an assigned task only to IN_PROGRESS or COMPLETED.');
  }
  const invitation = await EventTaskInvitation.findOne({ task: taskId, recipient: userId, status: 'ACCEPTED' })
    .populate('event', 'status')
    .populate('task');
  if (!invitation || !invitation.task) throw ApiError.notFound('Assigned task not found.');
  const access = await getTeamAccess({ event: invitation.event, userId });
  if (access.status !== 'ACTIVE') throw ApiError.forbidden('Your planning access is not active for this event.');
  if (invitation.task.status === 'COMPLETED' && next !== 'COMPLETED') {
    throw ApiError.badRequest('A completed task cannot be moved backwards by a team member.');
  }
  if (invitation.task.status === 'ASSIGNED' && next === 'COMPLETED') {
    // Completing directly is allowed for a small task, but the workflow remains monotonic.
  }
  invitation.task.status = next;
  await invitation.task.save();
  return invitation.task.toJSON();
};

export const requestPostEventAccess = async ({ eventId, userId, reason }) => {
  assertId(eventId, 'event id');
  const event = await Event.findOne({ _id: eventId, isDeleted: { $ne: true } });
  if (!event) throw ApiError.notFound('Event not found.');
  if (event.status !== EVENT_STATUSES.COMPLETED) throw ApiError.badRequest('Access can be requested only after an event is completed.');
  const invitation = await EventTaskInvitation.findOne({ event: eventId, recipient: userId, status: 'ACCEPTED' });
  if (!invitation) throw ApiError.forbidden('You do not have accepted team access for this event.');
  const exists = await EventAccessRequest.findOne({ event: eventId, requester: userId, status: 'REQUESTED' });
  if (exists) throw ApiError.badRequest('You already have a pending access request for this event.');
  const request = await EventAccessRequest.create({
    event: eventId, teamMember: invitation.teamMember, requester: userId, reason: String(reason || '').trim(),
  });
  const member = await EventTeamMember.findById(invitation.teamMember).select('name').lean();
  notifyAccessRequest({ organiserId: event.organiser, eventId: event._id, eventTitle: event.title, memberName: member?.name ?? 'A team member' }).catch(() => {});
  return request.toJSON();
};

export const listAccessRequestsForOrganiser = async (eventId) => {
  const requests = await EventAccessRequest.find({ event: eventId })
    .sort({ createdAt: -1 })
    .populate('teamMember', 'name email role')
    .populate('requester', 'name email')
    .populate('resolvedBy', 'name')
    .lean();
  return {
    requests: requests.map((r) => ({
      id: String(r._id), status: r.status, reason: r.reason, requestedAt: r.requestedAt,
      resolvedAt: r.resolvedAt,
      teamMember: r.teamMember ? { id: String(r.teamMember._id), name: r.teamMember.name, email: r.teamMember.email, role: r.teamMember.role } : null,
      requester: r.requester ? { id: String(r.requester._id), name: r.requester.name, email: r.requester.email } : null,
      resolvedBy: r.resolvedBy ? { id: String(r.resolvedBy._id), name: r.resolvedBy.name } : null,
    })),
  };
};

export const decideAccessRequest = async ({ event, requestId, organiserId, approved }) => {
  assertId(requestId, 'access request id');
  if (event.status !== EVENT_STATUSES.COMPLETED) throw ApiError.badRequest('Access requests may be decided only after event completion.');
  const request = await EventAccessRequest.findOne({ _id: requestId, event: event._id, status: 'REQUESTED' });
  if (!request) throw ApiError.notFound('Pending access request not found.');
  request.status = approved ? 'APPROVED' : 'REJECTED';
  request.resolvedAt = new Date();
  request.resolvedBy = organiserId;
  await request.save();
  notifyAccessRequestDecision({ userId: request.requester, eventId: event._id, eventTitle: event.title, approved }).catch(() => {});
  return request.toJSON();
};

/** Compact derived data used by the organiser's Team table. */
export const getTeamWorkflowSummaries = async ({ event, members }) => {
  const memberIds = members.map((m) => m._id);
  const [invitations, requests] = await Promise.all([
    EventTaskInvitation.find({ event: event._id, teamMember: { $in: memberIds } }).populate('task', 'title status').lean(),
    EventAccessRequest.find({ event: event._id, teamMember: { $in: memberIds } }).sort({ createdAt: -1 }).lean(),
  ]);
  return new Map(members.map((member) => {
    const mine = invitations.filter((i) => String(i.teamMember) === String(member._id));
    const accepted = mine.some((i) => i.status === 'ACCEPTED');
    const invitationStatus = mine.length === 0 ? 'NOT_ASSIGNED' : mine.some((i) => i.status === 'PENDING') ? 'PENDING' : accepted ? 'ACCEPTED' : 'DECLINED';
    const latestRequest = requests.find((r) => String(r.teamMember) === String(member._id));
    const hasApproved = latestRequest?.status === 'APPROVED';
    const accessStatus = accepted ? (event.status === EVENT_STATUSES.COMPLETED && !hasApproved ? 'RESTRICTED' : 'ACTIVE') : 'NOT_ACTIVE';
    return [String(member._id), {
      invitationStatus,
      accessStatus,
      accessRequestStatus: latestRequest?.status ?? 'NONE',
      assignedTasks: mine.filter((i) => i.task).map((i) => ({ id: String(i.task._id), title: i.task.title, status: i.task.status, invitationStatus: i.status })),
    }];
  }));
};
