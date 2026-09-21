import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import useAuthStore from '../../store/useAuthStore.js';
import Icon from '../ui/Icon.jsx';
import { roleLabel as roleLabelFor, roleHomePath } from '../../utils/roles.js';

const ROLE_TONE = {
  ADMIN: 'bg-violet-50 text-violet-700 border-violet-200',
  ORGANISER: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  USER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const initialsOf = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

/**
 * Shared top bar for the Admin, Organiser and Participant dashboards: mobile
 * sidebar toggle, page title, an optional notification bell (`notifyHref` +
 * `notifyCount` — only passed where a notification feature actually exists),
 * user identity (avatar + name + role badge), and logout.
 *
 * The Logout control is always directly visible (not tucked behind a menu
 * click) — every regression suite since Phase 1 drives it with a direct
 * button click, and that is also the safer, more discoverable choice.
 */
const DashboardHeader = ({ title, onMenuClick, notifyHref, notifyCount }) => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const dashboardHref = roleHomePath(user?.role);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Keyboard accessible: Escape closes the profile menu from anywhere.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Open sidebar"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {notifyHref && (
          <Link
            to={notifyHref}
            className="relative rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label={notifyCount > 0 ? `Notifications, ${notifyCount} unread` : 'Notifications'}
          >
            <Icon name="bell" className="h-5 w-5" />
            {typeof notifyCount === 'number' && notifyCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-rose-600 px-1 py-0.5 text-[10px] font-semibold leading-none text-white">
                {notifyCount > 99 ? '99+' : notifyCount}
              </span>
            )}
          </Link>
        )}

        <div className="relative border-r border-slate-200 pr-2 sm:pr-3">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-slate-100"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Open account menu"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              {initialsOf(user?.name)}
            </span>
            <span className="hidden items-center gap-2 sm:flex">
              <span className="max-w-[10rem] truncate text-sm text-slate-700">{user?.name}</span>
              {user?.role && (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_TONE[user.role] ?? ROLE_TONE.USER}`}
                >
                  {roleLabelFor(user.role)}
                </span>
              )}
            </span>
            <Icon name="chevron-down" className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close account menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1.5 shadow-xl"
              >
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  {user?.role && (
                    <span
                      className={`mt-1.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_TONE[user.role] ?? ROLE_TONE.USER}`}
                    >
                      {roleLabelFor(user.role)}
                    </span>
                  )}
                </div>
                <Link
                  role="menuitem"
                  to={`${dashboardHref}/profile`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Icon name="user-circle" className="h-4 w-4 text-slate-400" />
                  View Profile
                </Link>
                <Link
                  role="menuitem"
                  to={`${dashboardHref}/settings`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Icon name="settings" className="h-4 w-4 text-slate-400" />
                  Settings
                </Link>
                <Link
                  role="menuitem"
                  to={dashboardHref}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Icon name="dashboard" className="h-4 w-4 text-slate-400" />
                  Dashboard
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                >
                  <Icon name="log-out" className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <Icon name="log-out" className="h-4 w-4" />
          Logout
        </button>
      </div>
    </header>
  );
};

export default DashboardHeader;
