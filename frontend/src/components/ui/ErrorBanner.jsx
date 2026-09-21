import Icon from './Icon.jsx';

/**
 * Shared inline error banner — the "rounded-md border-rose-200 bg-rose-50…"
 * block that was hand-duplicated across nearly every page. Never renders a
 * stack trace or raw server payload — callers pass the already-safe,
 * user-facing `message` produced by the API layer.
 */
const ErrorBanner = ({ message, onRetry, retryLabel = 'Try again' }) => (
  <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
    <Icon name="alert-circle" className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="min-w-0 flex-1">
      <div>{message}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
        >
          {retryLabel}
        </button>
      )}
    </div>
  </div>
);

export default ErrorBanner;
