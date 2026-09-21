import { useParams } from 'react-router-dom';

import planningService from '../../../services/planningService.js';
import CrudSection from '../../../components/planning/CrudSection.jsx';
import PlanningBadge from '../../../components/planning/PlanningBadge.jsx';
import { ScheduleForm } from '../../../components/planning/forms.jsx';
import { formatDateTime } from '../../../utils/eventMeta.js';
import Icon from '../../../components/ui/Icon.jsx';

const timeOnly = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const PlanningSchedule = () => {
  const { id } = useParams();
  return (
    <CrudSection
      title="Schedule"
      description="The run of show, ordered by time. Overlapping items are flagged as conflicts."
      itemsKey="schedule"
      addLabel="Add item"
      emptyTitle="No schedule items yet"
      emptyDescription="Add sessions, breaks and ceremonies to build the event schedule."
      emptyIcon="clock"
      deleteTitle="Delete schedule item"
      deleteMessage={(s) => `Delete "${s.title}" from the schedule?`}
      minTableWidth={760}
      renderSummary={(data) =>
        data.conflictCount > 0 ? (
          <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <Icon name="alert-triangle" className="h-4 w-4 shrink-0" />
            Schedule conflict detected — {data.conflictCount} overlapping{' '}
            {data.conflictCount === 1 ? 'pair' : 'pairs'} of items.
          </p>
        ) : null
      }
      fetchItems={() => planningService.getSchedule(id)}
      createItem={(body) => planningService.createSchedule(id, body)}
      updateItem={(sid, body) => planningService.updateSchedule(id, sid, body)}
      deleteItem={(sid) => planningService.deleteSchedule(id, sid)}
      FormComponent={ScheduleForm}
      columns={[
        {
          key: 'time',
          header: 'Time',
          className: 'whitespace-nowrap text-slate-600',
          render: (s) => (
            <span title={`${formatDateTime(s.startTime)} — ${formatDateTime(s.endTime)}`}>
              {timeOnly(s.startTime)}–{timeOnly(s.endTime)}
            </span>
          ),
        },
        { key: 'title', header: 'Item', className: 'font-medium text-slate-800', render: (s) => s.title },
        { key: 'type', header: 'Type', render: (s) => <PlanningBadge value={s.type} /> },
        { key: 'location', header: 'Location', render: (s) => s.location || <span className="text-slate-400">—</span> },
        {
          key: 'conflict',
          header: 'Conflict',
          render: (s) =>
            s.conflictsWith?.length > 0 ? (
              <span className="text-xs font-medium text-amber-700">Overlaps {s.conflictsWith.length}</span>
            ) : (
              <span className="text-slate-400">—</span>
            ),
        },
      ]}
    />
  );
};

export default PlanningSchedule;
