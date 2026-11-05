import { useEffect, useState, useCallback } from 'react';
import Icon from './ui/Icon.jsx';

const STORAGE_KEY = 'eventflow_cinematic_intro_seen';


const CinematicIntro = ({ onComplete, forcePlay = false }) => {
  const [stage, setStage] = useState('brand'); // 'brand' | 'fading' | 'done'
  const [isVisible, setIsVisible] = useState(true);

  const handleFinish = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors in private browsing
    }
    setStage('done');
    setIsVisible(false);
    if (onComplete) onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    handleFinish();
  }, [handleFinish]);

  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const urlParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const forceIntroFromUrl =
      urlParams?.get('intro') === 'true' || urlParams?.get('intro') === '1';

    // Check session storage if not forced
    const alreadySeen =
      typeof window !== 'undefined' &&
      !forcePlay &&
      !forceIntroFromUrl &&
      Boolean(sessionStorage.getItem(STORAGE_KEY));

    if (prefersReducedMotion || alreadySeen) {
      setStage('done');
      setIsVisible(false);
      if (onComplete) onComplete();
      return undefined;
    }

    setStage('brand');
    setIsVisible(true);

    // Stage 1 -> Stage 2 (start fade after 2.4s)
    const fadeTimer = window.setTimeout(() => {
      setStage('fading');
    }, 2400);

    // Stage 2 -> Complete after 3.3s (total duration 3-4 seconds)
    const doneTimer = window.setTimeout(() => {
      handleFinish();
    }, 3300);

    // Keyboard listener: Escape or Enter skips intro
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [forcePlay, handleFinish, onComplete]);

  if (!isVisible || stage === 'done') {
    return null;
  }

  const isFading = stage === 'fading';

  return (
    <aside
      aria-label="EventFlow Introduction"
      aria-live="polite"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white transition-all duration-900 ease-out ${isFading ? 'pointer-events-none opacity-0 scale-102' : 'opacity-100 scale-100'
        }`}
    >
      {/* Background ambient radial glow */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,rgba(99,102,241,0.22),rgba(15,23,42,0))]"
        aria-hidden="true"
      />

      {/* Top action: Skip Intro button */}
      <div className="absolute top-6 right-6 z-10 sm:top-8 sm:right-8">
        <button
          type="button"
          onClick={handleSkip}
          className="group flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/80 px-4 py-1.5 text-xs font-medium text-slate-300 shadow-lg backdrop-blur-md transition-all duration-200 hover:border-indigo-500/80 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          aria-label="Skip introduction animation (Press Esc)"
        >
          <span>Skip Intro</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 transition-colors group-hover:bg-slate-700 group-hover:text-slate-200">
            Esc
          </span>
        </button>
      </div>

      {/* Brand reveal container */}
      <div className="relative flex flex-col items-center px-6 text-center">
        {/* Glowing Brand Icon */}
        <div className="animate-ef-scale-up relative">
          <div className="animate-ef-glow-pulse flex h-18 w-18 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 shadow-2xl sm:h-20 sm:w-20">
            <Icon name="calendar-check" className="h-10 w-10 text-white" strokeWidth={2.2} />
          </div>
          {/* Subtle ring accent */}
          <div className="pointer-events-none absolute -inset-2 rounded-3xl border border-indigo-400/20" />
        </div>

        {/* Brand Wordmark with sleek animated shimmer gradient */}
        <div className="animate-ef-fade-in-up delay-150 mt-6">
          <h1 className="animate-ef-title-shimmer bg-gradient-to-r from-white via-indigo-100 to-violet-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            EventFlow
          </h1>
        </div>

        {/* Moving / expanding accent line */}
        <div className="mt-4 h-0.5 w-40 overflow-hidden rounded-full bg-slate-800 sm:w-56">
          <div className="animate-ef-line-expand h-full bg-gradient-to-r from-indigo-500 via-violet-400 to-indigo-500" />
        </div>

        {/* Elegant tagline */}
        <p className="animate-ef-fade-in delay-250 mt-4 text-xs font-medium uppercase tracking-widest text-indigo-300/80 sm:text-sm">
          Intelligent Event Discovery &amp; Management
        </p>

        {/* Feature highlight chips */}
        <div className="animate-ef-fade-in delay-400 mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400 sm:text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/80 bg-slate-900/60 px-3 py-1">
            <Icon name="clipboard-check" className="h-3 w-3 text-indigo-400" />
            Smart Planning
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/80 bg-slate-900/60 px-3 py-1">
            <Icon name="qr-code" className="h-3 w-3 text-violet-400" />
            QR Check-in
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/80 bg-slate-900/60 px-3 py-1">
            <Icon name="award" className="h-3 w-3 text-emerald-400" />
            Certificates
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/80 bg-slate-900/60 px-3 py-1">
            <Icon name="sparkles" className="h-3 w-3 text-amber-400" />
            AI Insights
          </span>
        </div>
      </div>

      {/* Progress timeline bar across bottom of intro */}
      <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden bg-slate-900/80">
        <div className="animate-ef-progress h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
      </div>
    </aside>
  );
};

export default CinematicIntro;
