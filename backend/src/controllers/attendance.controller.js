import { asyncHandler } from '../utils/asyncHandler.js';
import * as attendanceService from '../services/attendance.service.js';

/* ---------------- Participant QR (USER, owner) ---------------- */

/** GET /api/registrations/:registrationId/qr */
export const getMyQr = asyncHandler(async (req, res) => {
  const data = await attendanceService.getMyQr({
    userId: req.user.id,
    registrationId: req.params.registrationId,
  });
  res.status(200).json({ success: true, data });
});

/* ---------------- Organiser check-in + views (ORGANISER, owner) ---------------- */

/** POST /api/events/:id/attendance/check-in */
export const checkIn = asyncHandler(async (req, res) => {
  try {
    const data = await attendanceService.checkInByCredential({
      organiserId: req.user.id,
      eventId: req.params.id,
      credential: req.body?.credential,
    });
    res.status(201).json({ success: true, data, message: 'Attendance marked.' });
  } catch (err) {
    // Already-present is an expected outcome, not a failure — return the
    // original check-in details so the UI can show them (§30). No new record.
    if (err && err.code === attendanceService.ALREADY_CHECKED_IN) {
      res.status(409).json({ success: false, message: err.message, data: err.payload });
      return;
    }
    throw err;
  }
});

/** GET /api/events/:id/attendance */
export const listEventAttendance = asyncHandler(async (req, res) => {
  const data = await attendanceService.listEventAttendance({
    organiserId: req.user.id,
    eventId: req.params.id,
    status: req.query.status,
    search: req.query.search,
  });
  res.status(200).json({ success: true, data });
});

/** GET /api/events/:id/attendance/summary */
export const getAttendanceSummary = asyncHandler(async (req, res) => {
  const data = await attendanceService.getEventAttendanceSummary({
    organiserId: req.user.id,
    eventId: req.params.id,
  });
  res.status(200).json({ success: true, data });
});

const slugify = (value) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'event';

const todayDMY = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
};

/**
 * GET /api/events/:id/attendance/export — CSV attendance sheet. ORGANISER
 * (owner) | ADMIN only; ownership is enforced in the service, never trusted
 * from a query/body id.
 */
export const exportAttendance = asyncHandler(async (req, res) => {
  const { csv, event } = await attendanceService.getEventAttendanceExport({
    actor: { id: req.user.id, role: req.user.role },
    eventId: req.params.id,
  });
  const filename = `${slugify(event.title)}-attendance-${todayDMY()}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
});
