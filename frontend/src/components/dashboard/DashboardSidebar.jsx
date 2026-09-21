import { NavLink } from 'react-router-dom';

import Icon from '../ui/Icon.jsx';

/**
 * Shared sidebar shell for the Admin, Organiser and Participant dashboards.
 * On mobile it is a slide-in drawer (controlled by `open`/`onClose`); on
 * desktop (md+) it is a fixed column. Nav items differ per role — passed in
 * as `items` (`{to,label,end?,icon?,soon?,badge?}`).
 *
 * @param {{ brand: string, roleLabel?: string, items: object[], open: boolean, onClose: () => void }} props
 */
const DashboardSidebar = ({ brand, roleLabel, items, open, onClose }) => (
  <>
    {open && (
      <button
        type="button"
        aria-label="Close sidebar"
        onClick={onClose}
        className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
      />
    )}

    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 transform flex-col overflow-y-auto border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:static md:z-auto md:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Icon name="calendar-check" className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-slate-900">EventFlow</p>
            {roleLabel && <p className="truncate text-xs text-slate-400">{roleLabel}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 md:hidden"
          aria-label="Close sidebar"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              `group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-indigo-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
                  aria-hidden="true"
                />
                {item.icon && (
                  <Icon
                    name={item.icon}
                    className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'}`}
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.soon && <span className="text-[10px] uppercase tracking-wide text-slate-400">Soon</span>}
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-4 py-3">
        <p className="text-[11px] text-slate-400">AI-Powered Event Management System</p>
      </div>
    </aside>
  </>
);

export default DashboardSidebar;
