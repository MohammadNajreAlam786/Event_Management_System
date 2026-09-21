import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import certificateService from '../../services/certificateService.js';
import StatCard from '../../components/StatCard.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
import RegistrationStatusBadge from '../../components/event/RegistrationStatusBadge.jsx';
import AttendanceStatusBadge from '../../components/attendance/AttendanceStatusBadge.jsx';
import CertificateStatusBadge from '../../components/certificate/CertificateStatusBadge.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import SuccessBanner from '../../components/ui/SuccessBanner.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';

const fileNameFor = (title) =>
  `${String(title || 'Event').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'Event'}_Certificate.pdf`;

/** /organiser/events/:id/certificates — certificate management for an owned event. */
const OrganiserEventCertificates = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');

  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);
  const [actionError, setActionError] = useState('');
  const [busyCertId, setBusyCertId] = useState(null);

  const load = useCallback(
    (opts = {}) => {
      if (!opts.quiet) setLoadState('loading');
      certificateService
        .getEligibility(id)
        .then((res) => {
          setData(res);
          setLoadState('ready');
        })
        .catch((err) => {
          if (err.status === 401) {
            navigate('/login', { replace: true });
            return;
          }
          setError(
            err.status === 403
              ? 'You can only manage certificates for your own events.'
              : err.status === 404
                ? 'Event not found.'
                : err.message || 'Unable to load certificate information. Please try again.',
          );
          setLoadState('error');
        });
    },
    [id, navigate],
  );

  useEffect(() => load(), [load]);

  const doGenerate = async () => {
    setGenerating(true);
    setActionError('');
    setGenResult(null);
    try {
      const res = await certificateService.generate(id);
      setGenResult(res.summary);
      load({ quiet: true });
    } catch (err) {
      setActionError(err.message || 'Certificate generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadCert = async (cert, title) => {
    setBusyCertId(cert.id);
    setActionError('');
    try {
      await certificateService.download(cert.id, fileNameFor(title));
    } catch (err) {
      setActionError(err.message || 'Could not download this certificate.');
    } finally {
      setBusyCertId(null);
    }
  };

  if (loadState === 'loading') {
    return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;
  }
  if (loadState === 'error') {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Link to="/organiser/events" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to My Events
        </Link>
      </div>
    );
  }

  const { event, summary, rows } = data;
  const completed = event.eventCompleted;

  return (
    <section className="space-y-6">
      <div>
        <Link to={`/organiser/events/${id}`} className="text-xs font-medium text-indigo-600 hover:underline">
          ← Event details
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">{event.title}</h1>
          <EventStatusBadge status={event.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Participation certificates for participants who attended this event.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Participants" value={summary.totalParticipants} accent="indigo" icon="users" />
        <StatCard label="Attended" value={summary.present} accent="emerald" icon="check-circle" />
        <StatCard label="Eligible" value={summary.eligible} accent="amber" icon="award" />
        <StatCard label="Issued" value={summary.issued} accent="slate" icon="file-text" />
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionHeader icon="award" title="Generate certificates" />
            <p className="mt-0.5 text-xs text-slate-500">
              {completed
                ? 'Issues a certificate to every eligible participant who does not have one yet. Safe to run again.'
                : 'Available once the event is marked Completed.'}
            </p>
          </div>
          <button
            type="button"
            onClick={doGenerate}
            disabled={!completed || generating || summary.totalParticipants === 0}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate certificates'}
          </button>
        </div>

        {genResult && (
          <div className="mt-4">
            <SuccessBanner
              message={
                <>
                  <span className="block font-semibold">Generation complete</span>
                  <ul className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 sm:grid-cols-3">
                    <li>Eligible: <span className="font-semibold">{genResult.eligible}</span></li>
                    <li>Generated: <span className="font-semibold">{genResult.generated}</span></li>
                    <li>Already issued: <span className="font-semibold">{genResult.alreadyIssued}</span></li>
                    <li>Not eligible: <span className="font-semibold">{genResult.notEligible}</span></li>
                    {genResult.failed > 0 && (
                      <li className="text-rose-700">Failed: <span className="font-semibold">{genResult.failed}</span></li>
                    )}
                  </ul>
                </>
              }
            />
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No participants"
              description="No one has registered for this event, so there are no certificates to issue."
              icon="award"
            />
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Participant</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Registration</th>
                <th className="px-4 py-3 font-medium">Attendance</th>
                <th className="px-4 py-3 font-medium">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.userId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 align-top font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-3 align-top text-slate-600">{r.email ?? '—'}</td>
                  <td className="px-4 py-3 align-top">
                    <RegistrationStatusBadge status={r.registrationStatus} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <AttendanceStatusBadge status={r.attendanceStatus} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    {r.certificate ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <CertificateStatusBadge status={r.certificate.status} />
                        <span className="text-xs text-slate-500">{r.certificate.certificateNumber}</span>
                        <button
                          type="button"
                          disabled={busyCertId === r.certificate.id}
                          onClick={() => downloadCert(r.certificate, event.title)}
                          className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {busyCertId === r.certificate.id ? '…' : 'Download'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">{r.eligible ? 'Eligible' : r.reason || 'Not eligible'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </section>
  );
};

export default OrganiserEventCertificates;
