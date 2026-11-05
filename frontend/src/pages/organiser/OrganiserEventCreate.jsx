import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import eventService from '../../services/eventService.js';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Icon from '../../components/ui/Icon.jsx';
import EventForm from '../../components/event/EventForm.jsx';
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABEL,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  formatDateTime,
  formatDate,
} from '../../utils/eventMeta.js';

const INITIAL_GENERATION_STEPS = [
  'Analyzing topic keywords & domain semantics...',
  'Synthesizing professional description, highlights & agenda...',
  'Curating verified 16:9 landscape topic banner visual...',
];

/**
 * Organiser Create Event Workflow (Automated AI Event Creation).
 *
 * Flow:
 * 1. Initial form: Requires ONLY Title, Date, and Venue (3 fields).
 * 2. "Generate with AI" calls the backend AI synthesis engine.
 * 3. Shows live progress while preparing the structured draft and 16:9 banner.
 * 4. Displays a complete preview with:
 *    - Large 16:9 landscape banner image + topic metadata.
 *    - Editable essential details (title, date, venue - preserved as source of truth).
 *    - Suggested category, registration type, capacity, and schedule.
 *    - Formatted description, learning objectives, highlights, and requirements.
 * 5. Organiser actions:
 *    - Edit Details (inline adjustments).
 *    - Regenerate Description (preserves banner & manual edits).
 *    - Regenerate Banner (cycles topic-specific visuals without losing content).
 *    - Create Event (saves through the existing POST /api/events endpoint).
 */
