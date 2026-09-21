import { EVENT_CATEGORIES, EVENT_STATUSES, EVENT_REGISTRATION_TYPES } from '../models/event.model.js';

/**
 * Dependency-free validation for event input. Runs before Mongoose so the API
 * can return clear field-level messages; the Event schema enforces the same
 * rules as a second layer.
 */

const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

const isNonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const parseDate = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d; // undefined => provided but invalid
};

export const isValidEventStatus = (v) =>
  typeof v === 'string' && Object.values(EVENT_STATUSES).includes(v.toUpperCase());

export const isValidEventCategory = (v) =>
  typeof v === 'string' && Object.values(EVENT_CATEGORIES).includes(v.toUpperCase());

export const isValidRegistrationType = (v) =>
  typeof v === 'string' && Object.values(EVENT_REGISTRATION_TYPES).includes(v.toUpperCase());

/**
 * Validate a full event object (create) or a merged object (update).
 * The caller is responsible for merging incoming update fields onto the
 * existing document before calling this, so cross-field date checks are
 * always evaluated against the final state.
 *
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export const validateEventData = (data = {}) => {
  const errors = {};

  if (!isNonEmpty(data.title)) errors.title = 'Title is required.';
  else if (data.title.trim().length < 3 || data.title.trim().length > 150) {
    errors.title = 'Title must be between 3 and 150 characters.';
  }

  if (!isNonEmpty(data.description)) errors.description = 'Description is required.';
  else if (data.description.trim().length < 10 || data.description.trim().length > 5000) {
    errors.description = 'Description must be between 10 and 5000 characters.';
  }

  if (!isNonEmpty(data.venue)) errors.venue = 'Venue is required.';
  else if (data.venue.trim().length > 300) errors.venue = 'Venue must be at most 300 characters.';

  if (data.category !== undefined && data.category !== '' && !isValidEventCategory(data.category)) {
    errors.category = `"${data.category}" is not a valid category.`;
  }

  const start = parseDate(data.startDate);
  const end = parseDate(data.endDate);
  if (start === null) errors.startDate = 'Start date is required.';
  else if (start === undefined) errors.startDate = 'Start date is not a valid date.';
  if (end === null) errors.endDate = 'End date is required.';
  else if (end === undefined) errors.endDate = 'End date is not a valid date.';
  if (start instanceof Date && end instanceof Date && end < start) {
    errors.endDate = 'End date must not be before the start date.';
  }

  const regStart = parseDate(data.registrationStartDate);
  const regEnd = parseDate(data.registrationEndDate);
  if (regStart === undefined) errors.registrationStartDate = 'Registration start is not a valid date.';
  if (regEnd === undefined) errors.registrationEndDate = 'Registration end is not a valid date.';
  if (regStart instanceof Date && regEnd instanceof Date && regEnd < regStart) {
    errors.registrationEndDate = 'Registration end must not be before registration start.';
  }

  if (data.maxParticipants !== undefined && data.maxParticipants !== null && data.maxParticipants !== '') {
    const n = Number(data.maxParticipants);
    if (!Number.isInteger(n) || n < 1) {
      errors.maxParticipants = 'Maximum participants must be a whole number of at least 1.';
    }
  }

  if (isNonEmpty(data.image) && !HTTP_URL_PATTERN.test(data.image.trim())) {
    errors.image = 'Image must be a valid http(s) URL.';
  }

  if (data.status !== undefined && data.status !== '' && !isValidEventStatus(data.status)) {
    errors.status = `"${data.status}" is not a valid event status.`;
  }

  if (
    data.registrationType !== undefined &&
    data.registrationType !== '' &&
    !isValidRegistrationType(data.registrationType)
  ) {
    errors.registrationType = `"${data.registrationType}" is not a valid registration type.`;
  }

  const isTeamEvent = String(data.registrationType || '').toUpperCase() === EVENT_REGISTRATION_TYPES.TEAM;
  if (isTeamEvent) {
    if (data.maxTeamSize === undefined || data.maxTeamSize === null || data.maxTeamSize === '') {
      errors.maxTeamSize = 'Maximum team size is required for a team-registration event.';
    } else {
      const n = Number(data.maxTeamSize);
      if (!Number.isInteger(n) || n < 2) {
        errors.maxTeamSize = 'Maximum team size must be a whole number of at least 2.';
      } else if (
        data.maxParticipants !== undefined &&
        data.maxParticipants !== null &&
        data.maxParticipants !== '' &&
        n > Number(data.maxParticipants)
      ) {
        errors.maxTeamSize = 'Maximum team size cannot exceed the event capacity.';
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

/**
 * Whitelist of fields an organiser may set via create/edit. Notably excludes
 * `organiser`, `status`, `isDeleted` — those are controlled by the server.
 */
export const EDITABLE_EVENT_FIELDS = Object.freeze([
  'title',
  'description',
  'category',
  'venue',
  'startDate',
  'endDate',
  'registrationStartDate',
  'registrationEndDate',
  'maxParticipants',
  'image',
  'registrationType',
  'maxTeamSize',
]);

/** Return a copy of `body` containing only the editable fields that are present. */
export const pickEditableEventFields = (body = {}) => {
  const out = {};
  for (const key of EDITABLE_EVENT_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
};
