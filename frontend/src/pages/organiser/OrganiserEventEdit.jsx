import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import eventService from '../../services/eventService.js';
import EventForm from '../../components/event/EventForm.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';

/** Edit an existing owned event's content (not its status — that's on the details page). */
const OrganiserEventEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [serverError, setServerError] = useState('');
  const [serverFieldErrors, setServerFieldErrors] = useState(null);

  useEffect(() => {
    let active = true;
    eventService
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
        setLoadError(err.message || 'Could not load this event.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [id, navigate]);

  const handleSubmit = async (payload) => {
    setServerError('');
    setServerFieldErrors(null);
    try {
      await eventService.updateEvent(id, payload);
      navigate(`/organiser/events/${id}`, { replace: true });
    } catch (err) {
      if (err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setServerFieldErrors(err.fieldErrors ?? null);
      setServerError(err.message || 'Could not update the event.');
    }
  };

  if (loadState === 'loading') {
    return <div className="h-40 max-w-2xl animate-pulse rounded-lg bg-slate-100" />;
  }
  if (loadState === 'error') {
    return <ErrorBanner message={loadError} />;
  }

  return (
    <section className="max-w-2xl space-y-5">
      <PageHeader
        title="Edit event"
        description={
          <>
            Editing <span className="font-medium text-slate-700">{event.title}</span>. Status and ownership are
            managed elsewhere.
          </>
        }
      />
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <EventForm
          initialValues={event}
          onSubmit={handleSubmit}
          submitLabel="Save changes"
          onCancel={() => navigate(`/organiser/events/${id}`)}
          serverError={serverError}
          serverFieldErrors={serverFieldErrors}
        />
      </div>
    </section>
  );
};

export default OrganiserEventEdit;
