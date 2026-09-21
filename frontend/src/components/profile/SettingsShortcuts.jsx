import { Link } from 'react-router-dom';

import Icon from '../ui/Icon.jsx';

/** Small grid of quick-navigation cards shared by every role's Settings page. */
const SettingsShortcuts = ({ items }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {items.map((item) => (
      <Link
        key={item.to}
        to={item.to}
        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon name={item.icon} className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
          {item.description && <p className="truncate text-xs text-slate-500">{item.description}</p>}
        </div>
      </Link>
    ))}
  </div>
);

export default SettingsShortcuts;
