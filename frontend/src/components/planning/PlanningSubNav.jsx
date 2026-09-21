import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import Icon from '../ui/Icon.jsx';

const items = [
  { to: '', label: 'Overview', end: true, icon: 'dashboard' },
  { to: 'tasks', label: 'Tasks', icon: 'clipboard-check' },
  { to: 'schedule', label: 'Schedule', icon: 'clock' },
  { to: 'resources', label: 'Resources', icon: 'layers' },
  { to: 'budget', label: 'Budget', icon: 'coin' },
  { to: 'team', label: 'Team', icon: 'users' },
  { to: 'readiness', label: 'Readiness', icon: 'shield-check' },
  { to: 'ai', label: 'AI Assistant', icon: 'sparkles', ai: true },
];

const linkClass = (isAi) => ({ isActive }) =>
  `flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? isAi
        ? 'bg-violet-600 text-white'
        : 'bg-indigo-600 text-white'
      : 'text-slate-600 hover:bg-slate-100'
  }`;

/** Tab bar for the planning workspace. `base` is the workspace root path. */
const PlanningSubNav = ({ base }) => {
  const navRef = useRef(null);
  const { pathname } = useLocation();

  // Keep the active tab visible when the bar has to scroll horizontally (mobile).
  useEffect(() => {
    const active = navRef.current?.querySelector('[aria-current="page"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1"
    >
      {items.map((it) => (
        <NavLink key={it.label} to={it.to ? `${base}/${it.to}` : base} end={it.end} className={linkClass(it.ai)}>
          <Icon name={it.icon} className="h-4 w-4" />
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
};

export default PlanningSubNav;
