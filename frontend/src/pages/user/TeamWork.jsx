import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';

import teamWorkService from '../../services/teamWorkService.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import SuccessBanner from '../../components/ui/SuccessBanner.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { formatDateTime } from '../../utils/eventMeta.js';
import { TASK_STATUS_LABEL, label } from '../../utils/planningMeta.js';

const invitationTone = { PENDING: 'amber', ACCEPTED: 'emerald', DECLINED: 'rose' };
const accessTone = { ACTIVE: 'emerald', RESTRICTED: 'amber' };
const requestTone = { REQUESTED: 'amber', APPROVED: 'emerald', REJECTED: 'rose' };

const TeamWork = () => {
  const navigate = useNavigate();
  const { refreshUnread } = useOutletContext();
  const [invitations, setInvitations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    let active = true;
    setState('loading');
    setError('');
    Promise.all([teamWorkService.getInvitations(), teamWorkService.getTasks()])
      .then(([invitationData, taskData]) => {
        if (!active) return;
        setInvitations(invitationData.invitations ?? []);
        setTasks(taskData.tasks ?? []);
        setState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) { navigate('/login', { replace: true }); return; }
        setError(err.message || 'Unable to load your team work.');
        setState('error');
      });
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => load(), [load]);

  const respond = async (invitation, accept) => {
    setBusy(invitation.id);
    setError('');
    try {
      await (accept ? teamWorkService.acceptInvitation(invitation.id) : teamWorkService.declineInvitation(invitation.id));
      setNotice(accept ? 'Invitation accepted. Your assigned task is now available below.' : 'Invitation declined.');
      refreshUnread?.();
      load();
    } catch (err) { setError(err.message || 'Unable to update this invitation.'); }
    finally { setBusy(''); }
  };

  const updateTask = async (task, status) => {
    setBusy(`${task.task.id}:${status}`);
    setError('');
    try {
      await teamWorkService.updateTaskStatus(task.task.id, status);
      setNotice(`Task marked ${TASK_STATUS_LABEL[status].toLowerCase()}.`);
      load();
    } catch (err) { setError(err.message || 'Unable to update this task.'); }
    finally { setBusy(''); }
  };

  const requestAccess = async (task) => {
    setBusy(`request:${task.event.id}`);
    setError('');
    try {
      await teamWorkService.requestAccess(task.event.id, '');
      setNotice('Access request submitted to the organiser. Access remains restricted until it is approved.');
      refreshUnread?.();
      load();
    } catch (err) { setError(err.message || 'Unable to submit the access request.'); }
    finally { setBusy(''); }
  };

  return (
    <section className="space-y-6">
      <PageHeader title="Team Work" description="Respond to task invitations and update only the tasks assigned to you." />
      {notice && <SuccessBanner message={notice} />}
      {error && <ErrorBanner message={error} onRetry={state === 'error' ? load : undefined} />}

      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
        Team access is limited to your assigned tasks. An accepted attendance task may allow attendance check-in for that event only; it never provides organiser access to planning, certificates, or event settings.
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Task invitations</h2>
        {state === 'loading' ? <div className="h-28 animate-pulse rounded-lg bg-slate-100" /> : invitations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">No task invitations yet.</p>
        ) : invitations.map((invitation) => (
          <article key={invitation.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{invitation.event?.title || 'Event'}</p>
                <p className="mt-1 text-sm text-slate-700">Assigned task: <span className="font-medium">{invitation.task?.title || 'Unavailable task'}</span></p>
                {invitation.assignedBy?.name && <p className="mt-1 text-xs text-slate-500">Assigned by {invitation.assignedBy.name}</p>}
              </div>
              <Badge tone={invitationTone[invitation.status] ?? 'slate'} dot>{label(invitation.status)}</Badge>
            </div>
            {invitation.task?.description && <p className="mt-3 text-sm text-slate-600">{invitation.task.description}</p>}
            {invitation.status === 'PENDING' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" disabled={busy === invitation.id} onClick={() => respond(invitation, true)}><Icon name="check-circle" className="h-4 w-4" />Accept</Button>
                <Button size="sm" variant="danger-outline" disabled={busy === invitation.id} onClick={() => respond(invitation, false)}>Decline</Button>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">My assigned tasks</h2>
        {state === 'loading' ? <div className="h-40 animate-pulse rounded-lg bg-slate-100" /> : tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">Accepted task assignments will appear here.</p>
        ) : tasks.map((item) => {
          const requestStatus = item.accessRequestStatus ?? 'NONE';
          return (
          <article key={item.invitationId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{item.task.title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.event.title}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="indigo" dot>{TASK_STATUS_LABEL[item.task.status] ?? label(item.task.status)}</Badge>
                <Badge tone={accessTone[item.accessStatus] ?? 'slate'} dot>{label(item.accessStatus)}</Badge>
                {requestStatus !== 'NONE' && <Badge tone={requestTone[requestStatus] ?? 'slate'} dot>Access request {label(requestStatus)}</Badge>}
              </div>
            </div>
            {item.task.description && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{item.task.description}</p>}
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
              {item.task.dueDate && <div><dt className="inline font-medium text-slate-600">Due: </dt><dd className="inline">{formatDateTime(item.task.dueDate)}</dd></div>}
              {item.task.priority && <div><dt className="inline font-medium text-slate-600">Priority: </dt><dd className="inline">{label(item.task.priority)}</dd></div>}
            </dl>
            {item.accessStatus === 'RESTRICTED' ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This event is completed, so your task access is restricted. Your task and invitation history are preserved.
                <div className="mt-2">
                  {requestStatus === 'REQUESTED' ? <span className="text-xs font-medium">Access request pending organiser review.</span> : (
                    <Button size="sm" disabled={busy === `request:${item.event.id}`} onClick={() => requestAccess(item)}>
                      {requestStatus === 'REJECTED' ? 'Request Access Again' : 'Request Access'}
                    </Button>
                  )}
                </div>
              </div>
            ) : item.canUpdate && (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.task.status !== 'IN_PROGRESS' && item.task.status !== 'COMPLETED' && <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => updateTask(item, 'IN_PROGRESS')}>Mark in progress</Button>}
                {item.task.status !== 'COMPLETED' && <Button size="sm" disabled={Boolean(busy)} onClick={() => updateTask(item, 'COMPLETED')}>Mark completed</Button>}
              </div>
            )}
            {item.canManageAttendance && (
              <div className="mt-4">
                <Link to={`/user/team-work/attendance/${item.event.id}`} className="inline-flex rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
                  Open QR attendance scanner
                </Link>
              </div>
            )}
          </article>
          );
        })}
      </div>
    </section>
  );
};

export default TeamWork;
