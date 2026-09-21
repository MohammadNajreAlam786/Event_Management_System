import Icon from '../ui/Icon.jsx';

const TONE_STYLE = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'check-circle' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'alert-triangle' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-500', icon: 'info' },
};

/** A small list of observations (strengths or improvement areas) — title + detail, no action attached. */
const NoteList = ({ items, tone = 'slate' }) => {
  const style = TONE_STYLE[tone] ?? TONE_STYLE.slate;
  return (
    <ul className="space-y-2">
      {items.map((n, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <li key={`${n.title}-${i}`} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.text}`}>
            <Icon name={style.icon} className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-slate-800">{n.title}</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-slate-500">{n.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default NoteList;
