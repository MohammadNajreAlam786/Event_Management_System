import Badge from '../ui/Badge.jsx';
import { TONE_BY_VALUE, label as humanise } from '../../utils/planningMeta.js';

/**
 * Generic status/priority pill for planning. Pass the raw enum `value`
 * (e.g. "IN_PROGRESS", "CRITICAL", "NOT_AVAILABLE"); tone and label are
 * derived. `text`/`tone` override for custom cases (readiness status).
 */
const PlanningBadge = ({ value, text, tone }) => {
  const resolvedTone = tone ?? TONE_BY_VALUE[value] ?? 'slate';
  return (
    <Badge tone={resolvedTone} dot>
      {text ?? humanise(value)}
    </Badge>
  );
};

export default PlanningBadge;
