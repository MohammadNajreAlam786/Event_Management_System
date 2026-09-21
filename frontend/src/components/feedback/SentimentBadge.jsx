import Badge from '../ui/Badge.jsx';

const TONES = { POSITIVE: 'emerald', NEUTRAL: 'slate-outline', NEGATIVE: 'rose', PENDING: 'amber', NONE: 'slate-outline' };
const LABELS = {
  POSITIVE: 'Positive',
  NEUTRAL: 'Neutral',
  NEGATIVE: 'Negative',
  PENDING: 'Analysis unavailable',
  NONE: 'No comment',
};

/**
 * Pill for a feedback comment's AI sentiment.
 *
 * @param {{ sentiment?: 'POSITIVE'|'NEUTRAL'|'NEGATIVE'|null, status?: string, score?: number|null }} props
 */
const SentimentBadge = ({ sentiment, status, score }) => {
  let key = 'NONE';
  if (sentiment && LABELS[sentiment]) key = sentiment;
  else if (status === 'PENDING' || status === 'FAILED') key = 'PENDING';
  else if (status === 'SKIPPED') key = 'NONE';

  const showScore = (key === 'POSITIVE' || key === 'NEUTRAL' || key === 'NEGATIVE') && typeof score === 'number';

  return (
    <Badge tone={TONES[key]} dot>
      {LABELS[key]}
      {showScore && <span className="font-normal opacity-70">· {Math.round(score * 100)}%</span>}
    </Badge>
  );
};

export default SentimentBadge;
