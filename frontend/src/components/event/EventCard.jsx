import { Link } from 'react-router-dom';

import EventStatusBadge from '../EventStatusBadge.jsx';
import RegistrationStatusBadge from './RegistrationStatusBadge.jsx';
import Icon from '../ui/Icon.jsx';
import {
  EVENT_CATEGORY_LABEL,
  CATEGORY_GRADIENT,
  CATEGORY_ICON,
  formatDateTime,
} from '../../utils/eventMeta.js';

/**
 * Participant-facing event card (Phase 6 & 15).
 * Renders the saved 16:9 topic banner image prominently with elegant fallback.
 */
const EventCard = ({ event }) => {
  const myStatus = event.myRegistration?.status;
  const closed = !event.registration?.registrable;
  const hasBanner = Boolean(event.image && event.image.trim());

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)]">
      {/* 16:9 Banner Header */}
      <Link to={`/user/events/${event.id}`} className="relative block aspect-[16/9] w-full overflow-hidden bg-slate-900">
        {hasBanner ? (
          <img
            src={event.image}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-r ${CATEGORY_GRADIENT[event.category] || CATEGORY_GRADIENT.OTHER
              } p-4`}
          >
            <Icon name={CATEGORY_ICON[event.category] || 'calendar'} className="h-10 w-10 text-white/30" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20" />

        <div className="absolute top-2.5 right-2.5">
          <EventStatusBadge status={event.status} />
        </div>

        <div className="absolute bottom-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
            {EVENT_CATEGORY_LABEL[event.category] ?? event.category}
          </span>
          {event.registrationType === 'TEAM' && (
            <span className="rounded-md bg-violet-600/80 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
              Team Event
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 text-base font-semibold text-slate-900 transition-colors group-hover:text-indigo-600">
            <Link to={`/user/events/${event.id}`} className="hover:underline">
              {event.title}
            </Link>
          </h3>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {myStatus === 'REGISTERED' && <RegistrationStatusBadge status="REGISTERED" />}
          {myStatus !== 'REGISTERED' && closed && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
              Registration closed
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{event.description}</p>

        <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <dt className="flex w-14 shrink-0 items-center gap-1 text-slate-400">
              <Icon name="clock" className="h-3.5 w-3.5" />
              When
            </dt>
            <dd className="truncate text-xs text-slate-700">
              {formatDateTime(event.startDate)}
              {event.endDate ? ` — ${formatDateTime(event.endDate)}` : ''}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="flex w-14 shrink-0 items-center gap-1 text-slate-400">
              <Icon name="map-pin" className="h-3.5 w-3.5" />
              Where
            </dt>
            <dd className="truncate text-xs text-slate-700">{event.venue}</dd>
          </div>
        </dl>

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
          {event.capacity?.max != null ? (
            <span className="text-xs text-slate-400">
              {event.capacity.isFull ? 'Full' : `${event.capacity.spotsLeft} of ${event.capacity.max} spots left`}
            </span>
          ) : (
            <span className="text-xs text-slate-400">Open registration</span>
          )}
          <Link
            to={`/user/events/${event.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            View details
            <Icon name="arrow-right" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
};

export default EventCard;
