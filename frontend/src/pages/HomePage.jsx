import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Icon from '../components/ui/Icon.jsx';
import EventStatusBadge from '../components/EventStatusBadge.jsx';
import CinematicIntro from '../components/CinematicIntro.jsx';
import useAuthStore, { selectIsAuthenticated } from '../store/useAuthStore.js';
import { roleHomePath, roleLabel, ROLES } from '../utils/roles.js';
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABEL,
  CATEGORY_GRADIENT,
  CATEGORY_ICON,
  CATEGORY_ACCENT,
  formatDateDMY,
} from '../utils/eventMeta.js';
import participantService from '../services/participantService.js';

/** Section anchor IDs for in-page navigation and scroll-spy */
const SECTION_IDS = ['home', 'events', 'features', 'how-it-works', 'roles'];

const NAV_LINKS = [
  { href: '#home', label: 'Home' },
  { href: '#events', label: 'Events' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#roles', label: 'Roles' },
];

/** Implemented features in EventFlow platform */
const PLATFORM_FEATURES = [
  {
    icon: 'clipboard-list',
    title: 'Pre-Event Planning Workspace',
    description: 'Structured tasks, milestones, resource allocation, and budget tracking before event day.',
    tag: 'Organiser Workspace',
    accent: 'indigo',
  },
  {
    icon: 'calendar-plus',
    title: 'Smart Registration & Teams',
    description: 'Effortless self-service registration for individuals and multi-member team delegations with capacity controls.',
    tag: 'Participant Portal',
    accent: 'blue',
  },
  {
    icon: 'qr-code',
    title: 'High-Speed QR Attendance',
    description: 'Sub-second check-in using cryptographically signed QR nonces with real-time sync.',
    tag: 'Live Event Operations',
    accent: 'violet',
  },
  {
    icon: 'award',
    title: 'Verifiable Digital Certificates',
    description: 'Automated certificate generation for attendees with a public verification portal at /verify.',
    tag: 'Credentialing',
    accent: 'emerald',
  },
  {
    icon: 'chart-bar',
    title: 'Feedback & Sentiment Analysis',
    description: 'Collect structured participant reviews with automatic AI sentiment classification to gauge satisfaction.',
    tag: 'Audience Sentiment',
    accent: 'amber',
  },
  {
    icon: 'sparkles',
    title: 'AI Event Analytics & Insights',
    description: 'Actionable recommendations and performance analytics grounded in real post-event attendance data.',
    tag: 'AI Intelligence',
    accent: 'violet',
  },
];

/** 5-step participant workflow */
const PARTICIPANT_JOURNEY = [
  {
    step: '01',
    icon: 'search',
    title: 'Discover Events',
    description: 'Browse upcoming workshops, hackathons, and conferences with live availability and venue details.',
  },
  {
    step: '02',
    icon: 'user-circle',
    title: 'Register in 1-Click',
    description: 'Enroll as an individual participant or submit a multi-member team delegation with instant confirmation.',
  },
  {
    step: '03',
    icon: 'qr-code',
    title: 'Get Your QR Pass',
    description: 'Receive your personalized, cryptographically signed QR check-in credential in your dashboard.',
  },
  {
    step: '04',
    icon: 'calendar-check',
    title: 'Attend & Check In',
    description: 'Present your QR pass at the entrance for instant contactless scanning by the event staff.',
  },
  {
    step: '05',
    icon: 'award',
    title: 'Certificates & Feedback',
    description: 'Download your official certificate of participation and share ratings to improve future editions.',
  },
];

/** Role cards highlighting capabilities for all 3 user types */
const USER_ROLES = [
  {
    role: 'Participant',
    icon: 'user-circle',
    tone: 'emerald',
    badge: 'Discover & Attend',
    headline: 'For Learners & Attendees',
    description: 'Discover inspiring workshops, track registrations, check in with QR passes, claim verified certificates, and submit reviews.',
    features: ['Public event exploration', 'Instant QR check-in pass', 'Downloadable PDF certificates', 'Team registration support'],
    ctaLabel: 'Browse Events',
    ctaTarget: '#events',
  },
  {
    role: 'Organiser',
    icon: 'calendar-check',
    tone: 'indigo',
    badge: 'Plan & Execute',
    headline: 'For Event Creators',
    description: 'Design events from scratch, manage planning checklists and budgets, conduct live QR attendance, and review AI analytics.',
    features: ['Pre-event planning workspace', 'Live attendee management', 'Certificate batch issuance', 'AI-powered improvement advice'],
    ctaLabel: 'Start Organizing',
    ctaTarget: '/register',
  },
  {
    role: 'Administrator',
    icon: 'shield-check',
    tone: 'violet',
    badge: 'Govern & Scale',
    headline: 'For System Governance',
    description: 'Comprehensive oversight over platform users, organisers, event lifecycles, and institutional analytics.',
    features: ['User and organiser approvals', 'System-wide event monitoring', 'Comprehensive audit metrics', 'Policy & security controls'],
    ctaLabel: 'Sign In as Admin',
    ctaTarget: '/login',
  },
];

const ROLE_STYLES = {
  emerald: {
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-600',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    highlight: 'text-emerald-700',
  },
  indigo: {
    bg: 'bg-indigo-50/70',
    border: 'border-indigo-200',
    iconBg: 'bg-indigo-600',
    badgeBg: 'bg-indigo-100 text-indigo-800',
    highlight: 'text-indigo-700',
  },
  violet: {
    bg: 'bg-violet-50/70',
    border: 'border-violet-200',
    iconBg: 'bg-violet-600',
    badgeBg: 'bg-violet-100 text-violet-800',
    highlight: 'text-violet-700',
  },
};

/**
 * Brand Logo component
 */
const BrandMark = ({ light = false }) => (
  <span className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-sm ring-1 ring-indigo-500/20">
      <Icon name="calendar-check" className="h-5 w-5" />
    </span>
    <span className={light ? 'text-white' : 'text-slate-900'}>
      Event<span className="text-indigo-600">Flow</span>
    </span>
  </span>
);

/**
 * Responsive Navigation Bar
 */
const HomeNavbar = ({ isAuthenticated, user, areaHref, activeSection, onNavigate }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleNavClick = (sectionId) => (e) => {
    e.preventDefault();
    onNavigate(sectionId);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-all">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5 lg:px-8">
        {/* Brand */}
        <Link to="/" className="shrink-0 focus-visible:outline-indigo-600">
          <BrandMark />
        </Link>

        {/* Desktop Nav Items */}
        <ul className="hidden items-center gap-1.5 text-sm font-medium text-slate-600 md:flex">
          {NAV_LINKS.map((link) => {
            const sectionId = link.href.slice(1);
            const isActive = activeSection === sectionId;
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={handleNavClick(sectionId)}
                  className={`rounded-lg px-3 py-1.5 transition-all duration-150 ${
                    isActive
                      ? 'bg-indigo-50 font-semibold text-indigo-600 shadow-xs'
                      : 'hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
          <li>
            <Link
              to="/verify"
              className="rounded-lg px-3 py-1.5 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Verify Certificate
            </Link>
          </li>
        </ul>

        {/* Right Action / Auth Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">{user?.name}</span>{' '}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                  {roleLabel(user?.role)}
                </span>
              </span>
              <Link
                to={areaHref}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 focus-visible:outline-indigo-600"
              >
                <span>Dashboard</span>
                <Icon name="arrow-right" className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-red-700 active:bg-red-800"
              >
                <Icon name="log-out" className="h-3.5 w-3.5" />
                <span>Log out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-indigo-700 hover:to-violet-700 hover:shadow"
              >
                <span>Get Started</span>
                <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="rounded-lg border border-slate-300 p-2 text-slate-700 transition-colors hover:bg-slate-100"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            <Icon name={mobileOpen ? 'x' : 'menu'} className="h-5 w-5" />
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 md:hidden">
          <ul className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            {NAV_LINKS.map((link) => {
              const sectionId = link.href.slice(1);
              const isActive = activeSection === sectionId;
              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={handleNavClick(sectionId)}
                    className={`block rounded-lg px-3 py-2 ${
                      isActive ? 'bg-indigo-50 font-semibold text-indigo-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
            <li>
              <Link
                to="/verify"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"
              >
                Verify Certificate
              </Link>
            </li>
            <li className="mt-3 border-t border-slate-100 pt-3">
              {isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-500">
                    Signed in as <span className="font-semibold text-slate-800">{user?.name}</span> ({roleLabel(user?.role)})
                  </p>
                  <Link
                    to={areaHref}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    Go to Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-700 active:bg-red-800"
                  >
                    <Icon name="log-out" className="h-4 w-4" />
                    <span>Log out</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
};

/**
 * Event card action helper.
 * Strictly respects authentication:
 *   - Anonymous users clicking "Register" are routed to /login with state.from = /user/events/:id
 *   - Authenticated USERs open /user/events/:id directly to register
 */
const getEventAction = ({ event, isAuthenticated, isRegistered }) => {
  const detailsHref = `/user/events/${event.id}`;
  if (!isAuthenticated) {
    return {
      label: 'Register',
      href: '/login',
      state: { from: detailsHref, intent: 'register' },
      isAuthRedirect: true,
    };
  }
  if (isRegistered) {
    return { label: 'Registered ✓', href: '/user/my-events', isSecondary: true };
  }
  if (event.capacity?.isFull) {
    return { label: 'Event Full', disabled: true };
  }
  if (event.status === 'CANCELLED') {
    return { label: 'Cancelled', disabled: true };
  }
  if (event.status === 'COMPLETED') {
    return { label: 'Event Ended', disabled: true };
  }
  if (!event.registration?.registrable) {
    return { label: 'Registration Closed', href: detailsHref };
  }
  return { label: 'Register Now', href: detailsHref };
};

/**
 * Real Event Card component
 */
const EventCard = ({ event, isAuthenticated, isRegistered }) => {
  const gradient = CATEGORY_GRADIENT[event.category] ?? CATEGORY_GRADIENT.OTHER;
  const categoryIcon = CATEGORY_ICON[event.category] ?? 'calendar-check';
  const accent = CATEGORY_ACCENT[event.category] ?? CATEGORY_ACCENT.OTHER;
  const action = getEventAction({ event, isAuthenticated, isRegistered });
  const detailsHref = `/user/events/${event.id}`;

  const hasCapacity = event.capacity?.max != null;
  const registeredCount = event.capacity?.registered ?? 0;
  const maxCapacity = event.capacity?.max;
  const spotsLeft = event.capacity?.spotsLeft;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg">
      {/* Banner / Category Fallback Artwork */}
      <Link
        to={detailsHref}
        className="relative block h-44 w-full shrink-0 overflow-hidden bg-slate-100"
        tabIndex={-1}
        aria-hidden="true"
      >
        {event.image ? (
          <img
            src={event.image}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={`relative flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} p-6 text-white`}>
            {/* Geometric watermark pattern */}
            <div
              className="pointer-events-none absolute inset-0 opacity-15"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '16px 16px',
              }}
            />
            <div className="relative flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner transition-transform duration-300 group-hover:scale-110">
                <Icon name={categoryIcon} className="h-7 w-7 text-white" />
              </span>
              <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-white/90">
                {EVENT_CATEGORY_LABEL[event.category] ?? event.category}
              </span>
            </div>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md shadow-xs ${accent.bg} ${accent.text} border ${accent.border}`}>
            {EVENT_CATEGORY_LABEL[event.category] ?? event.category}
          </span>
          <EventStatusBadge status={event.status} />
        </div>

        {/* Registration type pill if Team */}
        {event.registrationType === 'TEAM' && (
          <div className="absolute bottom-3 right-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
              <Icon name="users" className="h-3 w-3" />
              Team {event.maxTeamSize ? `(max ${event.maxTeamSize})` : ''}
            </span>
          </div>
        )}
      </Link>

      {/* Content Section */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
          <Link to={detailsHref} className="focus-visible:outline-indigo-600">
            {event.title}
          </Link>
        </h3>

        {event.description && (
          <p className="mt-2 line-clamp-2 text-xs text-slate-500 leading-relaxed">
            {event.description}
          </p>
        )}

        {/* Metadata Details */}
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Icon name="calendar" className="h-4 w-4 shrink-0 text-indigo-500" />
            <span className="font-medium text-slate-800">{formatDateDMY(event.startDate)}</span>
            {event.endDate && event.endDate !== event.startDate && (
              <span className="text-slate-500">to {formatDateDMY(event.endDate)}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Icon name="map-pin" className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate" title={event.venue}>
              {event.venue}
            </span>
          </div>

          {event.organiserName && (
            <div className="flex items-center gap-2 text-slate-500">
              <Icon name="user" className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">Organised by {event.organiserName}</span>
            </div>
          )}

          {hasCapacity && (
            <div className="flex items-center justify-between pt-1">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Icon name="users" className="h-3.5 w-3.5 text-slate-400" />
                Capacity
              </span>
              <span className="font-semibold text-slate-700">
                {registeredCount} / {maxCapacity} registered
              </span>
            </div>
          )}

          {hasCapacity && spotsLeft != null && spotsLeft <= 10 && spotsLeft > 0 && (
            <p className="text-[11px] font-semibold text-amber-600">
              🔥 Only {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} remaining!
            </p>
          )}
        </div>

        {/* Card Actions */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <Link
            to={detailsHref}
            className="text-xs font-semibold text-slate-600 transition-colors hover:text-indigo-600"
          >
            View Details
          </Link>

          {action.disabled ? (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-400"
            >
              {action.label}
            </button>
          ) : action.isSecondary ? (
            <Link
              to={action.href}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              {action.label}
            </Link>
          ) : (
            <Link
              to={action.href}
              state={action.state}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-indigo-700 hover:shadow-sm focus-visible:outline-indigo-600"
            >
              <span>{action.label}</span>
              <Icon name="arrow-right" className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
};

/**
 * Featured Hero Spotlight component rendering genuine data from the database
 */
const HeroEventSpotlight = ({ featuredEvent, isAuthenticated }) => {
  if (!featuredEvent) {
    return (
      <div className="relative mx-auto w-full max-w-md">
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
              <Icon name="sparkles" className="h-3.5 w-3.5" />
              EventFlow Platform
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
              Live Ready
            </span>
          </div>

          <h3 className="mt-4 text-xl font-bold text-slate-900">
            Intelligent Event Operations
          </h3>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            One cohesive system connecting planning workspaces, self-service ticketing, QR attendance, and AI-grounded insights.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Icon name="qr-code" className="h-4 w-4 text-indigo-600" />
                QR Attendance
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">Instant Check-in</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Icon name="award" className="h-4 w-4 text-emerald-600" />
                Certificates
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">Verifiable Code</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 p-3.5 text-xs text-violet-900">
            <p className="flex items-center gap-1.5 font-semibold text-violet-800">
              <Icon name="sparkles" className="h-3.5 w-3.5 text-violet-600" />
              AI Intelligence
            </p>
            <p className="mt-1 text-violet-700">
              Data-grounded analytics and recommendations to improve future event editions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const gradient = CATEGORY_GRADIENT[featuredEvent.category] ?? CATEGORY_GRADIENT.OTHER;
  const categoryIcon = CATEGORY_ICON[featuredEvent.category] ?? 'calendar-check';
  const detailsHref = `/user/events/${featuredEvent.id}`;

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Glow highlight behind card */}
      <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-tr from-indigo-500/20 via-violet-500/20 to-sky-500/20 blur-xl" />

      <div className="relative rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition-all">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
            <Icon name="sparkles" className="h-3.5 w-3.5 text-indigo-600" />
            Featured Event Spotlight
          </span>
          <EventStatusBadge status={featuredEvent.status} />
        </div>

        {/* Visual Banner or Pattern */}
        <div className="mt-4 overflow-hidden rounded-2xl bg-slate-100">
          {featuredEvent.image ? (
            <img
              src={featuredEvent.image}
              alt={featuredEvent.title}
              className="h-32 w-full object-cover"
            />
          ) : (
            <div className={`flex h-28 w-full items-center justify-center bg-gradient-to-r ${gradient} text-white p-4`}>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
                  <Icon name={categoryIcon} className="h-6 w-6 text-white" />
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/80 font-semibold">
                    {EVENT_CATEGORY_LABEL[featuredEvent.category] ?? featuredEvent.category}
                  </p>
                  <p className="text-sm font-bold text-white line-clamp-1">{featuredEvent.title}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Title and Info */}
        <h3 className="mt-4 text-lg font-bold text-slate-900 line-clamp-2">
          <Link to={detailsHref} className="hover:text-indigo-600 transition-colors">
            {featuredEvent.title}
          </Link>
        </h3>

        <div className="mt-3 space-y-1.5 text-xs text-slate-600">
          <p className="flex items-center gap-2">
            <Icon name="calendar" className="h-4 w-4 text-indigo-600" />
            <span className="font-semibold text-slate-800">{formatDateDMY(featuredEvent.startDate)}</span>
            {featuredEvent.endDate && ` – ${formatDateDMY(featuredEvent.endDate)}`}
          </p>
          <p className="flex items-center gap-2">
            <Icon name="map-pin" className="h-4 w-4 text-slate-400" />
            <span className="truncate">{featuredEvent.venue}</span>
          </p>
        </div>

        {/* Real Stats Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] font-medium text-slate-500">Registered</p>
            <p className="mt-0.5 text-base font-bold text-indigo-600">
              {featuredEvent.capacity?.registered ?? 0}
              {featuredEvent.capacity?.max ? ` / ${featuredEvent.capacity.max}` : ' attendees'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[11px] font-medium text-slate-500">Type</p>
            <p className="mt-0.5 text-base font-bold text-slate-800">
              {featuredEvent.registrationType === 'TEAM' ? 'Team' : 'Individual'}
            </p>
          </div>
        </div>

        {/* Action Link */}
        <div className="mt-5">
          <Link
            to={detailsHref}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-center text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700"
          >
            <span>View Event &amp; Register</span>
            <Icon name="arrow-right" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

/**
 * Main HomePage Component
 */
const HomePage = () => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((s) => s.user);
  const areaHref = isAuthenticated ? roleHomePath(user.role) : '/register';

  // Events & Search filter state
  const [events, setEvents] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [registeredEventIds, setRegisteredEventIds] = useState(() => new Set());

  // Scroll spy
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
    }, 800);
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, []);

  // IntersectionObserver for scroll-spy
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
      { rootMargin: '-90px 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => {
      observer.disconnect();
      if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
    };
  }, []);

  // Fetch real events from database (supports search, category, and limit)
  useEffect(() => {
    let active = true;
    setLoadState('loading');

    const params = { limit: 12 };
    if (searchQuery.trim()) params.search = searchQuery.trim();
    if (selectedCategory) params.category = selectedCategory;

    participantService
      .getFeaturedEvents(params)
      .then((data) => {
        if (!active) return;
        setEvents(Array.isArray(data) ? data : []);
        setLoadState('ready');
      })
      .catch(() => {
        if (!active) return;
        setLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [searchQuery, selectedCategory, reloadKey]);

  // If signed in as USER, cross-reference my own registrations
  useEffect(() => {
    if (!isAuthenticated || user?.role !== ROLES.USER) {
      setRegisteredEventIds(new Set());
      return undefined;
    }
    let active = true;
    participantService
      .getMyRegistrations({ status: 'REGISTERED' })
      .then((regs) => {
        if (!active) return;
        if (Array.isArray(regs)) {
          setRegisteredEventIds(new Set(regs.map((r) => r.event?.id || r.event)));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.role]);

  // Featured event for hero spotlight (first event in list if available)
  const spotlightEvent = useMemo(() => {
    if (events.length > 0) return events[0];
    return null;
  }, [events]);

  const handleHeroSearch = (e) => {
    e.preventDefault();
    navigateToSection('events');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* ------------------------------------------------ Cinematic Opening */}
      <CinematicIntro />

      {/* ------------------------------------------------ Navigation Header */}
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        user={user}
        areaHref={areaHref}
        activeSection={activeSection}
        onNavigate={navigateToSection}
      />

      {/* ----------------------------------------------------- Hero Section */}
      <section
        id="home"
        className="relative scroll-mt-20 overflow-hidden border-b border-slate-200/60 bg-gradient-to-b from-white via-indigo-50/20 to-slate-50/50 px-6 pt-16 pb-20 lg:px-10 lg:pt-24 lg:pb-28"
      >
        {/* Ambient background glows */}
        <div
          className="pointer-events-none absolute -top-40 right-1/4 -z-10 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-1/4 -z-10 h-96 w-96 rounded-full bg-violet-400/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left Column: Headline, Description, Search, CTAs */}
            <div className="lg:col-span-7">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-xs backdrop-blur-sm">
                <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                <span>Next-Gen Event Management Platform</span>
              </div>

              {/* Headline */}
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                Plan better events.{' '}
                <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 bg-clip-text text-transparent">
                  Run them smoothly.
                </span>{' '}
                Improve every time.
              </h1>

              {/* Subheading */}
              <p className="mt-5 max-w-2xl text-base text-slate-600 sm:text-lg leading-relaxed">
                EventFlow connects organisers and participants in one cohesive workspace — from
                structured pre-event planning and 1-click registration to instant QR check-in,
                verifiable digital certificates, and AI-grounded improvements.
              </p>

              {/* Signed-in pill banner if user is logged in */}
              {isAuthenticated && (
                <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/90 px-4 py-3 text-xs text-indigo-900 shadow-xs sm:text-sm">
                  <Icon name="check-circle" className="h-4 w-4 shrink-0 text-indigo-600" />
                  <span>
                    Welcome back, <strong className="font-semibold">{user?.name}</strong>! Access your{' '}
                    <Link to={areaHref} className="underline font-bold hover:text-indigo-700">
                      {roleLabel(user?.role)} Dashboard &rarr;
                    </Link>
                  </span>
                </div>
              )}

              {/* Integrated Hero Event Search */}
              <form onSubmit={handleHeroSearch} className="mt-8 max-w-xl">
                <div className="flex flex-col gap-2 rounded-2xl border border-slate-300/80 bg-white p-2 shadow-md sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center gap-2.5 px-3">
                    <Icon name="search" className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search events by title or venue..."
                      className="w-full border-none bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 focus-visible:outline-indigo-600"
                  >
                    <span>Find Events</span>
                    <Icon name="arrow-right" className="h-4 w-4" />
                  </button>
                </div>

                {/* Popular category chips */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-medium text-slate-400">Popular:</span>
                  {['WORKSHOP', 'CONFERENCE', 'HACKATHON', 'SEMINAR'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(selectedCategory === cat ? '' : cat);
                        navigateToSection('events');
                      }}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        selectedCategory === cat
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200/60 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {EVENT_CATEGORY_LABEL[cat]}
                    </button>
                  ))}
                </div>
              </form>

              {/* Primary Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#events"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToSection('events');
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-slate-800 focus-visible:outline-slate-900"
                >
                  <Icon name="calendar-check" className="h-4 w-4" />
                  <span>Explore Featured Events</span>
                </a>

                <Link
                  to={isAuthenticated ? areaHref : '/register'}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-indigo-600"
                >
                  <span>{isAuthenticated ? 'Open Dashboard' : 'Host an Event'}</span>
                  <Icon name="arrow-right" className="h-4 w-4" />
                </Link>

                <Link
                  to="/verify"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
                >
                  <Icon name="award" className="h-4 w-4 text-emerald-600" />
                  <span>Verify Certificate</span>
                </Link>
              </div>

              {/* Feature pillars summary */}
              <div className="mt-8 border-t border-slate-200/80 pt-5">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Icon name="clipboard-check" className="h-4 w-4 text-indigo-500" />
                    Planning Workspace
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="qr-code" className="h-4 w-4 text-violet-500" />
                    QR Fast Check-in
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="award" className="h-4 w-4 text-emerald-500" />
                    Verifiable Credentials
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="sparkles" className="h-4 w-4 text-amber-500" />
                    AI Improvement Insights
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Spotlight Card */}
            <div className="lg:col-span-5">
              <HeroEventSpotlight
                featuredEvent={spotlightEvent}
                isAuthenticated={isAuthenticated}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------- Featured & Upcoming Events Section */}
      <section id="events" className="scroll-mt-20 px-6 py-20 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Discover &amp; Participate
              </span>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Featured &amp; Upcoming Events
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
                Explore real upcoming workshops, hackathons, and conferences directly from the
                database. Select any event to register or learn more.
              </p>
            </div>

            {/* Discovery count and full browse link */}
            <div className="flex shrink-0 items-center gap-3">
              <Link
                to="/user/events"
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <span>Browse All Events</span>
                <Icon name="arrow-right" className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Interactive Search & Filter Toolbar */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    selectedCategory === ''
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  All Categories
                </button>
                {EVENT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {EVENT_CATEGORY_LABEL[cat]}
                  </button>
                ))}
              </div>

              {/* Search filter input */}
              <div className="relative min-w-[220px]">
                <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter events..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pr-8 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Active filter summary if any */}
            {(searchQuery || selectedCategory) && (
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>
                  Showing results for {selectedCategory ? `category "${EVENT_CATEGORY_LABEL[selectedCategory]}"` : 'all categories'}
                  {searchQuery ? ` matching "${searchQuery}"` : ''}
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>

          {/* Events Grid / States */}
          <div className="mt-8">
            {/* Loading Skeleton */}
            {loadState === 'loading' && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div
                    key={i}
                    className="flex h-96 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="h-44 w-full animate-pulse rounded-xl bg-slate-200" />
                    <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-slate-200" />
                    <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                    <div className="mt-auto space-y-2 border-t border-slate-100 pt-4">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                      <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error State with Retry Button */}
            {loadState === 'error' && (
              <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                  <Icon name="alert-triangle" className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Unable to connect to the Event API
                </h3>
                <p className="mx-auto mt-2 max-w-md text-xs text-slate-600 leading-relaxed">
                  The backend service may be starting or temporarily unreachable. Please verify your connection or click retry below.
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700"
                  >
                    <Icon name="refresh-cw" className="h-3.5 w-3.5" />
                    <span>Retry Request</span>
                  </button>
                </div>
              </div>
            )}

            {/* Empty State when no events exist or match filters */}
            {loadState === 'ready' && events.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Icon name="calendar" className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">No events found</h3>
                <p className="mx-auto mt-2 max-w-md text-xs text-slate-500 leading-relaxed">
                  {searchQuery || selectedCategory
                    ? 'No events match your current search or category filter. Try clearing filters to see all available events.'
                    : 'There are currently no upcoming published events in the system. Organisers can create and publish events from their dashboard.'}
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  {searchQuery || selectedCategory ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Clear Filters
                    </button>
                  ) : (
                    <Link
                      to={isAuthenticated ? areaHref : '/register'}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700"
                    >
                      <span>Create an Event</span>
                      <Icon name="arrow-right" className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Real Events List */}
            {loadState === 'ready' && events.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {events.map((event) => (
                  <EventCard
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

      {/* --------------------------------------------- Platform Features Section */}
      <section
        id="features"
        className="scroll-mt-20 border-t border-slate-200/80 bg-white py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Platform Architecture
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Everything needed to run successful events
            </h2>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              EventFlow is built with production-grade capabilities for end-to-end event
              management — no external spreadsheets or disjointed tools required.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-7 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                      <Icon name={feature.icon} className="h-6 w-6" />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {feature.tag}
                    </span>
                  </div>

                  <h3 className="mt-5 text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                  <span>Learn workflow</span>
                  <Icon name="arrow-right" className="h-3 w-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------- How It Works / Journey Section */}
      <section
        id="how-it-works"
        className="scroll-mt-20 border-t border-slate-200/80 bg-slate-50/70 py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Seamless Experience
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              How EventFlow Works
            </h2>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              From discovering an upcoming tech summit to scanning your QR credential and
              claiming your verified digital certificate.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {PARTICIPANT_JOURNEY.map((step, idx) => (
              <div
                key={step.title}
                className="relative flex flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs transition-all hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-indigo-600/30">{step.step}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Icon name={step.icon} className="h-4 w-4" />
                  </span>
                </div>

                <h3 className="mt-4 text-sm font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">{step.description}</p>

                {/* Connector indicator for desktop */}
                {idx < PARTICIPANT_JOURNEY.length - 1 && (
                  <div
                    className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 lg:block text-slate-300"
                    aria-hidden="true"
                  >
                    <Icon name="arrow-right" className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Organiser journey callout bar */}
          <div className="mt-12 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-violet-50 p-6 sm:p-8">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">
                  <Icon name="calendar-check" className="h-3.5 w-3.5" />
                  Organiser Workflow
                </span>
                <h3 className="mt-3 text-lg font-bold text-slate-900 sm:text-xl">
                  Are you managing a conference, hackathon, or seminar?
                </h3>
                <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                  Coordinate pre-event tasks, budgets, team roles, real-time QR attendance, and AI-powered improvement advice in one dashboard.
                </p>
              </div>

              <Link
                to={isAuthenticated ? areaHref : '/register'}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700"
              >
                <span>{isAuthenticated ? 'Organiser Console' : 'Register as Organiser'}</span>
                <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------- Built for Every Role Section */}
      <section id="roles" className="scroll-mt-20 border-t border-slate-200/80 bg-white py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Role-Based Architecture
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Designed for every stakeholder
            </h2>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Strict role-based permissions ensure participants, organisers, and administrators
              get dedicated, secure workspaces tailored to their responsibilities.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {USER_ROLES.map((role) => {
              const style = ROLE_STYLES[role.tone];
              return (
                <div
                  key={role.role}
                  className={`flex flex-col justify-between rounded-3xl border ${style.border} ${style.bg} p-8 shadow-xs transition-all hover:shadow-md`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${style.iconBg} shadow-sm`}>
                        <Icon name={role.icon} className="h-6 w-6" />
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${style.badgeBg}`}>
                        {role.badge}
                      </span>
                    </div>

                    <h3 className="mt-6 text-xl font-bold text-slate-900">{role.headline}</h3>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">{role.description}</p>

                    <ul className="mt-6 space-y-2.5 border-t border-slate-200/60 pt-5 text-xs text-slate-700">
                      {role.features.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <Icon name="check-circle" className={`h-4 w-4 shrink-0 ${style.highlight}`} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 pt-4">
                    {role.ctaTarget.startsWith('#') ? (
                      <a
                        href={role.ctaTarget}
                        onClick={(e) => {
                          e.preventDefault();
                          navigateToSection(role.ctaTarget.slice(1));
                        }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5 text-center text-xs font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-50"
                      >
                        <span>{role.ctaLabel}</span>
                        <Icon name="arrow-right" className="h-3 w-3" />
                      </a>
                    ) : (
                      <Link
                        to={role.ctaTarget}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5 text-center text-xs font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-50"
                      >
                        <span>{role.ctaLabel}</span>
                        <Icon name="arrow-right" className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Bottom CTA Banner */}
      <section className="relative overflow-hidden bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-700 py-16 text-white sm:py-20">
        {/* Decorative backdrop shapes */}
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Ready to experience frictionless event management?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-indigo-100 sm:text-base leading-relaxed">
            Join attendees discovering premier technology workshops and organisers executing
            unforgettable events with EventFlow.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link
                to={areaHref}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-indigo-700 shadow-lg transition-colors hover:bg-indigo-50"
              >
                <span>Go to Your Workspace</span>
                <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-indigo-700 shadow-lg transition-colors hover:bg-indigo-50"
                >
                  <span>Create Free Account</span>
                  <Icon name="arrow-right" className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  <span>Sign In</span>
                </Link>
              </>
            )}
            <Link
              to="/verify"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-transparent px-5 py-3.5 text-xs font-semibold text-indigo-100 hover:text-white hover:border-white/50 transition-colors"
            >
              <Icon name="award" className="h-4 w-4" />
              <span>Verify Certificate</span>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};

export default HomePage;