const OrganiserEventCreate = () => {
  const navigate = useNavigate();

  // Mode: 'ai_initial' | 'ai_generating' | 'ai_review' | 'manual'
  const [mode, setMode] = useState('ai_initial');

  // Initial 3-field input state
  const [initialInput, setInitialInput] = useState({
    title: '',
    startDate: '',
    venue: '',
  });
  const [inputErrors, setInputErrors] = useState({});

  // Generated draft state
  const [draft, setDraft] = useState(null);

  // Review & Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [reviewedData, setReviewedData] = useState({
    title: '',
    startDate: '',
    endDate: '',
    venue: '',
    category: 'WORKSHOP',
    description: '',
    image: '',
    maxParticipants: '',
    registrationType: 'INDIVIDUAL',
    maxTeamSize: '',
    registrationStartDate: '',
    registrationEndDate: '',
  });

  // Loading & action states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingDesc, setIsRegeneratingDesc] = useState(false);
  const [isRegeneratingBanner, setIsRegeneratingBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Error feedback
  const [serverError, setServerError] = useState('');
  const [serverFieldErrors, setServerFieldErrors] = useState(null);

  // Validation for initial 3 fields
  const validateInitial = () => {
    const errs = {};
    if (!initialInput.title.trim()) {
      errs.title = 'Event title is required.';
    } else if (initialInput.title.trim().length < 3) {
      errs.title = 'Title must be at least 3 characters.';
    }

    if (!initialInput.startDate) {
      errs.startDate = 'Event date and time is required.';
    } else {
      const d = new Date(initialInput.startDate);
      if (Number.isNaN(d.getTime())) {
        errs.startDate = 'Please enter a valid date and time.';
      }
    }

    if (!initialInput.venue.trim()) {
      errs.venue = 'Venue is required.';
    }

    setInputErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // 1. Initial "Generate with AI" trigger
  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    setServerError('');
    setServerFieldErrors(null);

    if (!validateInitial()) return;

    setIsGenerating(true);
    setMode('ai_generating');

    try {
      const generated = await eventService.generateEventDraft({
        title: initialInput.title.trim(),
        startDate: fromDatetimeLocalValue(initialInput.startDate),
        venue: initialInput.venue.trim(),
        mode: 'full',
      });

      setDraft(generated);
      setReviewedData({
        title: generated.title || initialInput.title.trim(),
        startDate: toDatetimeLocalValue(generated.startDate || initialInput.startDate),
        endDate: toDatetimeLocalValue(generated.endDate),
        venue: generated.venue || initialInput.venue.trim(),
        category: generated.category || 'WORKSHOP',
        description: generated.description || '',
        image: generated.banner?.url || '',
        maxParticipants: generated.suggestedCapacity ? String(generated.suggestedCapacity) : '',
        registrationType: generated.registrationType || 'INDIVIDUAL',
        maxTeamSize: generated.maxTeamSize ? String(generated.maxTeamSize) : '',
        registrationStartDate: toDatetimeLocalValue(generated.registrationStartDate),
        registrationEndDate: toDatetimeLocalValue(generated.registrationEndDate),
      });

      setMode('ai_review');
    } catch (err) {
      if (err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setServerError(err.message || 'Failed to generate event draft. Please check your inputs and try again.');
      setMode('ai_initial');
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Regenerate Description (preserves banner & manual inputs)
  const handleRegenerateDescription = async () => {
    setServerError('');
    setIsRegeneratingDesc(true);
    try {
      const updated = await eventService.generateEventDraft({
        title: reviewedData.title,
        startDate: fromDatetimeLocalValue(reviewedData.startDate),
        venue: reviewedData.venue,
        category: reviewedData.category,
        existingBanner: reviewedData.image,
        mode: 'description',
      });

      setDraft((prev) => ({
        ...prev,
        description: updated.description,
        objectives: updated.objectives,
        highlights: updated.highlights,
        agenda: updated.agenda,
        tagline: updated.tagline,
        requirements: updated.requirements,
      }));

      setReviewedData((prev) => ({
        ...prev,
        description: updated.description,
      }));
    } catch (err) {
      setServerError(err.message || 'Failed to regenerate description.');
    } finally {
      setIsRegeneratingDesc(false);
    }
  };

  // 3. Regenerate Banner (cycles topic visuals without losing description or edits)
  const handleRegenerateBanner = async () => {
    setServerError('');
    setIsRegeneratingBanner(true);
    try {
      const updated = await eventService.generateEventDraft({
        title: reviewedData.title,
        startDate: fromDatetimeLocalValue(reviewedData.startDate),
        venue: reviewedData.venue,
        category: reviewedData.category,
        existingBanner: reviewedData.image,
        existingDescription: reviewedData.description,
        mode: 'banner',
      });

      setDraft((prev) => ({
        ...prev,
        banner: updated.banner,
      }));

      setReviewedData((prev) => ({
        ...prev,
        image: updated.banner?.url || prev.image,
      }));
    } catch (err) {
      setServerError(err.message || 'Failed to regenerate banner visual.');
    } finally {
      setIsRegeneratingBanner(false);
    }
  };

  // 4. Select alternative banner from curated list
  const handleSelectAlternativeBanner = (altUrl) => {
    setReviewedData((prev) => ({ ...prev, image: altUrl }));
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        banner: {
          ...prev.banner,
          url: altUrl,
        },
      };
    });
  };

  // 5. Final Save: Submit reviewed payload to existing backend API
  const handleSaveEvent = async () => {
    setServerError('');
    setServerFieldErrors(null);

    // Basic frontend check on review state
    if (!reviewedData.title.trim()) {
      setServerError('Event title is required.');
      return;
    }
    if (!reviewedData.startDate) {
      setServerError('Event start date is required.');
      return;
    }
    if (!reviewedData.endDate) {
      setServerError('Event end date is required.');
      return;
    }
    if (!reviewedData.venue.trim()) {
      setServerError('Event venue is required.');
      return;
    }

    const start = new Date(reviewedData.startDate);
    const end = new Date(reviewedData.endDate);
    if (end < start) {
      setServerError('End date must not be before the start date.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: reviewedData.title.trim(),
        description: reviewedData.description.trim(),
        category: reviewedData.category,
        venue: reviewedData.venue.trim(),
        startDate: fromDatetimeLocalValue(reviewedData.startDate),
        endDate: fromDatetimeLocalValue(reviewedData.endDate),
        registrationStartDate: fromDatetimeLocalValue(reviewedData.registrationStartDate) ?? null,
        registrationEndDate: fromDatetimeLocalValue(reviewedData.registrationEndDate) ?? null,
        maxParticipants: reviewedData.maxParticipants === '' ? null : Number(reviewedData.maxParticipants),
        image: reviewedData.image.trim(),
        registrationType: reviewedData.registrationType,
        maxTeamSize:
          reviewedData.registrationType === 'TEAM' && reviewedData.maxTeamSize !== ''
            ? Number(reviewedData.maxTeamSize)
            : null,
      };

      const event = await eventService.createEvent(payload);
      // Navigate directly to the newly saved event's details page
      navigate(`/organiser/events/${event.id}`, { replace: true });
    } catch (err) {
      if (err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setServerFieldErrors(err.fieldErrors ?? null);
      setServerError(err.message || 'Could not save the event. Please correct the highlighted fields.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for review field updates
  const updateReviewed = (field) => (e) => {
    setReviewedData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Manual fallback mode handler
  const handleManualSubmit = async (payload) => {
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
    <section className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Create New Event"
          description="Enter the essential details to automatically synthesize a complete, topic-tailored event draft."
        />
        {mode === 'manual' ? (
          <button
            type="button"
            onClick={() => setMode('ai_initial')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <Icon name="sparkles" className="h-4 w-4" />
            Switch to AI Generator
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode('manual')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Switch to manual form
          </button>
        )}
      </div>

      {serverError && <ErrorBanner message={serverError} />}

      {/* -------------------- STEP 1: INITIAL 3-FIELD FORM -------------------- */}
      {mode === 'ai_initial' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition sm:p-8">
          <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-sm">
              <Icon name="sparkles" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Essential Details</h2>
              <p className="text-xs text-slate-500">
                Provide just these 3 inputs. Our AI service generates the description, schedule, and banner image.
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-5" noValidate>
            {/* 1. Title */}
            <div className="space-y-1.5">
              <label htmlFor="ai-title" className="block text-sm font-semibold text-slate-700">
                Event Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="ai-title"
                type="text"
                placeholder="e.g., Advanced Autonomous Robotics Workshop 2026"
                value={initialInput.title}
                onChange={(e) => {
                  setInitialInput((prev) => ({ ...prev, title: e.target.value }));
                  setInputErrors((prev) => ({ ...prev, title: undefined }));
                }}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 ${inputErrors.title
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
                  }`}
                autoFocus
              />
              {inputErrors.title ? (
                <p className="text-xs font-medium text-rose-600">{inputErrors.title}</p>
              ) : (
                <p className="text-xs text-slate-400">
                  Topic keywords in the title (e.g. &quot;Robotics&quot;, &quot;Hackathon&quot;, &quot;AI&quot;) drive
                  tailored content and banner selection.
                </p>
              )}
            </div>

            {/* 2. Date & Time */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="ai-date" className="block text-sm font-semibold text-slate-700">
                  Event Date &amp; Start Time <span className="text-rose-500">*</span>
                </label>
                <input
                  id="ai-date"
                  type="datetime-local"
                  value={initialInput.startDate}
                  onChange={(e) => {
                    setInitialInput((prev) => ({ ...prev, startDate: e.target.value }));
                    setInputErrors((prev) => ({ ...prev, startDate: undefined }));
                  }}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 ${inputErrors.startDate
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
                    }`}
                />
                {inputErrors.startDate && (
                  <p className="text-xs font-medium text-rose-600">{inputErrors.startDate}</p>
                )}
              </div>

              {/* 3. Venue */}
              <div className="space-y-1.5">
                <label htmlFor="ai-venue" className="block text-sm font-semibold text-slate-700">
                  Venue / Location <span className="text-rose-500">*</span>
                </label>
                <input
                  id="ai-venue"
                  type="text"
                  placeholder="e.g., Tech Park Auditorium, Hall 3"
                  value={initialInput.venue}
                  onChange={(e) => {
                    setInitialInput((prev) => ({ ...prev, venue: e.target.value }));
                    setInputErrors((prev) => ({ ...prev, venue: undefined }));
                  }}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 ${inputErrors.venue
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
                    }`}
                />
                {inputErrors.venue && (
                  <p className="text-xs font-medium text-rose-600">{inputErrors.venue}</p>
                )}
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isGenerating}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:from-indigo-500 hover:to-violet-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Icon name="sparkles" className="h-4 w-4 transition-transform group-hover:rotate-12" />
                Generate with AI
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- STEP 2: GENERATION PROGRESS STATE -------------------- */}
      {mode === 'ai_generating' && (
        <div className="rounded-2xl border border-indigo-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <svg
              className="h-8 w-8 animate-spin text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Synthesizing Topic-Tailored Event Draft</h3>
          <p className="mt-1 text-sm text-slate-500">
            Generating structured description, schedule breakdown, and matching 16:9 banner for{' '}
            <span className="font-semibold text-slate-700">&quot;{initialInput.title}&quot;</span>
          </p>

          <div className="mx-auto mt-6 max-w-md space-y-2.5 text-left">
            {INITIAL_GENERATION_STEPS.map((stepMsg, idx) => (
              <div key={stepMsg} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                  {idx + 1}
                </span>
                <span>{stepMsg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------- STEP 3: REVIEW / PREVIEW SCREEN -------------------- */}
      {mode === 'ai_review' && draft && (
        <div className="space-y-6">
          {/* Top Success Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
            <div className="flex items-center gap-2">
              <Icon name="check-circle" className="h-5 w-5 text-emerald-600" />
              <span>
                <strong>Event draft generated!</strong> Review details below, customize any section, and click{' '}
                <strong>Create Event</strong> to save.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMode('ai_initial')}
              className="text-xs font-semibold text-emerald-700 underline hover:text-emerald-900"
            >
              Start over
            </button>
          </div>

          {/* 1. Large 16:9 Banner Hero Preview */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-video w-full bg-slate-900">
              <img
                src={reviewedData.image || draft.banner?.url}
                alt={draft.banner?.alt || reviewedData.title}
                className="h-full w-full object-cover"
              />
              {/* Overlay with Banner Topic & Attribution */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />

              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3 text-white">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur-md">
                      16:9 Landscape Banner
                    </span>
                    <span className="rounded-md bg-indigo-600/80 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md">
                      {draft.banner?.topic || 'Topic Visual'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-200">
                    {draft.banner?.note || 'Topic-specific verified landscape photography.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRegenerateBanner}
                    disabled={isRegeneratingBanner}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow backdrop-blur transition hover:bg-white disabled:opacity-50"
                  >
                    <Icon name="refresh-cw" className={`h-3.5 w-3.5 ${isRegeneratingBanner ? 'animate-spin' : ''}`} />
                    {isRegeneratingBanner ? 'Switching…' : 'Regenerate Banner'}
                  </button>
                </div>
              </div>
            </div>

            {/* Alternatives Banner Picker Strip */}
            {draft.banner?.alternatives?.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50 p-3 sm:px-6">
                <span className="text-xs font-medium text-slate-500">More matching topic banners:</span>
                <div className="mt-2 flex flex-wrap gap-2.5">
                  {draft.banner.alternatives.map((altOption) => (
                    <button
                      key={altOption.url}
                      type="button"
                      onClick={() => handleSelectAlternativeBanner(altOption.url)}
                      className={`relative h-14 w-24 overflow-hidden rounded-lg border-2 transition ${reviewedData.image === altOption.url
                          ? 'border-indigo-600 ring-2 ring-indigo-200'
                          : 'border-slate-200 hover:border-indigo-400'
                        }`}
                    >
                      <img src={altOption.url} alt={altOption.alt} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Primary Information Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Event Overview</span>
                <h3 className="text-xl font-bold text-slate-900">{reviewedData.title}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{draft.tagline}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${isEditing
                      ? 'border border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <Icon name="edit" className="h-3.5 w-3.5" />
                  {isEditing ? 'Close Editor' : 'Edit Details'}
                </button>
              </div>
            </div>

            {/* Quick Metadata Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Icon name="calendar" className="h-3.5 w-3.5 text-indigo-500" />
                  Date &amp; Time
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateTime(reviewedData.startDate)}
                </dd>
                <dd className="text-xs text-slate-500">to {formatDateTime(reviewedData.endDate)}</dd>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Icon name="map-pin" className="h-3.5 w-3.5 text-indigo-500" />
                  Venue
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{reviewedData.venue}</dd>
                <dd className="text-xs text-slate-500">Source of truth preserved</dd>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Icon name="layers" className="h-3.5 w-3.5 text-indigo-500" />
                  Category &amp; Format
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {EVENT_CATEGORY_LABEL[reviewedData.category] || reviewedData.category}
                </dd>
                <dd className="text-xs text-slate-500">
                  {reviewedData.registrationType === 'TEAM'
                    ? `Team Event (max ${reviewedData.maxTeamSize || 4})`
                    : 'Individual Registration'}
                </dd>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Icon name="users" className="h-3.5 w-3.5 text-indigo-500" />
                  Suggested Capacity
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {reviewedData.maxParticipants ? `${reviewedData.maxParticipants} spots` : 'Open / Unlimited'}
                </dd>
                <dd className="text-xs text-slate-500">Status: DRAFT upon creation</dd>
              </div>
            </div>

            {/* Inline Editor Drawer (if opened) */}
            {isEditing && (
              <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/30 p-5">
                <h4 className="text-sm font-bold text-slate-800">Edit Event Fields</h4>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Title</label>
                    <input
                      type="text"
                      value={reviewedData.title}
                      onChange={updateReviewed('title')}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Category</label>
                    <select
                      value={reviewedData.category}
                      onChange={updateReviewed('category')}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    >
                      {EVENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {EVENT_CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Start Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={reviewedData.startDate}
                      onChange={updateReviewed('startDate')}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">End Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={reviewedData.endDate}
                      onChange={updateReviewed('endDate')}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Venue</label>
                    <input
                      type="text"
                      value={reviewedData.venue}
                      onChange={updateReviewed('venue')}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Capacity (Max Participants)</label>
                    <input
                      type="number"
                      min="1"
                      value={reviewedData.maxParticipants}
                      onChange={updateReviewed('maxParticipants')}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Banner Image URL</label>
                    <input
                      type="url"
                      value={reviewedData.image}
                      onChange={updateReviewed('image')}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Description</label>
                    <textarea
                      rows={6}
                      value={reviewedData.description}
                      onChange={updateReviewed('description')}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Generated Content Breakdown: Description, Highlights, Schedule */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left 2 Cols: Description & Agenda */}
            <div className="space-y-6 lg:col-span-2">
              {/* Description Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">Event Description</h4>
                  <button
                    type="button"
                    onClick={handleRegenerateDescription}
                    disabled={isRegeneratingDesc}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    <Icon name="refresh-cw" className={`h-3 w-3 ${isRegeneratingDesc ? 'animate-spin' : ''}`} />
                    {isRegeneratingDesc ? 'Regenerating…' : 'Regenerate Description'}
                  </button>
                </div>
                <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {reviewedData.description}
                </div>
              </div>

              {/* Agenda & Schedule Breakdown */}
              {draft.agenda?.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900">
                    Suggested Agenda &amp; Schedule
                  </h4>
                  <div className="space-y-3">
                    {draft.agenda.map((item) => (
                      <div
                        key={item.title}
                        className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition hover:bg-slate-50"
                      >
                        <span className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                          {item.time}
                        </span>
                        <div>
                          <h5 className="text-sm font-semibold text-slate-900">{item.title}</h5>
                          <p className="mt-0.5 text-xs text-slate-600">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Col: Objectives, Highlights, Requirements, Tags */}
            <div className="space-y-6 lg:col-span-1">
              {/* Objectives */}
              {draft.objectives?.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900">
                    <Icon name="target" className="h-3.5 w-3.5 text-indigo-500" />
                    Key Objectives
                  </h4>
                  <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
                    {draft.objectives.map((obj) => (
                      <li key={obj} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Highlights */}
              {draft.highlights?.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900">
                    <Icon name="star" className="h-3.5 w-3.5 text-amber-500" />
                    Key Highlights
                  </h4>
                  <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
                    {draft.highlights.map((hl) => (
                      <li key={hl} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Requirements & Audience */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-900">
                  Target Audience &amp; Prerequisites
                </h4>
                <p className="text-xs text-slate-600">{draft.intendedAudience}</p>
                {draft.requirements?.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <span className="text-[11px] font-semibold uppercase text-slate-400">Requirements:</span>
                    <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                      {draft.requirements.map((req) => (
                        <li key={req} className="flex items-start gap-1.5">
                          <span>•</span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Keywords & Tags */}
              {draft.keywords?.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Keywords &amp; Tags</span>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {draft.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Action Bar */}
          <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {isEditing ? 'Done Editing' : 'Edit Details'}
              </button>
              <button
                type="button"
                onClick={handleRegenerateDescription}
                disabled={isRegeneratingDesc}
                className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                {isRegeneratingDesc ? 'Regenerating…' : 'Regenerate Description'}
              </button>
              <button
                type="button"
                onClick={handleRegenerateBanner}
                disabled={isRegeneratingBanner}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {isRegeneratingBanner ? 'Switching…' : 'Regenerate Banner'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMode('ai_initial')}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEvent}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon name="check" className="h-4 w-4" />
                {isSaving ? 'Creating Event…' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MANUAL MODE (LEGACY / OPTIONAL) -------------------- */}
      {mode === 'manual' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <EventForm
            onSubmit={handleManualSubmit}
            submitLabel="Create event"
            onCancel={() => setMode('ai_initial')}
            serverError={serverError}
            serverFieldErrors={serverFieldErrors}
          />
        </div>
      )}
    </section>
  );
};

export default OrganiserEventCreate;
