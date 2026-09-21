import { useState } from 'react';

import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABEL,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from '../../utils/eventMeta.js';
import ErrorBanner from '../ui/ErrorBanner.jsx';

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

const emptyForm = {
  title: '',
  description: '',
  category: 'OTHER',
  venue: '',
  startDate: '',
  endDate: '',
  registrationStartDate: '',
  registrationEndDate: '',
  maxParticipants: '',
  image: '',
  registrationType: 'INDIVIDUAL',
  maxTeamSize: '',
};

/** Build the initial controlled state from an existing event (edit) or blanks. */
const toFormState = (event) => {
  if (!event) return { ...emptyForm };
  return {
    title: event.title ?? '',
    description: event.description ?? '',
    category: event.category ?? 'OTHER',
    venue: event.venue ?? '',
    startDate: toDatetimeLocalValue(event.startDate),
    endDate: toDatetimeLocalValue(event.endDate),
    registrationStartDate: toDatetimeLocalValue(event.registrationStartDate),
    registrationEndDate: toDatetimeLocalValue(event.registrationEndDate),
    maxParticipants: event.maxParticipants == null ? '' : String(event.maxParticipants),
    image: event.image ?? '',
    registrationType: event.registrationType ?? 'INDIVIDUAL',
    maxTeamSize: event.maxTeamSize == null ? '' : String(event.maxTeamSize),
  };
};

const validate = (f) => {
  const e = {};
  if (!f.title.trim()) e.title = 'Title is required.';
  else if (f.title.trim().length < 3) e.title = 'Title must be at least 3 characters.';

  if (!f.description.trim()) e.description = 'Description is required.';
  else if (f.description.trim().length < 10) e.description = 'Description must be at least 10 characters.';

  if (!f.venue.trim()) e.venue = 'Venue is required.';
  if (!f.startDate) e.startDate = 'Start date is required.';
  if (!f.endDate) e.endDate = 'End date is required.';
  if (f.startDate && f.endDate && new Date(f.endDate) < new Date(f.startDate)) {
    e.endDate = 'End date must not be before the start date.';
  }
  if (
    f.registrationStartDate &&
    f.registrationEndDate &&
    new Date(f.registrationEndDate) < new Date(f.registrationStartDate)
  ) {
    e.registrationEndDate = 'Registration end must not be before registration start.';
  }
  if (f.maxParticipants !== '') {
    const n = Number(f.maxParticipants);
    if (!Number.isInteger(n) || n < 1) e.maxParticipants = 'Must be a whole number of at least 1.';
  }
  if (f.image.trim() && !URL_PATTERN.test(f.image.trim())) {
    e.image = 'Must be a valid http(s) URL.';
  }
  if (f.registrationType === 'TEAM') {
    if (f.maxTeamSize === '') {
      e.maxTeamSize = 'Maximum team size is required for team registration.';
    } else {
      const n = Number(f.maxTeamSize);
      if (!Number.isInteger(n) || n < 2) e.maxTeamSize = 'Must be a whole number of at least 2.';
      else if (f.maxParticipants !== '' && n > Number(f.maxParticipants)) {
        e.maxTeamSize = 'Cannot exceed the event’s maximum participants.';
      }
    }
  }
  return e;
};

/**
 * Shared create/edit form. `onSubmit` receives a ready-to-send payload
 * (dates as ISO strings, maxParticipants as a number or omitted). Entered
 * data is never discarded on a validation failure.
 */
