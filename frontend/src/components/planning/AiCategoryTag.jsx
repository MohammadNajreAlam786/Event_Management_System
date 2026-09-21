import Badge from '../ui/Badge.jsx';
import { label } from '../../utils/planningMeta.js';

/** Neutral pill for an AI finding's area (TASK / SCHEDULE / RESOURCE / …). */
const AiCategoryTag = ({ value }) => <Badge tone="slate-outline">{label(value)}</Badge>;

export default AiCategoryTag;
