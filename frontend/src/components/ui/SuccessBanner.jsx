import Icon from './Icon.jsx';

/** Shared inline success banner — the positive counterpart to ErrorBanner. */
const SuccessBanner = ({ message }) => (
  <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
    <Icon name="check-circle" className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="min-w-0 flex-1">{message}</div>
  </div>
);

export default SuccessBanner;
