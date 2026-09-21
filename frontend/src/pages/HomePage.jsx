import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import Icon from '../components/ui/Icon.jsx';
import EventStatusBadge from '../components/EventStatusBadge.jsx';
import useAuthStore, { selectIsAuthenticated } from '../store/useAuthStore.js';
import { roleHomePath, roleLabel } from '../utils/roles.js';
import { EVENT_CATEGORY_LABEL, CATEGORY_GRADIENT, formatDateDMY } from '../utils/eventMeta.js';
import participantService from '../services/participantService.js';

/** Stable section ids the nav scrolls to (Phase 14 — Home page navigation). */
const SECTION_IDS = ['home', 'events', 'features', 'how-it-works'];

const NAV_LINKS = [
  { href: '#home', label: 'Home' },
  { href: '#events', label: 'Events' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
];

const FEATURES = [
  {
    icon: 'clipboard-list',
    title: 'Pre-event Planning',
    description: 'Organise tasks, schedules, resources, budgets and team responsibilities before event day.',
  },
  {
    icon: 'calendar-plus',
    title: 'Smart Registration',
    description: 'Allow participants to discover events and register easily.',
  },
  {
    icon: 'qr-code',
    title: 'QR-Based Attendance',
    description: 'Record attendance securely through QR-based check-in.',
  },
  {
    icon: 'award',
    title: 'Certificates',
    description: 'Generate and verify certificates for eligible participants.',
  },
  {
    icon: 'chart-bar',
    title: 'Feedback and Analytics',
    description: 'Understand participation, attendance, ratings and feedback sentiment.',
  },
  {
    icon: 'sparkles',
    title: 'AI-Based Improvements',
    description: 'Use data-grounded recommendations to improve future events.',
    accent: 'violet',
  },
];

const WORKFLOW = [
  { icon: 'clipboard-list', title: 'Plan', description: 'Set tasks, schedule and budget.' },
  { icon: 'clipboard-check', title: 'Prepare', description: 'Line up resources and your team.' },
  { icon: 'calendar-check', title: 'Conduct', description: 'Run the event and check in attendees.' },
  { icon: 'chart-bar', title: 'Track', description: 'Watch registration and attendance live.' },
  { icon: 'message-square', title: 'Evaluate', description: 'Collect feedback and sentiment.' },
  { icon: 'sparkles', title: 'Improve', description: 'Apply AI-based recommendations next time.' },
];

const ROLES = [
  {
    icon: 'shield-check',
    tone: 'violet',
    title: 'Admin',
    description: 'Manage users, organisers, events and overall system statistics.',
  },
  {
    icon: 'calendar-check',
    tone: 'indigo',
    title: 'Organiser',
    description: 'Plan events, coordinate resources, monitor attendance and review improvements.',
  },
  {
    icon: 'user-circle',
    tone: 'emerald',
    title: 'Participant',
    description: 'Discover events, register, check in, receive certificates and submit feedback.',
  },
];

const ROLE_TONE = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

const BrandMark = ({ light = false }) => (
  <span className="flex items-center gap-2 text-lg font-bold">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
      <Icon name="calendar-check" className="h-[18px] w-[18px]" />
    </span>
    <span className={light ? 'text-white' : 'text-slate-900'}>EventFlow</span>
  </span>
);

/**
 * Sticky marketing navbar for the public Home page (Phase 14). Every link
 * scrolls within the page — `activeSection` (scroll-spied by the parent via
 * IntersectionObserver) drives which item is highlighted, and `onNavigate`
 * performs the actual (motion-aware) smooth scroll — no route change, no page
 * reload.
 */
const HomeNavbar = ({ isAuthenticated, areaHref, activeSection, onNavigate }) => {
  const [open, setOpen] = useState(false);

  const go = (sectionId) => (event) => {
    event.preventDefault();
    onNavigate(sectionId);
    setOpen(false);
  };

  const linkClass = (isActive) =>
    `rounded-md px-1.5 py-1 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
      isActive ? 'bg-indigo-50 font-semibold text-indigo-600' : 'text-slate-600 hover:text-slate-900'
    }`;
  const mobileLinkClass = (isActive) =>
    `rounded-md px-2 py-1.5 transition-colors duration-150 ${
      isActive ? 'bg-indigo-50 font-semibold text-indigo-600' : 'text-slate-600'
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="flex w-full items-center justify-between gap-4 px-6 py-3 lg:px-10 xl:px-12">
        <Link to="/" className="shrink-0">
          <BrandMark />
        </Link>

        <ul className="hidden items-center gap-2 text-sm font-medium text-slate-600 md:flex">
          {NAV_LINKS.map((l) => {
            const sectionId = l.href.slice(1);
            const isActive = activeSection === sectionId;
            return (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={go(sectionId)}
                  aria-current={isActive ? 'true' : undefined}
                  className={linkClass(isActive)}
                >
                  {l.label}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <Link
              to={areaHref}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Go to your area
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <Icon name={open ? 'x' : 'menu'} className="h-5 w-5" />
        </button>
      </nav>

      {open && (
        <div className="border-t border-slate-100 px-6 py-3 md:hidden">
          <ul className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            {NAV_LINKS.map((l) => {
              const sectionId = l.href.slice(1);
              const isActive = activeSection === sectionId;
              return (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={go(sectionId)}
                    aria-current={isActive ? 'true' : undefined}
                    className={mobileLinkClass(isActive)}
                  >
                    {l.label}
                  </a>
                </li>
              );
            })}
            <li className="flex flex-col gap-2 pt-2">
              {isAuthenticated ? (
                <Link
                  to={areaHref}
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white"
                >
                  Go to your area
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setOpen(false)}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
};

/** Decorative, clearly-sample dashboard preview — no real backend data. */
const ProductPreview = () => (
  <div className="relative mx-auto w-full max-w-md">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card-hover)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sample preview</p>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
          Upcoming
        </span>
      </div>
      <p className="mt-2 text-base font-bold text-slate-900">Robotics Workshop</p>
      <p className="text-xs text-slate-500">Sat, 10:00 AM · Main Auditorium</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Icon name="users" className="h-3.5 w-3.5" />
            Registrations
          </p>
          <p className="mt-1 text-xl font-bold text-indigo-600">66/100</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Icon name="trending-up" className="h-3.5 w-3.5" />
            Attendance
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-600">84%</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-100 p-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Event readiness</span>
          <span className="font-semibold text-slate-700">80%</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[80%] rounded-full bg-indigo-500" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 p-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
          <Icon name="sparkles" className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs text-violet-800">Consider a smaller venue next time — capacity was under-filled.</p>
      </div>
    </div>

    <div className="absolute -bottom-5 -right-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[var(--shadow-card-hover)]">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
        <Icon name="qr-code" className="h-4 w-4" />
      </span>
      <div className="leading-tight">
        <p className="text-[11px] font-medium text-slate-400">Check-in</p>
        <p className="text-xs font-semibold text-slate-800">Ready to scan</p>
      </div>
    </div>
  </div>
);

/**
 * The Home page never performs a registration itself — every action below
 * navigates to the real event details page (`/user/events/:id`), where the
 * existing `RegistrationPanel` is the one and only place a registration is
 * actually created. An anonymous visitor hitting that guarded route is
 * redirected to `/login` by the existing `RoleProtectedRoute`, which already
 * preserves the destination via `location.state.from` — no separate redirect
 * mechanism is needed here.
 */
const homeEventAction = ({ event, isAuthenticated, isRegistered }) => {
  const detailsHref = `/user/events/${event.id}`;
  if (!isAuthenticated) {
    // Go straight to /login (rather than the guarded details page, which
    // would just bounce here anyway) so the login page can show a message
    // explaining *why*, and return the visitor to the event afterwards.
    return { label: 'Register', href: '/login', state: { from: detailsHref, intent: 'register' } };
  }
  if (isRegistered) return { label: 'Registered', href: '/user/my-events' };
  if (event.capacity?.isFull) return { label: 'Event Full', disabled: true };
  if (event.status === 'CANCELLED') return { label: 'Cancelled', disabled: true };
  if (event.status === 'COMPLETED') return { label: 'Registration Closed', disabled: true };
  if (!event.registration?.registrable) return { label: 'Registration Closed', href: detailsHref };
  return { label: 'Register', href: detailsHref };
};

/** Real event card for the Featured Events section — fetched from the backend, never sample data. */
const HomeEventCard = ({ event, isAuthenticated, isRegistered }) => {
  const gradient = CATEGORY_GRADIENT[event.category] ?? CATEGORY_GRADIENT.OTHER;
  const action = homeEventAction({ event, isAuthenticated, isRegistered });

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      {event.image ? (
        <img src={event.image} alt="" className="h-24 w-full shrink-0 object-cover" />
      ) : (
        <div className={`flex h-24 shrink-0 items-center justify-center bg-gradient-to-br ${gradient}`}>
          <Icon name="calendar-check" className="h-9 w-9 text-white/90" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {EVENT_CATEGORY_LABEL[event.category] ?? event.category}
          </span>
          <EventStatusBadge status={event.status} />
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">{event.title}</p>
        <div className="mt-2 space-y-1.5 text-xs text-slate-500">
          <p className="flex items-center gap-1.5">
            <Icon name="calendar" className="h-3.5 w-3.5 shrink-0" />
            {formatDateDMY(event.startDate)}
            {event.endDate ? ` – ${formatDateDMY(event.endDate)}` : ''}
          </p>
          <p className="flex items-center gap-1.5">
            <Icon name="map-pin" className="h-3.5 w-3.5 shrink-0" />
            {event.venue}
          </p>
          {event.capacity?.max != null && (
            <p className="flex items-center gap-1.5">
              <Icon name="users" className="h-3.5 w-3.5 shrink-0" />
              {event.capacity.registered}/{event.capacity.max} registered
            </p>
          )}
        </div>
        <div className="mt-4 pt-1">
          {action.disabled ? (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400"
            >
              {action.label}
            </button>
          ) : (
            <Link
              to={action.href}
              state={action.state}
              className="inline-flex rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              {action.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

const FEATURED_EVENTS_LIMIT = 8;

const HomePage = () => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((s) => s.user);
  const areaHref = isAuthenticated ? roleHomePath(user.role) : '/register';

  const [events, setEvents] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [reloadKey, setReloadKey] = useState(0);
  const [registeredEventIds, setRegisteredEventIds] = useState(() => new Set());

  // ---------------------------------------------------------- Home nav scroll-spy
  const [activeSection, setActiveSection] = useState('home');
  const manualScrollLock = useRef(false);
  const unlockTimerRef = useRef(null);

  const navigateToSection = useCallback((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setActiveSection(sectionId);
    manualScrollLock.current = true;
    if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = window.setTimeout(() => {
      manualScrollLock.current = false;
    }, 900);
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, []);

  // Scroll detection (§33) — IntersectionObserver only, cleaned up on unmount.
  useEffect(() => {
    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
    if (sections.length === 0) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (manualScrollLock.current) return;
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topmost = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b,
        );
        setActiveSection((prev) => (prev === topmost.target.id ? prev : topmost.target.id));
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => {
      observer.disconnect();
      if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    participantService
      .getFeaturedEvents(FEATURED_EVENTS_LIMIT)
      .then((data) => {
        if (!active) return;
        setEvents(data);
        setLoadState('ready');
      })
      .catch(() => {
        if (!active) return;
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Only a signed-in USER can have registrations to cross-reference — this
  // never runs for anonymous visitors or Admin/Organiser accounts.
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'USER') {
      setRegisteredEventIds(new Set());
      return undefined;
    }
    let active = true;
    participantService
      .getMyRegistrations({ status: 'REGISTERED' })
      .then((regs) => {
        if (!active) return;
        setRegisteredEventIds(new Set(regs.map((r) => r.event.id)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.role]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        areaHref={areaHref}
        activeSection={activeSection}
        onNavigate={navigateToSection}
      />

      {/* ---------------------------------------------------------- Hero */}
      <section id="home" className="w-full scroll-mt-20 px-6 pb-16 pt-14 lg:px-10 lg:pb-24 lg:pt-20 xl:px-12">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              AI-Powered Event Management
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Plan better events. Run them smoothly. Improve every time.
            </h1>
            <p className="mt-4 max-w-lg text-base text-slate-600">
              EventFlow helps organisers plan, manage, monitor and improve events through one
              connected workspace.
            </p>

            {isAuthenticated ? (
              <div className="mt-6 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                <Icon name="check-circle" className="h-4 w-4 shrink-0" />
                Signed in as <span className="font-medium">{user.name}</span> ({roleLabel(user.role)}).
              </div>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={areaHref}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                {isAuthenticated ? 'Go to your area' : 'Start Planning'}
                <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
              <a
                href="#events"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToSection('events');
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                Explore Events
              </a>
            </div>

            <p className="mt-5 text-xs font-medium uppercase tracking-wide text-slate-400">
              Planning &bull; Registration &bull; QR Attendance &bull; Analytics
            </p>
          </div>

          <ProductPreview />
        </div>
      </section>

      {/* -------------------------------------------------- Featured Events */}
      <section id="events" className="scroll-mt-20 border-t border-slate-100 bg-slate-50 py-16">
        <div className="w-full px-6 lg:px-10 xl:px-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Featured Events</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Discover upcoming events and be part of the next experience.
              </p>
            </div>
            <Link
              to="/user/events"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
            >
              View All Events
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8">
            {loadState === 'loading' && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i} className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white" />
                ))}
              </div>
            )}
            {loadState === 'loading' && (
              <p className="sr-only" role="status">
                Loading upcoming events…
              </p>
            )}

            {loadState === 'error' && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
                <p className="text-sm text-slate-500">Unable to load events right now. Please try again.</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Retry
                </button>
              </div>
            )}

            {loadState === 'ready' && events.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
                <p className="text-sm text-slate-500">No upcoming events are available right now.</p>
              </div>
            )}

            {loadState === 'ready' && events.length > 0 && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {events.map((event) => (
                  <HomeEventCard
                    key={event.id}
                    event={event}
                    isAuthenticated={isAuthenticated}
                    isRegistered={registeredEventIds.has(event.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Features */}
      <section id="features" className="scroll-mt-20 border-t border-slate-100 py-16">
        <div className="w-full px-6 lg:px-10 xl:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Everything needed for a successful event
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const tone = f.accent === 'violet' ? 'violet' : 'indigo';
              const t = ROLE_TONE[tone];
              return (
                <div
                  key={f.title}
                  className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.bg} ${t.text}`}>
                    <Icon name={f.icon} className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-slate-900">{f.title}</p>
                  <p className="mt-1.5 text-sm text-slate-500">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Workflow */}
      <section id="how-it-works" className="scroll-mt-20 border-t border-slate-100 bg-slate-50 py-16">
        <div className="w-full px-6 lg:px-10 xl:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              From preparation to improvement
            </h2>
          </div>

          <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW.map((step, i) => (
              <li key={step.title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-600">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <Icon name={step.icon} className="h-4 w-4 shrink-0 text-slate-400" />
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------- Roles */}
      <section className="border-t border-slate-100 py-16">
        <div className="w-full px-6 lg:px-10 xl:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Built for every event participant
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {ROLES.map((r) => {
              const t = ROLE_TONE[r.tone];
              return (
                <div key={r.title} className={`rounded-xl border bg-white p-5 ${t.border}`}>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.bg} ${t.text}`}>
                    <Icon name={r.icon} className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-slate-900">{r.title}</p>
                  <p className="mt-1.5 text-sm text-slate-500">{r.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section className="bg-indigo-600 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Make your next event easier to organise.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-indigo-100">
            Bring planning, participation, attendance and improvement into one connected platform.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {isAuthenticated ? (
              <Link
                to={areaHref}
                className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
              >
                Go to your area
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
                >
                  Create an Account
                </Link>
                <Link
                  to="/login"
                  className="rounded-md border border-indigo-300 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
