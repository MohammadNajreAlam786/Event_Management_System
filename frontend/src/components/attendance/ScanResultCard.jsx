import { formatDateTime } from '../../utils/eventMeta.js';
import Icon from '../ui/Icon.jsx';

/**
 * The outcome of one scan / check-in attempt. Uses an explicit label + icon
 * glyph alongside colour so the state is not conveyed by colour alone (§55).
 *
 * result shape:
 *   { kind: 'success',  participantName, checkedInAt, status }
 *   { kind: 'already',  participantName, checkedInAt }
 *   { kind: 'invalid',  message }
 */
const THEME = {
  success: { box: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-800', iconBox: 'bg-emerald-100 text-emerald-700', icon: 'check-circle', title: 'Attendance Marked' },
  already: { box: 'border-amber-200 bg-amber-50', text: 'text-amber-800', iconBox: 'bg-amber-100 text-amber-700', icon: 'alert-circle', title: 'Already Checked In' },
  invalid: { box: 'border-rose-200 bg-rose-50', text: 'text-rose-800', iconBox: 'bg-rose-100 text-rose-700', icon: 'x-circle', title: 'Invalid QR Code' },
};

const ScanResultCard = ({ result, eventTitle }) => {
  if (!result) return null;
  const theme = THEME[result.kind] ?? THEME.invalid;

  return (
    <div className={`rounded-lg border p-4 ${theme.box}`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${theme.iconBox}`}
          aria-hidden="true"
        >
          <Icon name={theme.icon} className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${theme.text}`}>{theme.title}</p>

          {result.kind === 'invalid' ? (
            <p className="mt-1 text-sm text-slate-600">{result.message}</p>
          ) : (
            <dl className="mt-2 space-y-1 text-sm text-slate-700">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-500">Participant</dt>
                <dd className="font-medium text-slate-900">{result.participantName}</dd>
              </div>
              {eventTitle && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-slate-500">Event</dt>
                  <dd className="min-w-0 break-words">{eventTitle}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-500">Status</dt>
                <dd className="font-medium">Present</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-500">Checked in</dt>
                <dd>{formatDateTime(result.checkedInAt)}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanResultCard;
