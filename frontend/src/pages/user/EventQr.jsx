import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import attendanceService from '../../services/attendanceService.js';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import RegistrationStatusBadge from '../../components/event/RegistrationStatusBadge.jsx';
import AttendanceStatusBadge from '../../components/attendance/AttendanceStatusBadge.jsx';
import QrImage from '../../components/attendance/QrImage.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import SuccessBanner from '../../components/ui/SuccessBanner.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { formatDateTime } from '../../utils/eventMeta.js';

const Row = ({ label, children }) => (
  <div className="flex gap-2">
    <dt className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="min-w-0 text-sm text-slate-800">{children}</dd>
  </div>
);

/** /user/my-events/:registrationId/qr — the participant's attendance QR. */
const EventQr = () => {
  const { registrationId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    attendanceService
      .getMyQr(registrationId)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(
          err.status === 403
            ? 'You can only view your own attendance QR.'
            : err.status === 404
              ? 'This registration could not be found.'
              : err.message || 'Unable to load your attendance QR. Please try again.',
        );
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [registrationId, navigate]);

  if (loadState === 'loading') {
    return <div className="mx-auto h-80 max-w-md animate-pulse rounded-lg bg-slate-100" />;
  }
  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <ErrorBanner message={error} />
        <Link to="/user/my-events" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Back to My Events
        </Link>
      </div>
    );
  }

  const { event, qr, attendance } = data;
  const present = attendance?.status === 'PRESENT';

  const copyCredential = async () => {
    try {
      await navigator.clipboard.writeText(qr.credential);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Unable to copy the attendance credential. Select and copy it manually.');
    }
  };

  return (
    <section className="mx-auto max-w-md space-y-5">
      <Link to="/user/my-events" className="text-xs font-medium text-indigo-600 hover:underline">
        ← My Events
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-slate-900">{event.title}</h1>
          <EventStatusBadge status={event.status} />
        </div>

        <div className="mt-4 flex justify-center">
          <QrImage value={qr.credential} size={240} />
        </div>

        {present ? (
          <div className="mt-4">
            <SuccessBanner
              message={
                <>
                  <span className="block font-semibold">Attendance Recorded</span>
                  <span className="mt-0.5 block">Checked in {formatDateTime(attendance.checkedInAt)}.</span>
                </>
              }
            />
          </div>
        ) : (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
            <Icon name="qr-code" className="h-3.5 w-3.5 shrink-0" />
            Show this code to the organiser at the event to be checked in.
          </p>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-sm font-medium text-slate-800">Attendance Credential</p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              readOnly
              value={qr.credential}
              aria-label="Attendance credential"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-lg font-semibold tracking-[0.12em] text-slate-800 outline-none"
            />
            <button
              type="button"
              onClick={copyCredential}
              className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Use this credential for manual attendance verification if QR scanning is unavailable.</p>
        </div>

        <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4">
          <Row label="When">{formatDateTime(event.startDate)}</Row>
          <Row label="Where">{event.venue}</Row>
          <Row label="Registration">
            <RegistrationStatusBadge status={data.registration.status} />
          </Row>
          <Row label="Attendance">
            <AttendanceStatusBadge status={attendance?.status} />
          </Row>
        </dl>
      </div>
    </section>
  );
};

export default EventQr;
