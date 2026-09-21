import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import participantService from '../../services/participantService.js';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import RegistrationPanel from '../../components/event/RegistrationPanel.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EVENT_CATEGORY_LABEL, formatDateTime } from '../../utils/eventMeta.js';

const Row = ({ label, icon, children }) => (
  <div>
    <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {label}
    </dt>
    <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
  </div>
);

/** /user/events/:id — participant-facing event details + registration. */
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
    return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;
  }
  if (loadState === 'error') {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Link to="/user/events" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to Browse Events
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <Link to="/user/events" className="text-xs font-medium text-indigo-600 hover:underline">
        ← Browse events
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900">{event.title}</h1>
        <EventStatusBadge status={event.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Row label="Description">
                  <span className="whitespace-pre-wrap">{event.description}</span>
                </Row>
              </div>
              <Row label="Category" icon="layers">{EVENT_CATEGORY_LABEL[event.category] ?? event.category}</Row>
              <Row label="Venue" icon="map-pin">{event.venue}</Row>
              <Row label="Starts" icon="calendar">{formatDateTime(event.startDate)}</Row>
              <Row label="Ends" icon="calendar">{formatDateTime(event.endDate)}</Row>
              {(event.registrationStartDate || event.registrationEndDate) && (
                <div className="sm:col-span-2">
                  <Row label="Registration window" icon="clock">
                    {formatDateTime(event.registrationStartDate)} — {formatDateTime(event.registrationEndDate)}
                  </Row>
                </div>
              )}
              {event.organiserName && <Row label="Organised by" icon="user">{event.organiserName}</Row>}
              {event.capacity?.max != null && (
                <Row label="Capacity" icon="users">
                  {event.capacity.isFull
                    ? `Full (${event.capacity.max})`
                    : `${event.capacity.spotsLeft} of ${event.capacity.max} spots left`}
                </Row>
              )}
            </dl>
          </div>
        </div>

        <div className="lg:col-span-1">
          <RegistrationPanel event={event} onChanged={setEvent} />
        </div>
      </div>
    </section>
  );
};

export default EventDetailsPublic;
