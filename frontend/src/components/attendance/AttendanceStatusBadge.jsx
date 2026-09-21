import Badge from '../ui/Badge.jsx';

const LABELS = { PRESENT: 'Present', NONE: 'Not checked in' };

/** Pill for a participant's event-day attendance state. */
const AttendanceStatusBadge = ({ status }) => {
  const key = status === 'PRESENT' ? 'PRESENT' : 'NONE';
  return (
    <Badge tone={key === 'PRESENT' ? 'emerald' : 'slate-outline'} dot>
      {LABELS[key]}
    </Badge>
  );
};

export default AttendanceStatusBadge;
