import { useParams } from 'react-router-dom';

import planningService from '../../../services/planningService.js';
import CrudSection from '../../../components/planning/CrudSection.jsx';
import PlanningBadge from '../../../components/planning/PlanningBadge.jsx';
import { ResourceForm } from '../../../components/planning/forms.jsx';
import { RESOURCE_STATUSES, RESOURCE_CATEGORIES, label, money } from '../../../utils/planningMeta.js';

const PlanningResources = () => {
  const { id } = useParams();
  return (
    <CrudSection
      title="Resources"
      description="Equipment, furniture, materials — what's needed and whether it's secured."
      itemsKey="resources"
      searchable
      searchPlaceholder="Search resource names…"
      addLabel="Add resource"
      emptyTitle="No resources yet"
      emptyDescription="No resources have been added. List what the event needs and track its availability."
      emptyIcon="layers"
      deleteTitle="Delete resource"
      deleteMessage={(r) => `Delete the resource "${r.name}"?`}
      minTableWidth={820}
      filterControls={[
        { key: 'status', label: 'statuses', options: RESOURCE_STATUSES.map((s) => ({ value: s, label: label(s) })) },
        { key: 'category', label: 'categories', options: RESOURCE_CATEGORIES.map((c) => ({ value: c, label: label(c) })) },
      ]}
      fetchItems={(params) => planningService.getResources(id, params)}
      createItem={(body) => planningService.createResource(id, body)}
      updateItem={(rid, body) => planningService.updateResource(id, rid, body)}
      deleteItem={(rid) => planningService.deleteResource(id, rid)}
      FormComponent={ResourceForm}
      columns={[
        { key: 'name', header: 'Name', className: 'font-medium text-slate-800', render: (r) => r.name },
        { key: 'category', header: 'Category', render: (r) => label(r.category) },
        { key: 'qty', header: 'Qty', render: (r) => `${r.quantity}${r.unit ? ` ${r.unit}` : ''}` },
        { key: 'status', header: 'Status', render: (r) => <PlanningBadge value={r.status} /> },
        {
          key: 'cost',
          header: 'Est. cost',
          headClassName: 'text-right',
          className: 'text-right tabular-nums text-slate-600',
          render: (r) => (r.estimatedUnitCost ? money(r.estimatedTotalCost) : <span className="text-slate-400">—</span>),
        },
        { key: 'notes', header: 'Notes', render: (r) => r.notes || <span className="text-slate-400">—</span> },
      ]}
    />
  );
};

export default PlanningResources;
