import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';

import notificationService from '../../services/notificationService.js';
import EmptyState from '../../components/EmptyState.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { formatDateTime } from '../../utils/eventMeta.js';

const TYPE_ICON = {
  EVENT_REGISTRATION_CONFIRMED: 'calendar-check',
  EVENT_CANCELLED: 'x-circle',
  EVENT_UPDATED: 'info',
  ATTENDANCE_RECORDED: 'qr-code',
  CERTIFICATE_ISSUED: 'award',
  FEEDBACK_AVAILABLE: 'message-square',
};

const TYPE_LABEL = {
  EVENT_REGISTRATION_CONFIRMED: 'Registration',
  EVENT_CANCELLED: 'Event cancelled',
  EVENT_UPDATED: 'Event updated',
  ATTENDANCE_RECORDED: 'Attendance',
  CERTIFICATE_ISSUED: 'Certificate',
  FEEDBACK_AVAILABLE: 'Feedback',
};

/** /user/notifications — the participant notification centre. */
const UserNotifications = () => {
  const navigate = useNavigate();
  const { refreshUnread } = useOutletContext() ?? {};
  const [items, setItems] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | unread
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => {
    let active = true;
    setLoadState('loading');
    setError('');
    notificationService
      .list({ unread: filter === 'unread', limit: 50 })
      .then((data) => {
        if (!active) return;
        setItems(data.notifications);
        setLoadState('ready');
        refreshUnread?.();
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Unable to load your notifications. Please try again.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [filter, navigate, refreshUnread]);

  useEffect(() => load(), [load, reloadKey]);

  const markOne = async (n) => {
    if (n.read) return;
    try {
      await notificationService.markRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      refreshUnread?.();
    } catch {
      /* non-fatal */
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await notificationService.markAllRead();
      setReloadKey((k) => k + 1);
      refreshUnread?.();
    } catch (err) {
      setError(err.message || 'Could not mark all as read.');
    } finally {
      setBusy(false);
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Notifications</h1>
          <p className="mt-0.5 text-sm text-slate-500">Updates about your events, attendance and certificates.</p>
        </div>
        <button
          type="button"
          onClick={markAll}
          disabled={busy || unreadCount === 0}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Mark all as read'}
        </button>
      </div>

      <div className="flex gap-1">
        {['all', 'unread'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize ${
              filter === f
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loadState === 'error' && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {loadState === 'loading' && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {loadState === 'ready' && items.length === 0 && (
        <EmptyState
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description={
            filter === 'unread'
              ? "You're all caught up."
              : 'Notifications about your registrations, attendance and certificates will appear here.'
          }
          icon="bell"
        />
      )}

      {loadState === 'ready' && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border p-4 ${
                n.read ? 'border-slate-200 bg-white' : 'border-indigo-200 bg-indigo-50/60'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      n.read ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-600'
                    }`}
                  >
                    <Icon name={TYPE_ICON[n.type] ?? 'bell'} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" aria-label="Unread" />}
                    <span className="font-medium text-slate-900">{n.title}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
                      {TYPE_LABEL[n.type] ?? 'Update'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateTime(n.createdAt)}
                    {n.event ? ` · ${n.event.title}` : ''}
                  </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {n.type === 'CERTIFICATE_ISSUED' && (
                    <Link
                      to="/user/certificates"
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      View
                    </Link>
                  )}
                  {n.type === 'FEEDBACK_AVAILABLE' && (
                    <Link
                      to="/user/feedback"
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Give feedback
                    </Link>
                  )}
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markOne(n)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default UserNotifications;
