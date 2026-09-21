import { useParams } from 'react-router-dom';

import planningService from '../../../services/planningService.js';
import CrudSection from '../../../components/planning/CrudSection.jsx';
import PlanningBadge from '../../../components/planning/PlanningBadge.jsx';
import { TaskForm } from '../../../components/planning/forms.jsx';
import { formatDateTime } from '../../../utils/eventMeta.js';
import { TASK_STATUSES, TASK_STATUS_LABEL, TASK_PRIORITIES, label } from '../../../utils/planningMeta.js';

const InlineStatus = ({ eventId, task, onChanged }) => (
  <select
    aria-label={`Status for ${task.title}`}
    value={task.status}
    onChange={async (e) => {
      await planningService.updateTask(eventId, task.id, { status: e.target.value });
      onChanged();
    }}
    className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
  >
    {TASK_STATUSES.map((s) => (
      <option key={s} value={s}>
        {TASK_STATUS_LABEL[s]}
      </option>
    ))}
  </select>
);

const PlanningTasks = () => {
  const { id } = useParams();
  return (
    <CrudSection
      title="Tasks"
      description="What needs doing before the event. Set priorities and deadlines, then work them down."
      itemsKey="tasks"
      searchable
      searchPlaceholder="Search task titles…"
      addLabel="Add task"
      emptyTitle="No planning tasks yet"
      emptyDescription="No planning tasks have been added. Create your first task to start preparing the event."
      emptyIcon="clipboard-check"
      deleteTitle="Delete task"
      deleteMessage={(t) => `Delete the task "${t.title}"?`}
      minTableWidth={820}
      filterControls={[
        { key: 'status', label: 'statuses', options: TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] })) },
        { key: 'priority', label: 'priorities', options: TASK_PRIORITIES.map((p) => ({ value: p, label: label(p) })) },
      ]}
      fetchItems={(params) => planningService.getTasks(id, params)}
      createItem={(body) => planningService.createTask(id, body)}
      updateItem={(taskId, body) => planningService.updateTask(id, taskId, body)}
      deleteItem={(taskId) => planningService.deleteTask(id, taskId)}
      FormComponent={TaskForm}
      renderRowActions={(task, refresh) => <InlineStatus eventId={id} task={task} onChanged={refresh} />}
      columns={[
        { key: 'title', header: 'Title', className: 'font-medium text-slate-800', render: (t) => t.title },
        { key: 'priority', header: 'Priority', render: (t) => <PlanningBadge value={t.priority} /> },
        { key: 'status', header: 'Status', render: (t) => <PlanningBadge value={t.status} /> },
        {
          key: 'due',
          header: 'Due',
          render: (t) =>
            t.dueDate ? (
              <span className={t.overdue ? 'font-medium text-rose-600' : 'text-slate-500'}>
                {formatDateTime(t.dueDate)}
                {t.overdue ? ' · overdue' : ''}
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            ),
        },
        { key: 'assignedTo', header: 'Assigned', render: (t) => t.assignedTo || <span className="text-slate-400">—</span> },
      ]}
    />
  );
};

export default PlanningTasks;