const EventForm = ({ initialValues = null, onSubmit, submitLabel = 'Save', onCancel, serverError = '', serverFieldErrors = null }) => {
  const [form, setForm] = useState(() => toFormState(initialValues));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const next = validate(form);
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        venue: form.venue.trim(),
        startDate: fromDatetimeLocalValue(form.startDate),
        endDate: fromDatetimeLocalValue(form.endDate),
        registrationStartDate: fromDatetimeLocalValue(form.registrationStartDate) ?? null,
        registrationEndDate: fromDatetimeLocalValue(form.registrationEndDate) ?? null,
        maxParticipants: form.maxParticipants === '' ? null : Number(form.maxParticipants),
        image: form.image.trim(),
        registrationType: form.registrationType,
        maxTeamSize: form.registrationType === 'TEAM' && form.maxTeamSize !== '' ? Number(form.maxTeamSize) : null,
      });
    } catch {
      // The parent surfaces the error via `serverError` / `serverFieldErrors`.
    } finally {
      setSubmitting(false);
    }
  };

  const err = (field) => errors[field] || serverFieldErrors?.[field];
  const inputClass = (field) =>
    `w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 ${
      err(field)
        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
    }`;
  const FieldError = ({ field }) => (err(field) ? <p className="text-xs text-rose-600">{err(field)}</p> : null);
  const Req = () => <span className="text-rose-500"> *</span>;

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {serverError && <ErrorBanner message={serverError} />}

      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium text-slate-700">
          Event title<Req />
        </label>
        <input id="title" type="text" value={form.title} onChange={update('title')} className={inputClass('title')} />
        <FieldError field="title" />
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium text-slate-700">
          Description<Req />
        </label>
        <textarea
          id="description"
          rows={4}
          value={form.description}
          onChange={update('description')}
          className={inputClass('description')}
        />
        <FieldError field="description" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="category" className="text-sm font-medium text-slate-700">
            Category
          </label>
          <select id="category" value={form.category} onChange={update('category')} className={inputClass('category')}>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EVENT_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <FieldError field="category" />
        </div>

        <div className="space-y-1">
          <label htmlFor="venue" className="text-sm font-medium text-slate-700">
            Venue<Req />
          </label>
          <input id="venue" type="text" value={form.venue} onChange={update('venue')} className={inputClass('venue')} />
          <FieldError field="venue" />
        </div>

        <div className="space-y-1">
          <label htmlFor="startDate" className="text-sm font-medium text-slate-700">
            Start date &amp; time<Req />
          </label>
          <input
            id="startDate"
            type="datetime-local"
            value={form.startDate}
            onChange={update('startDate')}
            className={inputClass('startDate')}
          />
          <FieldError field="startDate" />
        </div>

        <div className="space-y-1">
          <label htmlFor="endDate" className="text-sm font-medium text-slate-700">
            End date &amp; time<Req />
          </label>
          <input
            id="endDate"
            type="datetime-local"
            value={form.endDate}
            onChange={update('endDate')}
            className={inputClass('endDate')}
          />
          <FieldError field="endDate" />
        </div>

        <div className="space-y-1">
          <label htmlFor="registrationStartDate" className="text-sm font-medium text-slate-700">
            Registration opens
          </label>
          <input
            id="registrationStartDate"
            type="datetime-local"
            value={form.registrationStartDate}
            onChange={update('registrationStartDate')}
            className={inputClass('registrationStartDate')}
          />
          <FieldError field="registrationStartDate" />
        </div>

        <div className="space-y-1">
          <label htmlFor="registrationEndDate" className="text-sm font-medium text-slate-700">
            Registration closes
          </label>
          <input
            id="registrationEndDate"
            type="datetime-local"
            value={form.registrationEndDate}
            onChange={update('registrationEndDate')}
            className={inputClass('registrationEndDate')}
          />
          <FieldError field="registrationEndDate" />
        </div>

        <div className="space-y-1">
          <label htmlFor="maxParticipants" className="text-sm font-medium text-slate-700">
            Maximum participants
          </label>
          <input
            id="maxParticipants"
            type="number"
            min="1"
            value={form.maxParticipants}
            onChange={update('maxParticipants')}
            className={inputClass('maxParticipants')}
          />
          <FieldError field="maxParticipants" />
        </div>

        <div className="space-y-1">
          <label htmlFor="image" className="text-sm font-medium text-slate-700">
            Image URL
          </label>
          <input id="image" type="url" value={form.image} onChange={update('image')} className={inputClass('image')} />
          <FieldError field="image" />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Registration type</span>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="registrationType"
                value="INDIVIDUAL"
                checked={form.registrationType === 'INDIVIDUAL'}
                onChange={update('registrationType')}
                className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Individual
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="registrationType"
                value="TEAM"
                checked={form.registrationType === 'TEAM'}
                onChange={update('registrationType')}
                className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Team
            </label>
          </div>
          <FieldError field="registrationType" />
        </div>

        {form.registrationType === 'TEAM' && (
          <div className="space-y-1">
            <label htmlFor="maxTeamSize" className="text-sm font-medium text-slate-700">
              Maximum team size<Req />
            </label>
            <input
              id="maxTeamSize"
              type="number"
              min="2"
              value={form.maxTeamSize}
              onChange={update('maxTeamSize')}
              className={inputClass('maxTeamSize')}
            />
            <FieldError field="maxTeamSize" />
            <p className="text-xs text-slate-400">Includes the team leader.</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default EventForm;
