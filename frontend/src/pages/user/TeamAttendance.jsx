import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import teamWorkService from '../../services/teamWorkService.js';
import QrScanner from '../../components/attendance/QrScanner.jsx';
import ScanResultCard from '../../components/attendance/ScanResultCard.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';

/** Narrow scanner page for a participant with an accepted QR-attendance task. */
const TeamAttendance = () => {
  const { eventId } = useParams();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const inFlight = useRef(false);

  const checkIn = async (credential) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const data = await teamWorkService.checkInAttendance(eventId, credential);
      setResult({ kind: 'success', participantName: data.participant.name, checkedInAt: data.attendance.checkedInAt });
    } catch (err) {
      if (err.status === 409 && err.data?.alreadyCheckedIn) {
        setResult({ kind: 'already', participantName: err.data.participant?.name ?? 'Participant', checkedInAt: err.data.attendance?.checkedInAt ?? null });
      } else {
        setResult({ kind: 'invalid', message: err.message || 'This QR credential could not be verified.' });
      }
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  return (
    <section className="max-w-2xl space-y-5">
      <Link to="/user/team-work" className="text-sm font-medium text-indigo-600 hover:underline">← Back to Team Work</Link>
      <PageHeader title="QR Attendance" description="Scan or manually verify participant QR credentials for your assigned attendance task." />
      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
        This permission is limited to attendance check-in for this event. It does not grant organiser or event-management access.
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <QrScanner onDetected={checkIn} busy={busy} />
        {result && <div className="mt-4"><ScanResultCard result={result} eventTitle="this event" /></div>}
      </div>
    </section>
  );
};

export default TeamAttendance;
