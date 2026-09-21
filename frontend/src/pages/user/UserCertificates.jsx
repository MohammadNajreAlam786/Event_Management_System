import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import certificateService from '../../services/certificateService.js';
import EmptyState from '../../components/EmptyState.jsx';
import CertificateStatusBadge from '../../components/certificate/CertificateStatusBadge.jsx';
import ErrorBanner from '../../components/ui/ErrorBanner.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { formatDate } from '../../utils/eventMeta.js';

const fileNameFor = (title) =>
  `${String(title || 'Event').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'Event'}_Certificate.pdf`;

/** /user/certificates — the participant's own certificates. */
const UserCertificates = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    setError('');
    certificateService
      .getMine()
      .then((data) => {
        if (!active) return;
        setRows(data);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Unable to load your certificates. Please try again.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [navigate, reloadKey]);

  const run = async (id, fn) => {
    setBusyId(id);
    setActionError('');
    try {
      await fn();
    } catch (err) {
      setActionError(err.message || 'Could not open this certificate. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900">My certificates</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Certificates for events you attended. Each has a verification code others can check.
        </p>
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      {loadState === 'error' && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {loadState === 'loading' && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {loadState === 'ready' && rows.length === 0 && (
        <EmptyState
          title="No certificates yet"
          description="When you attend an event and the organiser issues certificates, yours will appear here."
          icon="award"
        />
      )}

      {loadState === 'ready' && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                    <Icon name="award" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{c.eventTitle}</span>
                    <CertificateStatusBadge status={c.status} />
                  </div>
                  <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="text-slate-400">Certificate No.</dt>
                      <dd className="font-medium text-slate-700">{c.certificateNumber}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-slate-400">Issued</dt>
                      <dd>{formatDate(c.issueDate)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-slate-400">Event date</dt>
                      <dd>{formatDate(c.eventDate)}</dd>
                    </div>
                    <div className="flex min-w-0 gap-2">
                      <dt className="shrink-0 text-slate-400">Verification</dt>
                      <dd className="truncate font-mono text-xs text-slate-600">{c.verificationCode}</dd>
                    </div>
                  </dl>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => run(c.id, () => certificateService.openInNewTab(c.id))}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => run(c.id, () => certificateService.download(c.id, fileNameFor(c.eventTitle)))}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {busyId === c.id ? 'Preparing…' : 'Download'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-400">
        Anyone can confirm a certificate at <Link to="/verify" className="text-indigo-600 hover:underline">the verification page</Link>{' '}
        using its code.
      </p>
    </section>
  );
};

export default UserCertificates;
