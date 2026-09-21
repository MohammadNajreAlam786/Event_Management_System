import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import participantService from '../../services/participantService.js';
import certificateService from '../../services/certificateService.js';
import StatCard from '../../components/StatCard.jsx';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Icon from '../../components/ui/Icon.jsx';
import SettingsShortcuts from '../../components/profile/SettingsShortcuts.jsx';
import useAuthStore from '../../store/useAuthStore.js';
import { CATEGORY_GRADIENT, EVENT_CATEGORY_LABEL, formatDate, formatDateTime } from '../../utils/eventMeta.js';

const UPCOMING_STATUSES = ['UPCOMING', 'ONGOING'];

const QUICK_ACTIONS = [
  { to: '/user/events', label: 'Explore Events', description: 'Find events to register for', icon: 'search' },
  { to: '/user/my-events', label: 'My Events', description: 'Registrations and attendance', icon: 'calendar-check' },
  { to: '/user/certificates', label: 'Certificates', description: 'View and download certificates', icon: 'award' },
  { to: '/user/feedback', label: 'Give Feedback', description: 'Share feedback on attended events', icon: 'message-square' },
  { to: '/user/profile', label: 'Profile', description: 'View and edit your profile', icon: 'user-circle' },
  { to: '/user/settings', label: 'Settings', description: 'Account and preferences', icon: 'settings' },
];

/** A decorative category-gradient banner — no image dependency (Phase 14). */
const EventBanner = ({ category }) => (
  <div
    className={`flex h-20 shrink-0 items-center justify-center bg-gradient-to-br ${CATEGORY_GRADIENT[category] ?? CATEGORY_GRADIENT.OTHER}`}
  >
    <Icon name="calendar-check" className="h-7 w-7 text-white/90" />
  </div>
);

/** One of "Your Upcoming Events" — real registration + event data only. */
const UpcomingEventCard = ({ registration }) => {
  const { event, team } = registration;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      <EventBanner category={event.category} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {EVENT_CATEGORY_LABEL[event.category] ?? event.category}
          </span>
          <EventStatusBadge status={event.status} />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            {team ? 'Team' : 'Individual'}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">{event.title}</p>
        <div className="mt-2 space-y-1 text-xs text-slate-500">
          <p className="flex items-center gap-1.5">
            <Icon name="calendar" className="h-3.5 w-3.5 shrink-0" />
            {formatDateTime(event.startDate)}
          </p>
          <p className="flex items-center gap-1.5">
            <Icon name="map-pin" className="h-3.5 w-3.5 shrink-0" />
            {event.venue}
          </p>
          {team && (
            <p className="flex items-center gap-1.5">
              <Icon name="users" className="h-3.5 w-3.5 shrink-0" />
              Team: {team.name}
            </p>
          )}
        </div>
        <div className="mt-3 pt-1">
          <Link
            to={`/user/events/${event.id}`}
            className="inline-flex rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            View Event
          </Link>
        </div>
      </div>
    </div>
  );
};

/** One of "Discover Events" — a compact card for an event the participant hasn't registered for. */
const DiscoverEventCard = ({ event }) => (
  <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]">
    <EventBanner category={event.category} />
    <div className="flex flex-1 flex-col p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {EVENT_CATEGORY_LABEL[event.category] ?? event.category}
        </span>
        <EventStatusBadge status={event.status} />
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900">{event.title}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
        <Icon name="calendar" className="h-3.5 w-3.5 shrink-0" />
        {formatDateTime(event.startDate)}
      </p>
      <div className="mt-3 pt-1">
        <Link
          to={`/user/events/${event.id}`}
          className="inline-flex rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
        >
          View Details
        </Link>
      </div>
    </div>
  </div>
);

