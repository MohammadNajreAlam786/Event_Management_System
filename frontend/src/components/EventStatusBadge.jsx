import Badge from './ui/Badge.jsx';
import { EVENT_STATUS_LABEL } from '../utils/eventMeta.js';

const TONES = {
  DRAFT: 'slate',
  PLANNED: 'indigo',
  UPCOMING: 'sky',
  ONGOING: 'emerald',
  COMPLETED: 'slate',
  CANCELLED: 'rose',
};

/** Status pill shared by the Organiser and Admin event views. */
const EventStatusBadge = ({ status }) => (
  <Badge tone={TONES[status] ?? 'slate'} dot>
    {EVENT_STATUS_LABEL[status] ?? status}
  </Badge>
);

export default EventStatusBadge;
