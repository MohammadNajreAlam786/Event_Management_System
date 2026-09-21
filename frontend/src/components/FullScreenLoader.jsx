/**
 * Full-viewport loading state shown while the initial session check runs.
 */
const FullScreenLoader = ({ label = 'Loading…' }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50">
    <div className="flex items-center gap-3 text-slate-500">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"
        aria-hidden="true"
      />
      <span className="text-sm font-medium">{label}</span>
    </div>
  </div>
);

export default FullScreenLoader;
