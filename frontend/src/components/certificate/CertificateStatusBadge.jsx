import Badge from '../ui/Badge.jsx';

const LABELS = { ISSUED: 'Issued', NONE: 'Not issued' };

/** Pill for a certificate's status. */
const CertificateStatusBadge = ({ status }) => {
  const key = status === 'ISSUED' ? 'ISSUED' : 'NONE';
  return (
    <Badge tone={key === 'ISSUED' ? 'emerald' : 'slate-outline'} dot>
      {LABELS[key]}
    </Badge>
  );
};

export default CertificateStatusBadge;
