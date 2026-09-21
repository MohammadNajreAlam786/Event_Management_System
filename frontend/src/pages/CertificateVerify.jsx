import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import certificateService from '../services/certificateService.js';
import { formatDate } from '../utils/eventMeta.js';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import Icon from '../components/ui/Icon.jsx';

const Row = ({ label, children }) => (
  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
    <dt className="w-40 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="text-sm text-slate-800">{children}</dd>
  </div>
);

/** /verify and /verify/:code — public certificate verification. */
const CertificateVerify = () => {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(codeParam ?? '');
  const [state, setState] = useState(codeParam ? 'loading' : 'idle'); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!codeParam) return;
    let active = true;
    setState('loading');
    certificateService
      .verify(codeParam)
      .then((data) => {
        if (!active) return;
        setResult(data);
        setState('done');
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Could not verify this certificate right now. Please try again.');
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [codeParam]);

  const submit = (e) => {
    e.preventDefault();
    const v = input.trim();
    if (v) navigate(`/verify/${encodeURIComponent(v)}`);
  };

  const cert = result?.certificate;
  const valid = result?.valid;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <Icon name="shield-check" className="h-5 w-5" />
        </span>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Verify a certificate</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the verification code printed on a participation certificate to confirm it is genuine.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. ABCD-1234-EFGH-5678"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Verify
        </button>
      </form>

      {state === 'loading' && <div className="h-40 animate-pulse rounded-lg bg-slate-100" />}

      {state === 'error' && <ErrorBanner message={error} />}

      {state === 'done' && !valid && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full border border-rose-300 text-rose-700"
              aria-hidden="true"
            >
              <Icon name="x-circle" className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-rose-800">Certificate not found or invalid</p>
          </div>
          <p className="mt-1 text-sm text-rose-700">
            No issued certificate matches this code. Check the code and try again.
          </p>
        </div>
      )}

      {state === 'done' && valid && cert && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300 text-emerald-700"
              aria-hidden="true"
            >
              <Icon name="check-circle" className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-emerald-800">Valid certificate</p>
          </div>
          <dl className="mt-4 space-y-2">
            <Row label="Participant">{cert.recipientName}</Row>
            <Row label="Event">{cert.eventTitle}</Row>
            <Row label="Event date">{formatDate(cert.eventDate)}</Row>
            <Row label="Certificate No.">{cert.certificateNumber}</Row>
            <Row label="Issued">{formatDate(cert.issueDate)}</Row>
            <Row label="Issued by">
              {cert.issuerName ? `${cert.issuerName}, ` : ''}
              {cert.institution}
            </Row>
          </dl>
        </div>
      )}
    </section>
  );
};

export default CertificateVerify;
