import Badge from '../ui/Badge.jsx';

/** Small pill showing a user's ACTIVE/INACTIVE status. */
const StatusBadge = ({ status }) => (
  <Badge tone={status === 'ACTIVE' ? 'emerald' : 'slate'} dot>
    {status === 'ACTIVE' ? 'Active' : 'Inactive'}
  </Badge>
);

export default StatusBadge;
