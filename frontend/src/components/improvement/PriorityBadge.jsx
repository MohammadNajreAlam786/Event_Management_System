import Badge from '../ui/Badge.jsx';

const TONES = { HIGH: 'rose', MEDIUM: 'amber', LOW: 'slate' };

/** Pill for a recommendation's priority. */
const PriorityBadge = ({ priority }) => {
  const key = TONES[priority] ? priority : 'LOW';
  return (
    <Badge tone={TONES[key]} dot>
      {key} priority
    </Badge>
  );
};

export default PriorityBadge;
