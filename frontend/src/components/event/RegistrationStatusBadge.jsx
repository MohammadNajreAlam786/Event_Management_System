import Badge from '../ui/Badge.jsx';

const TONES = { REGISTERED: 'emerald', CANCELLED: 'slate', NONE: 'slate-outline' };
const LABELS = { REGISTERED: 'Registered', CANCELLED: 'Cancelled', NONE: 'Not registered' };

/** Pill for a participant's registration state on an event. */
const RegistrationStatusBadge = ({ status }) => {
  const key = status === 'REGISTERED' || status === 'CANCELLED' ? status : 'NONE';
  return (
    <Badge tone={TONES[key]} dot>
      {LABELS[key]}
    </Badge>
  );
};

export default RegistrationStatusBadge;
