import Badge from '../ui/Badge.jsx';

const TONES = { HIGH: 'violet', MEDIUM: 'slate', LOW: 'slate-outline' };

/**
 * Pill for a recommendation's evidence strength. Deliberately labelled
 * "evidence" rather than "confidence" in the UI text, so it is never mistaken
 * for a statistical confidence interval or a model probability — it reflects
 * how much underlying data (sample size) the recommendation is based on.
 * Uses the app's AI-accent tone (violet) at its strongest, tying it visually
 * to the rest of the AI-generated surface without implying certainty.
 */
const ConfidenceBadge = ({ confidence }) => {
  const key = TONES[confidence] ? confidence : 'LOW';
  return (
    <Badge tone={TONES[key]} dot>
      {key} evidence
    </Badge>
  );
};

export default ConfidenceBadge;
