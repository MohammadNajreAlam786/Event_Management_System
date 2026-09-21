import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import eventService from '../../services/eventService.js';
import EventForm from '../../components/event/EventForm.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';

/** Create a new event. It is always saved as a DRAFT (enforced by the backend). */
const OrganiserEventCreate = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [serverFieldErrors, setServerFieldErrors] = useState(null);

  const handleSubmit = async (payload) => {
    setServerError('');
    setServerFieldErrors(null);
    try {
      const event = await eventService.createEvent(payload);
      navigate(`/organiser/events/${event.id}`, { replace: true });
    } catch (err) {
      if (err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setServerFieldErrors(err.fieldErrors ?? null);
      setServerError(err.message || 'Could not create the event.');
    }
  };

  return (
    <section className="max-w-2xl space-y-5">
      <PageHeader
        title="Create event"
        description="New events are created as a draft. You can change the status later."
      />
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <EventForm
          onSubmit={handleSubmit}
          submitLabel="Create event"
          onCancel={() => navigate('/organiser/events')}
          serverError={serverError}
          serverFieldErrors={serverFieldErrors}
        />
      </div>
    </section>
  );
};

export default OrganiserEventCreate;
