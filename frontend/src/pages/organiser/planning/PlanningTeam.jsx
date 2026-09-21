import { useParams } from 'react-router-dom';

import planningService from '../../../services/planningService.js';
import CrudSection from '../../../components/planning/CrudSection.jsx';
import PlanningBadge from '../../../components/planning/PlanningBadge.jsx';
import { TeamMemberForm } from '../../../components/planning/forms.jsx';
import { TEAM_STATUSES, label } from '../../../utils/planningMeta.js';

const PlanningTeam = () => {
  const { id } = useParams();
  return (
    <CrudSection
      title="Team"
      description="People helping run the event and what each is responsible for. These are contacts, not user accounts."
      itemsKey="team"
      addLabel="Add team member"
      emptyTitle="No team members yet"
      emptyDescription="No team members have been added. Add coordinators and volunteers with their responsibilities."
      emptyIcon="users"
      deleteTitle="Remove team member"
      deleteMessage={(m) => `Remove ${m.name} from the team?`}
      minTableWidth={720}
      filterControls={[
        { key: 'status', label: 'statuses', options: TEAM_STATUSES.map((s) => ({ value: s, label: label(s) })) },
      ]}
      fetchItems={(params) => planningService.getTeam(id, params)}
      createItem={(body) => planningService.createTeamMember(id, body)}
      updateItem={(mid, body) => planningService.updateTeamMember(id, mid, body)}
      deleteItem={(mid) => planningService.deleteTeamMember(id, mid)}
      FormComponent={TeamMemberForm}
      columns={[
        { key: 'name', header: 'Name', className: 'font-medium text-slate-800', render: (m) => m.name },
        { key: 'email', header: 'Email', render: (m) => m.email || <span className="text-slate-400">—</span> },
        { key: 'role', header: 'Role', render: (m) => m.role || <span className="text-slate-400">—</span> },
        { key: 'resp', header: 'Responsibility', render: (m) => m.responsibility || <span className="text-slate-400">—</span> },
        { key: 'status', header: 'Status', render: (m) => <PlanningBadge value={m.status} /> },
      ]}
    />
  );
};

export default PlanningTeam;
