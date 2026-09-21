import Icon from './ui/Icon.jsx';

/**
 * Generic "nothing here" state used across the app instead of fake data.
 * `icon` is optional (an Icon name) — every existing call site that omits it
 * renders the same centered title/description layout as before.
 */
const EmptyState = ({ title, description, icon = 'inbox', action }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
      <Icon name={icon} className="h-5 w-5" />
    </span>
    <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
    {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
