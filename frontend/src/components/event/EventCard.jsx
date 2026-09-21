import { Link } from 'react-router-dom';

import EventStatusBadge from '../EventStatusBadge.jsx';
import RegistrationStatusBadge from './RegistrationStatusBadge.jsx';
import Icon from '../ui/Icon.jsx';
import { EVENT_CATEGORY_LABEL, formatDateTime } from '../../utils/eventMeta.js';

/**
 * Participant-facing event card (Phase 6). Shows only public information —
 * never organiser planning, budget, resources, team or AI data.
 */
const EventCard = ({ event }) => {
  const myStatus = event.myRegistration?.status;
  const closed = !event.registration?.registrable;

  return (
    <article className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-base font-semibold text-slate-900">{event.title}</h3>
        <EventStatusBadge status={event.status} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-600">
          {EVENT_CATEGORY_LABEL[event.category] ?? event.category}
        </span>
        {event.registrationType === 'TEAM' && (
          <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
            Team Event
          </span>
        )}
        {myStatus === 'REGISTERED' && <RegistrationStatusBadge status="REGISTERED" />}
        {myStatus !== 'REGISTERED' && closed && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
            Registration closed
          </span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{event.description}</p>

      <dl className="mt-3 space-y-1 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <dt className="flex w-14 shrink-0 items-center gap-1 text-slate-400">
            <Icon name="clock" className="h-3.5 w-3.5" />
            When
          </dt>
          <dd>
            {formatDateTime(event.startDate)}
            {event.endDate ? ` — ${formatDateTime(event.endDate)}` : ''}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="flex w-14 shrink-0 items-center gap-1 text-slate-400">
            <Icon name="map-pin" className="h-3.5 w-3.5" />
            Where
          </dt>
          <dd>{event.venue}</dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between pt-4">
        {event.capacity?.max != null ? (
          <span className="text-xs text-slate-400">
            {event.capacity.isFull ? 'Full' : `${event.capacity.spotsLeft} of ${event.capacity.max} spots left`}
          </span>
        ) : (
          <span />
        )}
        <Link
          to={`/user/events/${event.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          View details
          <Icon name="arrow-right" className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
};

export default EventCard;