/** /user — the redesigned participant dashboard (Phase 14). Every figure and card below comes from a real API call — nothing is invented. */
const UserDashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [discoverEvents, setDiscoverEvents] = useState([]);
  const [certificates, setCertificates] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      participantService.getMyRegistrations(),
      participantService.getEvents({ upcoming: true, limit: 8 }),
      certificateService.getMine().catch(() => []),
    ])
      .then(([regs, disc, certs]) => {
        if (!active) return;
        setRegistrations(regs);
        setDiscoverEvents(disc.events);
        setCertificates(certs);
        setState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Unable to load your dashboard. Please try again.');
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (state === 'error') {
    return <ErrorBanner message={error} />;
  }

  const loading = state === 'loading';
  const active = registrations.filter((r) => r.status === 'REGISTERED' && !r.event.isDeleted);
  const upcoming = active
    .filter((r) => UPCOMING_STATUSES.includes(r.event.status))
    .sort((a, b) => new Date(a.event.startDate) - new Date(b.event.startDate));
  const attended = registrations.filter((r) => r.attendance?.status === 'PRESENT');
  const registeredIds = new Set(active.map((r) => r.event.id));
  const discover = discoverEvents.filter((e) => !registeredIds.has(e.id)).slice(0, 4);

  // Recent participation (§25) — only real, already-fetched facts; never invented.
  const mostRecentRegistration = [...registrations].sort(
    (a, b) => new Date(b.registeredAt) - new Date(a.registeredAt),
  )[0];
  const mostRecentAttended = [...attended].sort(
    (a, b) => new Date(b.attendance.checkedInAt) - new Date(a.attendance.checkedInAt),
  )[0];
  const mostRecentCertificate = [...certificates].sort(
    (a, b) => new Date(b.issueDate) - new Date(a.issueDate),
  )[0];
  const hasRecentActivity = mostRecentRegistration || mostRecentAttended || mostRecentCertificate;

  return (
    <section className="space-y-8">
      {/* ------------------------------------------------------------- Hero */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6">
        <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name} 👋</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Discover events, manage your registrations, track your participation and collect certificates.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/user/events"
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <Icon name="search" className="h-4 w-4" />
            Explore Events
          </Link>
          <Link
            to="/user/my-events"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            View My Events
          </Link>
        </div>
      </div>

      {/* --------------------------------------------------- Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Registered Events" value={active.length} loading={loading} accent="indigo" icon="calendar-check" />
        <StatCard label="Upcoming" value={upcoming.length} loading={loading} accent="amber" icon="clock" />
        <StatCard label="Attended" value={attended.length} loading={loading} accent="emerald" icon="check-circle" />
        <StatCard
          label="Certificates"
          value={certificates.length}
          loading={loading}
          accent="violet"
          icon="award"
          hint={!loading && certificates.length === 0 ? 'Earned after eligible attendance' : undefined}
        />
      </div>

      {/* ----------------------------------------------- Your Upcoming Events */}
      <div>
        <div className="flex items-center justify-between">
          <SectionHeader icon="calendar-check" title="Your Upcoming Events" />
          <Link to="/user/my-events" className="text-xs font-medium text-indigo-600 hover:underline">
            All my events →
          </Link>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="h-44 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="text-sm text-slate-600">
                {active.length === 0
                  ? "You haven't registered for any events yet."
                  : 'You have no upcoming registered events.'}
              </p>
              {active.length === 0 && (
                <>
                  <p className="mt-1 text-sm text-slate-500">Discover an event and join your next experience.</p>
                  <Link
                    to="/user/events"
                    className="mt-4 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Explore Events
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {upcoming.slice(0, 4).map((r) => (
                <UpcomingEventCard key={r.id} registration={r} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --------------------------------------------------- Discover Events */}
      <div>
        <div className="flex items-center justify-between">
          <SectionHeader icon="sparkles" title="Discover Events" />
          <Link to="/user/events" className="text-xs font-medium text-indigo-600 hover:underline">
            Explore All Events →
          </Link>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              ))}
            </div>
          ) : discover.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming events are currently available.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {discover.map((ev) => (
                <DiscoverEventCard key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ Recent Participation */}
      {!loading && hasRecentActivity && (
        <div>
          <SectionHeader icon="clock" title="Recent Participation" />
          <ul className="mt-3 space-y-2">
            {mostRecentAttended && (
              <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <Icon name="check-circle" className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  Attended <span className="font-medium">{mostRecentAttended.event.title}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatDateTime(mostRecentAttended.attendance.checkedInAt)}
                </span>
              </li>
            )}
            {mostRecentCertificate && (
              <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <Icon name="award" className="h-4 w-4 shrink-0 text-violet-500" />
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  Certificate earned for <span className="font-medium">{mostRecentCertificate.eventTitle}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">{formatDate(mostRecentCertificate.issueDate)}</span>
              </li>
            )}
            {mostRecentRegistration && (
              <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <Icon name="calendar-plus" className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  Registered for <span className="font-medium">{mostRecentRegistration.event.title}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatDate(mostRecentRegistration.registeredAt)}
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* --------------------------------------------------------- Quick Actions */}
      <div>
        <SectionHeader icon="clipboard-list" title="Quick Actions" />
        <div className="mt-3">
          <SettingsShortcuts items={QUICK_ACTIONS} />
        </div>
      </div>
    </section>
  );
};

export default UserDashboard;
