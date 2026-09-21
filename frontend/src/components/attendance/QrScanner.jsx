import { useCallback, useEffect, useRef, useState } from 'react';

import Icon from '../ui/Icon.jsx';

const REGION_ID = 'qr-scanner-region';

// html5-qrcode is ~330 kB — only pulled in when an organiser actually opens the
// camera, so it never weighs on the initial bundle.
const loadScannerLib = () => import('html5-qrcode').then((m) => m.Html5Qrcode);

/**
 * Camera QR scanner for the organiser attendance page.
 *
 * - The camera is only started on an explicit click, so the permission prompt
 *   is expected (§18).
 * - Denied permission → a friendly message + "Try Again" (§19).
 * - No usable camera → a note + the manual-entry fallback (§16, §20). Manual
 *   entry is organiser-only: this component is only ever rendered inside the
 *   ORGANISER-gated attendance page.
 *
 * On a successful decode (or a manual submit) `onDetected(text)` is called.
 * `busy` (parent is verifying with the backend) pauses further decoding.
 */
const QrScanner = ({ onDetected, busy = false }) => {
  const scannerRef = useRef(null);
  const runningRef = useRef(false);
  const lastRef = useRef({ text: '', at: 0 });
  const [phase, setPhase] = useState('idle'); // idle | starting | scanning | denied | nocamera | error
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');

  const stop = useCallback(async () => {
    const inst = scannerRef.current;
    if (inst && runningRef.current) {
      runningRef.current = false;
      try {
        await inst.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  useEffect(() => () => { void stop(); }, [stop]);

  const handleDecoded = useCallback(
    (text) => {
      const now = Date.now();
      if (busy) return;
      if (text === lastRef.current.text && now - lastRef.current.at < 2500) return;
      lastRef.current = { text, at: now };
      onDetected(text);
    },
    [busy, onDetected],
  );

  const start = useCallback(async () => {
    setPhase('starting');
    try {
      if (!scannerRef.current) {
        const Html5Qrcode = await loadScannerLib();
        scannerRef.current = new Html5Qrcode(REGION_ID, { verbose: false });
      }
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (vw, vh) => {
            const m = Math.max(160, Math.floor(Math.min(vw, vh) * 0.7));
            return { width: m, height: m };
          },
        },
        handleDecoded,
        () => {
          /* per-frame "no QR in view" — expected, ignore */
        },
      );
      runningRef.current = true;
      setPhase('scanning');
    } catch (err) {
      const name = err?.name || '';
      const msg = String(err?.message || err || '').toLowerCase();
      if (name === 'NotAllowedError' || msg.includes('permission') || msg.includes('denied')) {
        setPhase('denied');
      } else if (name === 'NotFoundError' || msg.includes('no camera') || msg.includes('not found') || msg.includes('requested device')) {
        setPhase('nocamera');
        setManualOpen(true);
      } else {
        setPhase('error');
        setManualOpen(true);
      }
    }
  }, [handleDecoded]);

  const submitManual = (e) => {
    e.preventDefault();
    const v = manualValue.trim();
    if (!v || busy) return;
    onDetected(v);
  };

  return (
    <div className="space-y-3">
      {/* Camera preview region — html5-qrcode injects the <video> here. */}
      <div
        id={REGION_ID}
        className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-slate-900"
        style={{ minHeight: phase === 'scanning' || phase === 'starting' ? undefined : 0 }}
      />

      {phase === 'idle' && (
        <div className="text-center">
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Icon name="qr-code" className="h-4 w-4" />
            Start camera
          </button>
          <p className="mt-2 text-xs text-slate-500">Point the camera at the participant&apos;s attendance QR.</p>
        </div>
      )}

      {phase === 'starting' && <p className="text-center text-sm text-slate-500">Starting camera…</p>}

      {phase === 'scanning' && (
        <div className="flex items-center justify-center gap-3">
          <p className="text-sm text-slate-600">{busy ? 'Verifying…' : 'Scanning — hold the QR steady in the frame.'}</p>
          <button
            type="button"
            onClick={() => { void stop(); setPhase('idle'); }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Stop
          </button>
        </div>
      )}

      {phase === 'denied' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>Camera access is required to scan attendance QR codes.</p>
          <p className="mt-1 text-xs text-amber-700">
            Allow camera access in your browser, then try again. You can also enter the code manually below.
          </p>
          <button
            type="button"
            onClick={() => { setPhase('idle'); void start(); }}
            className="mt-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            Try Again
          </button>
        </div>
      )}

      {phase === 'nocamera' && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          No camera was found on this device. Enter the participant&apos;s QR code manually below.
        </div>
      )}

      {phase === 'error' && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p>The camera could not be started.</p>
          <button
            type="button"
            onClick={() => { setPhase('idle'); void start(); }}
            className="mt-2 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setManualOpen((o) => !o)}
          className="text-xs font-medium text-indigo-600 hover:underline"
        >
          {manualOpen ? 'Hide manual entry' : 'Enter QR code manually'}
        </button>
        {manualOpen && (
          <form onSubmit={submitManual} className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Paste the participant's QR credential"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={busy || !manualValue.trim()}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check in
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default QrScanner;
