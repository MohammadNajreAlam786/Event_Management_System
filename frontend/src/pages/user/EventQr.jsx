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
          <QrImage value={qr.payload} size={240} />
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
