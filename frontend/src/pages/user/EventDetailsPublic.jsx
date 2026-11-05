import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import participantService from '../../services/participantService.js';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import RegistrationPanel from '../../components/event/RegistrationPanel.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import Icon from '../../components/ui/Icon.jsx';
import {
  EVENT_CATEGORY_LABEL,
  CATEGORY_GRADIENT,
  CATEGORY_ICON,
  formatDateTime,
} from '../../utils/eventMeta.js';

const Row = ({ label, icon, children }) => (
  <div>
    <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {label}
    </dt>
    <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
  </div>
);

/**
 * /user/events/:id — participant-facing public event details + registration.
 * Features a prominent 16:9 hero banner with title, date, venue, and status overlay.
 */
const EventDetailsPublic = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    participantService
      .getEvent(id)
      .then((data) => {
        if (!active) return;
        setEvent(data);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(
          err.status === 404
            ? 'This event is not available. It may have been removed or is not open to participants.'
            : err.message || 'Unable to load this event. Please try again.',
        );
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [id, navigate]);

  if (loadState === 'loading') {
    return (
      <div className="space-y-5">
        <div className="aspect-[16/9] max-h-[420px] w-full animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error} />
        <Link to="/user/events" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline">
          <Icon name="arrow-left" className="h-4 w-4" />
          Back to Browse Events
        </Link>
      </div>
    );
  }

  const hasBanner = Boolean(event.image && event.image.trim());

  return (
    <section className="space-y-6 pb-12">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/user/events"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-indigo-600"
        >
          <Icon name="arrow-left" className="h-3.5 w-3.5" />
          Back to browse events
        </Link>
      </div>

      {/* Prominent Responsive 16:9 Hero Banner */}
      <div className="relative aspect-[16/9] max-h-[460px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-md">
        {hasBanner ? (
          <img
            src={event.image}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-r ${CATEGORY_GRADIENT[event.category] || CATEGORY_GRADIENT.OTHER
              } p-8`}
          >
            <Icon name={CATEGORY_ICON[event.category] || 'calendar'} className="h-24 w-24 text-white/20" />
          </div>
        )}

        {/* Ambient Gradient Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-black/30" />

        {/* Hero Content Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-indigo-600/90 px-3 py-1 text-xs font-bold text-white shadow backdrop-blur-md">
              {EVENT_CATEGORY_LABEL[event.category] ?? event.category}
            </span>
            {event.registrationType === 'TEAM' && (
              <span className="rounded-md bg-violet-600/90 px-3 py-1 text-xs font-bold text-white shadow backdrop-blur-md">
                Team Event (max {event.maxTeamSize || 4})
              </span>
            )}
            <EventStatusBadge status={event.status} />
          </div>

          <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
            {event.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-200 sm:text-sm">
            <div className="flex items-center gap-1.5 font-medium">
              <Icon name="calendar" className="h-4 w-4 text-indigo-400" />
              <span>{formatDateTime(event.startDate)}</span>
              {event.endDate && <span>— {formatDateTime(event.endDate)}</span>}
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <Icon name="map-pin" className="h-4 w-4 text-rose-400" />
              <span>{event.venue}</span>
            </div>
            {event.organiserName && (
              <div className="flex items-center gap-1.5 font-medium">
                <Icon name="user" className="h-4 w-4 text-emerald-400" />
                <span>Organized by {event.organiserName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Details & Registration Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Detailed Info Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">About this Event</h2>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {event.description}
            </div>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Event Details &amp; Logistics</h3>
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Row label="Category" icon="layers">
                  {EVENT_CATEGORY_LABEL[event.category] ?? event.category}
                </Row>
                <Row label="Venue / Location" icon="map-pin">
                  {event.venue}
                </Row>
                <Row label="Starts" icon="calendar">
                  {formatDateTime(event.startDate)}
                </Row>
                <Row label="Ends" icon="calendar">
                  {formatDateTime(event.endDate)}
                </Row>
                {(event.registrationStartDate || event.registrationEndDate) && (
                  <div className="sm:col-span-2">
                    <Row label="Registration window" icon="clock">
                      {formatDateTime(event.registrationStartDate)} — {formatDateTime(event.registrationEndDate)}
                    </Row>
                  </div>
                )}
                {event.organiserName && (
                  <Row label="Organised by" icon="user">
                    {event.organiserName}
                  </Row>
                )}
                {event.capacity?.max != null && (
                  <Row label="Capacity" icon="users">
                    {event.capacity.isFull
                      ? `Full (${event.capacity.max})`
                      : `${event.capacity.spotsLeft} of ${event.capacity.max} spots left`}
                  </Row>
                )}
                <Row label="Registration Format" icon="clipboard-list">
                  {event.registrationType === 'TEAM'
                    ? `Team Registration (maximum ${event.maxTeamSize || 4} members)`
                    : 'Individual Registration'}
                </Row>
              </dl>
            </div>
          </div>
        </div>

        {/* Sticky Registration Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <RegistrationPanel event={event} onChanged={setEvent} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default EventDetailsPublic;
