import { useCallback, useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';

import planningService from '../../../services/planningService.js';
import CrudSection from '../../../components/planning/CrudSection.jsx';
import PlanningBadge from '../../../components/planning/PlanningBadge.jsx';
import { TeamMemberForm } from '../../../components/planning/forms.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import ErrorBanner from '../../../components/ui/ErrorBanner.jsx';
import SuccessBanner from '../../../components/ui/SuccessBanner.jsx';
import { formatDateTime } from '../../../utils/eventMeta.js';
import { TEAM_STATUSES, TASK_STATUS_LABEL, label } from '../../../utils/planningMeta.js';

const WORKFLOW_TONES = {
  PENDING: 'amber', ACCEPTED: 'emerald', DECLINED: 'rose', NOT_ASSIGNED: 'slate',
  ACTIVE: 'emerald', RESTRICTED: 'amber', NOT_ACTIVE: 'slate',
  REQUESTED: 'amber', APPROVED: 'emerald', REJECTED: 'rose', NONE: 'slate',
};

const WorkflowBadge = ({ value, emptyLabel = 'None' }) => (
  <Badge tone={WORKFLOW_TONES[value] ?? 'slate'} dot>{value === 'NONE' ? emptyLabel : label(value)}</Badge>
);

const PlanningTeam = () => {
  const { id } = useParams();
  const { event } = useOutletContext();
  const [requests, setRequests] = useState([]);
  const [requestState, setRequestState] = useState('loading');
  const [requestError, setRequestError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const loadRequests = useCallback(() => {
    let active = true;
    setRequestState('loading');
    setRequestError('');
    planningService.getAccessRequests(id)
      .then((data) => {
        if (!active) return;
        setRequests(data.requests ?? []);
        setRequestState('ready');
      })
      .catch((err) => {
        if (!active) return;
        setRequestError(err.message || 'Unable to load access requests.');
        setRequestState('error');
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => loadRequests(), [loadRequests]);

  const decideRequest = async (request, decision) => {
    setBusy(request.id);
    setRequestError('');
    try {
      await planningService.decideAccessRequest(id, request.id, decision);
      setNotice(`Access request ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`);
      loadRequests();
    } catch (err) {
      setRequestError(err.message || 'Unable to update this access request.');
    } finally {
      setBusy('');
    }
  };

  const pendingCount = requests.filter((request) => request.status === 'REQUESTED').length;

  return (
    <section className="space-y-6">
      <CrudSection
        title="Team"
        description="People helping run the event and what each is responsible for. These are contacts, not user accounts."
        itemsKey="team"
        addLabel="Add team member"
        emptyTitle="No team members yet"
        emptyDescription="No team members have been added. Add coordinators and volunteers with their responsibilities."
        emptyIcon="users"
        deleteTitle="Remove team member"
        deleteMessage={(member) => `Remove ${member.name} from the team?`}
        minTableWidth={1080}
        filterControls={[
          { key: 'status', label: 'statuses', options: TEAM_STATUSES.map((status) => ({ value: status, label: label(status) })) },
        ]}
        fetchItems={(params) => planningService.getTeam(id, params)}
        createItem={(body) => planningService.createTeamMember(id, body)}
        updateItem={(memberId, body) => planningService.updateTeamMember(id, memberId, body)}
        deleteItem={(memberId) => planningService.deleteTeamMember(id, memberId)}
        FormComponent={TeamMemberForm}
        readOnly={event?.status === 'COMPLETED'}
        columns={[
          { key: 'name', header: 'Name', className: 'font-medium text-slate-800', render: (member) => member.name },
          { key: 'email', header: 'Email', render: (member) => member.email || <span className="text-slate-400">—</span> },
          { key: 'role', header: 'Role', render: (member) => member.role || <span className="text-slate-400">—</span> },
          { key: 'status', header: 'Member status', render: (member) => <PlanningBadge value={member.status} /> },
          { key: 'invitation', header: 'Invitation', render: (member) => <WorkflowBadge value={member.invitationStatus} emptyLabel="Not assigned" /> },
          { key: 'access', header: 'Task access', render: (member) => <WorkflowBadge value={member.accessStatus} emptyLabel="Not active" /> },
          { key: 'request', header: 'Access request', render: (member) => <WorkflowBadge value={member.accessRequestStatus} /> },
          {
            key: 'tasks', header: 'Assigned tasks', render: (member) => member.assignedTasks?.length ? (
              <div className="space-y-1">
                {member.assignedTasks.map((task) => (
                  <div key={task.id} className="text-xs text-slate-600">
                    <span className="font-medium">{task.title}</span> · {TASK_STATUS_LABEL[task.status] ?? label(task.status)}
                  </div>
                ))}
              </div>
            ) : <span className="text-slate-400">—</span>,
          },
        ]}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Post-event access requests</h2>
            <p className="mt-1 text-sm text-slate-500">Approval restores only limited assigned-task access; it never grants organiser permissions.</p>
          </div>
          {pendingCount > 0 && <Badge tone="amber" dot>{pendingCount} pending</Badge>}
        </div>
        {notice && <div className="mt-4"><SuccessBanner message={notice} /></div>}
        {requestError && <div className="mt-4"><ErrorBanner message={requestError} onRetry={requestState === 'error' ? loadRequests : undefined} /></div>}
        {requestState === 'loading' ? <div className="mt-4 h-20 animate-pulse rounded-md bg-slate-100" /> : requests.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No post-event access requests for this event.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="pb-2 font-medium">Member</th><th className="pb-2 font-medium">Request</th><th className="pb-2 font-medium">Requested</th><th className="pb-2 font-medium">Status</th><th className="pb-2 text-right font-medium">Actions</th></tr>
              </thead>
              <tbody>{requests.map((request) => (
                <tr key={request.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3"><div className="font-medium text-slate-800">{request.teamMember?.name || request.requester?.name || 'Team member'}</div><div className="text-xs text-slate-500">{request.requester?.email || request.teamMember?.email}</div></td>
                  <td className="max-w-xs py-3 text-slate-600">{request.reason || <span className="text-slate-400">No reason provided</span>}</td>
                  <td className="py-3 text-slate-500">{request.requestedAt ? formatDateTime(request.requestedAt) : '—'}</td>
                  <td className="py-3"><WorkflowBadge value={request.status} /></td>
                  <td className="py-3 text-right">
                    {request.status === 'REQUESTED' && <span className="inline-flex gap-2"><Button size="sm" disabled={busy === request.id} onClick={() => decideRequest(request, 'APPROVE')}>Approve</Button><Button size="sm" variant="danger-outline" disabled={busy === request.id} onClick={() => decideRequest(request, 'REJECT')}>Reject</Button></span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
};

export default PlanningTeam;
