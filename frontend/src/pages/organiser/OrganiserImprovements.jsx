import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import eventService from '../../services/eventService.js';
import improvementService from '../../services/improvementService.js';
import EmptyState from '../../components/EmptyState.jsx';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import RecommendationCard from '../../components/improvement/RecommendationCard.jsx';
import NoteList from '../../components/improvement/NoteList.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { EVENT_STATUS_LABEL, formatDateTime } from '../../utils/eventMeta.js';

/** Order events for the selector: completed first (the only supported state), then the rest. */
const sortForSelector = (events) => {
  const rank = (s) => (s === 'COMPLETED' ? 0 : 1);
  return [...events].sort((a, b) => rank(a.status) - rank(b.status) || new Date(b.startDate) - new Date(a.startDate));
};

const itemKey = (item) => `${item.category}::${item.title}`;

/** /organiser/improvements — AI-based, data-grounded future-event improvement recommendations for a completed event. */
const OrganiserImprovements = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('event') || '';

  const [events, setEvents] = useState([]);
  const [eventsState, setEventsState] = useState('loading');

  const [data, setData] = useState(null);
  const [dataState, setDataState] = useState('idle'); // idle | loading | ready | error
  const [dataError, setDataError] = useState('');

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const [checked, setChecked] = useState(new Set());
  const [checklistText, setChecklistText] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    let active = true;
    setEventsState('loading');
    eventService
      .getMyEvents({ limit: 100 })
      .then((res) => {
        if (!active) return;
        setEvents(sortForSelector(res.events));
        setEventsState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setEventsState('error');
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  const load = useCallback(
    (eventId) => {
      if (!eventId) {
        setData(null);
        setDataState('idle');
        return;
      }
      setDataState('loading');
      setDataError('');
      setGenerateError('');
      setChecked(new Set());
      setChecklistText('');
      improvementService
        .getImprovements(eventId)
        .then((res) => {
          setData(res);
          setDataState('ready');
        })
        .catch((err) => {
          if (err.status === 401) {
            navigate('/login', { replace: true });
            return;
          }
          setDataError(
            err.status === 403
              ? 'You can only view improvement recommendations for your own events.'
              : err.status === 404
                ? 'Event not found.'
                : err.message || 'Unable to load improvement recommendations. Please try again.',
          );
          setDataState('error');
        });
    },
    [navigate],
  );

  useEffect(() => load(selectedId), [selectedId, load]);

  const onSelect = (id) => setParams(id ? { event: id } : {});

  const doGenerate = async () => {
    setGenerating(true);
    setGenerateError('');
    try {
      const res = await improvementService.generate(selectedId);
      setData(res);
      setChecked(new Set());
      setChecklistText('');
    } catch (err) {
      setGenerateError(
        err.status === 409
          ? err.message || 'Improvement recommendations are available once the event is completed.'
          : err.message || 'Could not generate recommendations. Please try again.',
      );
    } finally {
      setGenerating(false);
    }
  };

  const toggleChecklist = (item) => {
    setChecked((prev) => {
      const next = new Set(prev);
      const key = itemKey(item);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setChecklistText('');
  };

  const buildChecklist = () => {
    const items = (data?.recommendations || []).filter((r) => checked.has(itemKey(r)));
    const text = items.map((r) => `- [ ] ${r.title}: ${r.recommendation}`).join('\n');
    setChecklistText(text);
    setCopyStatus('');
  };

  const copyChecklist = async () => {
    try {
      await navigator.clipboard.writeText(checklistText);
      setCopyStatus('Copied to clipboard.');
    } catch {
      setCopyStatus('Could not copy automatically — select the text above and copy it manually.');
    }
  };

  const selectorOptions = useMemo(
    () => events.map((e) => ({ id: e.id, label: `${e.title} — ${EVENT_STATUS_LABEL[e.status] ?? e.status}` })),
    [events],
  );

  const selectedEvent = events.find((e) => e.id === selectedId);
  const isCompleted = selectedEvent?.status === 'COMPLETED' || data?.event?.status === 'COMPLETED';

  return (
    <section className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <Icon name="sparkles" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Future event improvement</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            AI-based, data-grounded recommendations for a similar future event, drawn from this event&apos;s own
            registration, attendance, feedback, sentiment, certificate and planning records.
          </p>
        </div>
      </div>

      {eventsState === 'error' && <ErrorBanner message="Unable to load your events. Please refresh the page." />}

      {eventsState === 'ready' && events.length === 0 && (
        <EmptyState title="No events yet" description="Create and complete an event to generate improvement recommendations for it." icon="sparkles" />
      )}

      {eventsState === 'ready' && events.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="improvements-event" className="text-sm font-medium text-slate-700">
            Select event
          </label>
          <select
            id="improvements-event"
            value={selectedId}
            onChange={(e) => onSelect(e.target.value)}
            className="min-w-[16rem] max-w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">— choose an event —</option>
            {selectorOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {dataState === 'loading' && (
        <div className="space-y-3">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
          <div className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          <div className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        </div>
      )}

      {dataState === 'error' && <ErrorBanner message={dataError} onRetry={() => load(selectedId)} />}

      {dataState === 'ready' && data && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-base font-bold text-slate-900">{data.event.title}</h2>
                <EventStatusBadge status={data.event.status} />
              </div>
              {data.generated && (
                <p className="mt-0.5 text-xs text-slate-400">
                  Generated {formatDateTime(data.generatedAt)} · rule-based analysis of this event&apos;s own records
                </p>
              )}
            </div>
            {isCompleted && (
              <button
                type="button"
                onClick={doGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name={generating ? 'refresh-cw' : 'sparkles'} className="h-4 w-4" />
                {generating ? 'Generating…' : data.generated ? 'Regenerate recommendations' : 'Generate recommendations'}
              </button>
            )}
          </div>

          {generateError && <ErrorBanner message={generateError} />}

          {!data.generated && (
            <EmptyState
              title={isCompleted ? 'Not generated yet' : 'Not available yet'}
              description={data.reason}
              icon="sparkles"
            />
          )}

          {data.generated && (
            <>
              {data.strengths.length > 0 && (
                <div>
                  <div className="mb-2"><SectionHeader icon="check-circle" title="Strengths" /></div>
                  <NoteList items={data.strengths} tone="emerald" />
                </div>
              )}

              {data.improvementAreas.length > 0 && (
                <div>
                  <div className="mb-2"><SectionHeader icon="alert-triangle" title="Improvement areas" /></div>
                  <NoteList items={data.improvementAreas} tone="amber" />
                </div>
              )}

              <div>
                <div className="mb-2"><SectionHeader icon="clipboard-check" title="Recommended actions" /></div>
                {data.recommendations.length > 0 ? (
                  <ul className="space-y-3">
                    {data.recommendations.map((r) => (
                      <RecommendationCard
                        key={itemKey(r)}
                        item={r}
                        checked={checked.has(itemKey(r))}
                        onToggleChecklist={() => toggleChecklist(r)}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="No recommendations were generated"
                    description="The available data did not support a specific recommendation for this event."
                    icon="clipboard-check"
                  />
                )}
              </div>

              {data.recommendations.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <SectionHeader icon="clipboard-list" title="Improvement checklist" />
                  <p className="mt-0.5 text-xs text-slate-500">
                    Select recommendations above, then build a plain-text checklist to copy into your next event&apos;s
                    planning tasks. This never changes any existing event, registration, attendance or certificate —
                    you choose what to use and where.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={buildChecklist}
                      disabled={checked.size === 0}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon name="clipboard-list" className="h-3.5 w-3.5" />
                      Build checklist ({checked.size} selected)
                    </button>
                    {checklistText && (
                      <button
                        type="button"
                        onClick={copyChecklist}
                        className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                      >
                        <Icon name="clipboard-check" className="h-3.5 w-3.5" />
                        Copy to clipboard
                      </button>
                    )}
                  </div>
                  {checklistText && (
                    <textarea
                      readOnly
                      value={checklistText}
                      rows={Math.min(10, checklistText.split('\n').length + 1)}
                      className="mt-3 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
                    />
                  )}
                  {copyStatus && <p className="mt-1.5 text-xs text-slate-500">{copyStatus}</p>}
                </div>
              )}

              {data.limitations.length > 0 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Icon name="info" className="h-3.5 w-3.5" />
                    Limitations
                  </h3>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-500">
                    {data.limitations.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default OrganiserImprovements;
