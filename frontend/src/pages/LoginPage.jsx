import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import useAuthStore, { selectIsAuthenticated } from '../store/useAuthStore.js';
import { roleHomePath } from '../utils/roles.js';
import Icon from '../components/ui/Icon.jsx';

const BENEFITS = [
  { icon: 'clipboard-check', text: 'Plan events with a clear readiness workflow' },
  { icon: 'qr-code', text: 'Manage registrations and QR attendance' },
  { icon: 'sparkles', text: 'Review analytics and AI-based improvements' },
];

/**
 * Compact header for the focused Login page — no duplicate "Log in" action.
 * The "Home"/"Login" text pair is hidden below `sm` to avoid clipping at
 * narrow widths (320-375px); the logo itself still links home, so Home stays
 * reachable, and Register — the one action worth surfacing on mobile — is
 * always visible.
 */
const LoginHeader = () => (
  <header className="border-b border-slate-200 bg-white">
    <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-3 lg:px-10 xl:px-12">
      <Link to="/" className="flex min-w-0 shrink items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Icon name="calendar-check" className="h-[18px] w-[18px]" />
        </span>
        <span className="truncate text-base font-bold text-slate-900">EventFlow</span>
      </Link>

      <div className="flex shrink-0 items-center gap-3 text-sm font-medium sm:gap-5">
        <Link to="/" className="hidden text-slate-500 transition-colors hover:text-slate-900 sm:inline">
          Home
        </Link>
        <span className="hidden text-indigo-600 sm:inline" aria-current="page">
          Login
        </span>
        <Link
          to="/register"
          className="whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 transition-colors hover:bg-slate-100"
        >
          Register
        </Link>
      </div>
    </nav>
  </header>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const login = useAuthStore((s) => s.login);
  const clearError = useAuthStore((s) => s.clearError);

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const justRegistered = location.state?.registered === true;
  // Preserved by RoleProtectedRoute when an anonymous visit to a guarded
  // route (e.g. clicking "Register" on a Home page event) bounced here —
  // only a same-origin relative path is ever honoured.
  const redirectTo =
    typeof location.state?.from === 'string' && location.state.from.startsWith('/') && !location.state.from.startsWith('//')
      ? location.state.from
      : null;

  useEffect(() => {
    clearError();
    setError('');
  }, [clearError]);

  // Already signed in -> go straight back to where they came from, or the role area.
  if (isAuthenticated) {
    return <Navigate to={redirectTo || roleHomePath(user.role)} replace />;
  }

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.email.trim() || !form.password) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      const loggedInUser = await login(form.email.trim(), form.password);
      navigate(redirectTo || roleHomePath(loggedInUser.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to log in. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <LoginHeader />

      <main className="flex-1 px-6 py-10 md:py-14 lg:px-10 xl:px-12">
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
          <div className="hidden lg:block">
            <h1 className="text-3xl font-bold text-slate-900">Welcome back to EventFlow</h1>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Continue planning, managing and improving your events.
            </p>
            <ul className="mt-7 space-y-3 text-sm text-slate-600">
              {BENEFITS.map((b) => (
                <li key={b.text} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                    <Icon name={b.icon} className="h-4 w-4" />
                  </span>
                  {b.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Sign in</h2>
              <p className="text-sm text-slate-500">Access your event management workspace.</p>
            </div>

            {justRegistered && (
              <p className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <Icon name="check-circle" className="h-4 w-4 shrink-0" />
                Account created. Please log in.
              </p>
            )}

            {location.state?.intent === 'register' && (
              <p className="mt-4 flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                <Icon name="info" className="h-4 w-4 shrink-0" />
                Please log in to register for this event.
              </p>
            )}

            {error && (
              <p className="mt-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <Icon name="alert-circle" className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="space-y-1">
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <div className="relative">
                  <Icon name="user" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={update('email')}
                    className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Icon name="shield" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={update('password')}
                    className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-9 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPassword ? 'eye-off' : 'eye'} className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Logging in…' : 'Log in'}
              </button>
            </form>

            <p className="mt-5 text-sm text-slate-500">
              Need an account?{' '}
              <Link to="/register" className="font-medium text-indigo-600 hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
