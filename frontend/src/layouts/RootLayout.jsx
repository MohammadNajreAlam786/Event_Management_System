import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import useAuthStore, { selectIsAuthenticated } from '../store/useAuthStore.js';
import { roleHomePath, roleLabel } from '../utils/roles.js';
import Icon from '../components/ui/Icon.jsx';

const linkClass = ({ isActive }) =>
  isActive
    ? 'font-semibold text-indigo-600'
    : 'text-slate-500 transition-colors hover:text-slate-900';

/**
 * Shared page frame: auth-aware top navigation + routed content outlet.
 *
 * `/` and `/login` are "immersive" pages (Phase 12.1) — each builds its own
 * full-width header/footer to match a landing-page / focused-auth-page
 * design, so this shell renders only the bare `<Outlet/>` for them. Every
 * other public route (`/register`, `/verify`, `/verify/:code`, 404) keeps
 * this exact generic header + centered `<main>` + footer, completely
 * unchanged, so those pages' appearance is untouched by the Home/Login
 * redesign.
 */
const RootLayout = () => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isImmersive = location.pathname === '/' || location.pathname === '/login';
  if (isImmersive) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold text-indigo-600">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Icon name="calendar-check" className="h-[18px] w-[18px]" />
            </span>
            EventFlow
          </Link>

          <ul className="hidden flex-wrap items-center gap-4 text-sm sm:flex">
            <li>
              <NavLink to="/" end className={linkClass}>
                Home
              </NavLink>
            </li>

            {!isAuthenticated && (
              <>
                <li>
                  <NavLink to="/login" className={linkClass}>
                    Login
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/register" className={linkClass}>
                    Register
                  </NavLink>
                </li>
              </>
            )}

            {isAuthenticated && (
              <li>
                <NavLink to={roleHomePath(user.role)} className={linkClass}>
                  My area
                </NavLink>
              </li>
            )}
          </ul>

          <div className="ml-auto flex items-center gap-3 text-sm">
            {isAuthenticated ? (
              <>
                <span className="hidden text-slate-500 sm:inline">
                  {user.name}{' '}
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                    {roleLabel(user.role)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="hidden rounded-md bg-indigo-600 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-indigo-700 sm:inline-block"
              >
                Log in
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 sm:hidden"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <Icon name={menuOpen ? 'x' : 'menu'} className="h-5 w-5" />
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div className="border-t border-slate-100 px-6 py-3 sm:hidden">
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <NavLink to="/" end className={linkClass} onClick={() => setMenuOpen(false)}>
                  Home
                </NavLink>
              </li>
              {!isAuthenticated ? (
                <>
                  <li>
                    <NavLink to="/login" className={linkClass} onClick={() => setMenuOpen(false)}>
                      Login
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/register" className={linkClass} onClick={() => setMenuOpen(false)}>
                      Register
                    </NavLink>
                  </li>
                </>
              ) : (
                <li>
                  <NavLink to={roleHomePath(user.role)} className={linkClass} onClick={() => setMenuOpen(false)}>
                    My area
                  </NavLink>
                </li>
              )}
            </ul>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-5xl px-6 py-8 text-xs text-slate-400">
        AI-Powered Event Planning &amp; Management System — planning, registration, QR
        attendance, certificates, feedback, analytics and AI-based improvement
        recommendations in one place.
      </footer>
    </div>
  );
};

export default RootLayout;
