/**
 * Shared pill-badge tone palette (Phase 12 design system). Every status/
 * priority/sentiment badge in the app renders through `Badge` with one of
 * these tones, so a "success" reads the same shade of green everywhere,
 * a "danger" the same red, etc. Colour is always paired with a text label —
 * never the only signal (see each badge component's LABELS map).
 */
export const TONE_CLASSES = Object.freeze({
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  'slate-outline': 'bg-white text-slate-500 border-slate-300',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  'violet-outline': 'bg-white text-violet-500 border-violet-200',
});

export const toneClass = (tone) => TONE_CLASSES[tone] ?? TONE_CLASSES.slate;
