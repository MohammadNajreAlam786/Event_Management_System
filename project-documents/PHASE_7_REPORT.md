# PHASE 7 IMPLEMENTATION REPORT

**AI-Powered Event Planning & Management System with QR-Based Attendance**
Phase 7 — QR-Based Attendance & Event Check-In · completed 2026-09-08

---

## 1. Summary

Phase 7 connects the Phase-6 registration system to event-day attendance via QR codes.

- **Participant side** — every active registration now yields a **signed, opaque
  QR credential**. A clean **Attendance QR** page (`/user/my-events/:registrationId/qr`,
  linked from *My Events*) shows the event, the QR, and the registration +
  attendance status. After check-in the page shows *"Attendance Recorded"* and
  keeps the QR visible. *My Events* rows show a **Present** badge once checked in.
- **Organiser side** — a new **Attendance** page (`/organiser/events/:id/attendance`,
  linked from event details) with a live summary dashboard (Registered / Present /
  Not checked in / Attendance %), a **camera QR scanner** (with graceful
  permission handling and an organiser-only manual-entry fallback), a scan-result
  card (Attendance Marked / Already Checked In / Invalid QR Code), a recent
  check-ins list, and a searchable/filterable attendance table.
- **Backend** — a dedicated **`Attendance` model** (not a flag on Registration),
  a QR credential utility, an attendance service/controller, and four endpoints.
  Duplicate check-in is prevented by a **unique database index**, not just the UI.

Not touched: certificates, feedback, sentiment, post-event analytics,
notifications (later phases). The Phase-5 AI Planning Assistant and the Phase-6
registration workflow are unchanged except that `GET /api/registrations/mine`
now also returns an `attendance` field per row.

---

## 2. Complete Workflow

```
USER
  │  browses events, registers (Phase 6)
  ▼
Registration  { user, event, status: REGISTERED, qrNonce }
  │  GET /api/registrations/:id/qr   (owner only, active only)
  ▼
QR Credential   base64url({v,rid,eid,n}) . base64url(HMAC-SHA256(secret, …))
  │  rendered as  {"typ":"EVENT_ATTENDANCE","cred":"<token>"}
  ▼
Event Day  — organiser sets the event to UPCOMING / ONGOING
  │
  ▼
Organiser Scanner   (camera or manual entry)
  │  POST /api/events/:eventId/attendance/check-in  { credential }
  ▼
Verification   ownership → event status → signature → event match → nonce →
               registration active → not already checked in
  ▼
Attendance   { registration, event, user, checkedInBy, checkedInAt, status:'PRESENT' }
  │  unique index on `registration`  ⇒  exactly one row, ever
  ▼
Attendance Status
  • participant : "Present" badge in My Events, "Attendance Recorded" on the QR page
  • organiser   : live summary + attendance list + recent check-ins
```

---

## 3. Architecture

**Frontend (React 19 + Vite 6 + Tailwind v4)**

| Piece | File |
| --- | --- |
| QR generation | `components/attendance/QrImage.jsx` — `qrcode` lib → `<img>` data URL |
| Camera scanner | `components/attendance/QrScanner.jsx` — `html5-qrcode` (**lazy `import()`** — not in the initial bundle), permission handling, manual-entry fallback |
| Scan result | `components/attendance/ScanResultCard.jsx` — success / already / invalid, icon + label (not colour alone) |
| Attendance badge | `components/attendance/AttendanceStatusBadge.jsx` |
| Participant QR page | `pages/user/EventQr.jsx` |
| Organiser attendance page | `pages/organiser/OrganiserEventAttendance.jsx` |
| API client | `services/attendanceService.js` (built on the shared Axios instance) |

**Backend (Node 24 + Express 4 + Mongoose 8, ESM)**

| Piece | File |
| --- | --- |
| QR credential | `utils/qrToken.js` — `issueQrNonce`, `signAttendanceToken`, `verifyAttendanceToken`, `buildQrPayload`, `extractCredential` |
| Attendance model | `models/attendance.model.js` |
| Domain logic | `services/attendance.service.js` — `getMyQr`, `checkInByCredential`, `getEventAttendanceSummary`, `listEventAttendance`, `attendanceByRegistrationForUser` |
| Controllers | `controllers/attendance.controller.js` |
| Routes | added to `routes/event.routes.js` (organiser) + `routes/registration.routes.js` (participant QR) — no new router mount needed |
| Config | `config/env.js` — `env.qr.secret` (`QR_TOKEN_SECRET`, optional) |

**MongoDB** — database `event_management_system` (unchanged). One new collection,
`attendances`. One new field on `registrations` (`qrNonce`, `select: false`).

**QR generation** — done in the browser by the `qrcode` library from the
credential the API returns. The backend adds no QR/image dependency.

**QR verification** — the backend recomputes the HMAC with a constant-time
compare, parses `{ rid, eid, n }`, and checks it against the live registration.

**Attendance model** — a standalone document per check-in (see §4 / §10).

---

## 4. Database

### `registrations` (Phase 6 model, one field added)

```
{ user, event, status: REGISTERED | CANCELLED, registeredAt, cancelledAt,
  qrNonce: String | null   // Phase 7 — select:false, never returned by any API
}
indexes:  { user:1, event:1 } unique      (one registration per pair)
          { event:1, status:1 }
```

`qrNonce` is issued when a registration becomes active (create / re-register)
and **rotated on cancel**, so a cancelled registration's previously displayed QR
image no longer verifies.

### `attendances` (new)

```
{ registration : ObjectId → Registration   (required)
  event        : ObjectId → Event          (required)
  user         : ObjectId → User           (required)
  checkedInBy  : ObjectId → User           (required — the organiser)
  checkedInAt  : Date                       (default now)
  status       : 'PRESENT'
  createdAt, updatedAt }
indexes:  { registration:1 } UNIQUE         ← one check-in per registration
          { event:1, checkedInAt:-1 }       ← list + "recent check-ins"
```

### Relationship

```
User ─1─┬─< Registration >─┬─1─ Event
        │                  │
        └────< Attendance >─┘        (Attendance.registration is unique)
```

Every Attendance references a **valid Registration** (loaded and verified before
the row is created), plus that registration's `event` and `user`. There is no
path that creates an Attendance without a Registration.

---

## 5. QR Security

| Concern | How it is handled |
| --- | --- |
| **Credential generation** | `signAttendanceToken({rid,eid,nonce})` = `base64url(JSON) + "." + base64url(HMAC-SHA256(secret, part1))`. `nonce` = `crypto.randomBytes(18).toString('base64url')`, unpredictable and per-registration. |
| **Credential storage** | The server stores **only** `qrNonce` on the registration (`select:false`). The token is a pure function of `(rid, eid, nonce, secret)` — no plaintext credential is stored, and re-viewing the QR recomputes the identical token (no generation race). Signing key: `QR_TOKEN_SECRET`, or a value derived from `JWT_SECRET` via HMAC if unset. |
| **Credential verification** | Split on `.`; recompute the HMAC; `crypto.timingSafeEqual` on equal-length buffers; parse `{v,rid,eid,n}`; then check the live registration. Malformed / bad-signature input throws a plain error and returns a generic *"could not be read"* 422 — the reason is never disclosed. |
| **Sensitive-data protection** | The QR payload is `{v:1, rid, eid, n}` only. Verified by test: **no** email, password, hash, JWT or user-document field appears anywhere in the token. The QR image encodes `{"typ":"EVENT_ATTENDANCE","cred":"<token>"}`. Credentials are never logged and never appear in an error body. |
| **Wrong-event protection** | Two independent checks: the signed `eid` must equal the scanned `:eventId`, **and** the loaded registration's own `event` must equal it. A forged-but-correctly-signed token whose registration belongs to another event is rejected (tested). |
| **Cancelled-registration protection** | Cancel rotates `qrNonce` (old QR image fails the nonce check), and check-in independently re-reads `registration.status` and rejects anything not `REGISTERED` with *"This registration is no longer active."* The QR endpoint itself returns 409 for a cancelled registration — no QR is issued. |
| **Cross-user protection** | `GET /registrations/:id/qr` compares `registration.user` to the JWT `sub`; a mismatch is 403 and the body never contains the credential. |
| **Replay across devices** | Immaterial — the credential only ever produces attendance for its own registration, and the unique index caps that at one row. |

---

## 6. API

All follow the existing Express conventions (`asyncHandler`, `ApiError`, the
`{ success, data, message? }` envelope, the central error handler).

| Method & path | Auth | Notes |
| --- | --- | --- |
| `GET /api/registrations/:registrationId/qr` | USER (owner) | Returns `{ registration, event, qr:{credential,payload}, attendance }`. 403 if not the owner; 409 if the registration is cancelled or the event is unavailable; 400 bad id; 404 unknown. Lazily issues a `qrNonce` for pre-Phase-7 rows. |
| `POST /api/events/:id/attendance/check-in` | ORGANISER (owner) | Body `{ credential }` (bare token or the wrapped `{typ,cred}` JSON). `201` `{ attendance, participant, event }` on success; `409` `{ alreadyCheckedIn, participant, event, attendance }` if already present; `422` invalid / wrong-event / rotated credential; `409` if the registration is inactive or the event status isn't UPCOMING/ONGOING; `403` not the owner; `401` unauthenticated; `400` bad event id. |
| `GET /api/events/:id/attendance` | ORGANISER (owner) | `?status=all\|present\|not_checked_in\|cancelled` + `?search=` (name/email). Returns `{ event, summary, filter, rows[], recentCheckIns[] }`. |
| `GET /api/events/:id/attendance/summary` | ORGANISER (owner) | `{ event, summary:{ registered, present, notCheckedIn, cancelled, attendancePercentage } }`. |

`GET /api/registrations/mine` (Phase 6) additionally returns
`attendance: { status:'PRESENT', checkedInAt } | null` per row. No Phase-6
endpoint changed shape otherwise; no duplicate endpoint was introduced (a
separate `/api/users/me/attendance` was considered and rejected as redundant —
*My Events* already carries the data).

---

## 7. RBAC

| Actor | QR retrieval | Check-in | Attendance list / summary |
| --- | --- | --- | --- |
| **USER** | ✅ own registration only (403 for another user's) | ❌ 403 | ❌ 403 |
| **ORGANISER** | ❌ 403 | ✅ own events only (403 for another organiser's) | ✅ own events only (403 for another organiser's) |
| **ADMIN** | ❌ 403 | ❌ 403 | ❌ 403 (admin oversight is unchanged; no attendance powers added) |
| **Unauthenticated** | ❌ 401 | ❌ 401 | ❌ 401 |

Enforced by the existing `authenticate` + `requireRole(...)` middleware plus
`loadOwnedEvent(eventId, organiserId)` (400 / 404 / 403) for every organiser
route, and an explicit `registration.user === req.user.id` check for the QR
route. The authenticated identity always comes from the JWT — never a body or
param id.

---

## 8. Attendance Logic

- **Successful check-in** — event owned by the organiser → event status is
  `UPCOMING` or `ONGOING` → signature valid → signed `eid` = scanned event =
  registration's event → nonce matches → registration is `REGISTERED` → no
  existing Attendance → `Attendance.create({ registration, event, user, checkedInBy })`.
- **Duplicate prevention** — the unique index on `registration` means the second
  `create` throws `E11000`; the service catches it, loads the existing row, and
  returns **409 `Participant is already marked present.`** with the original
  `checkedInAt` and participant name. **No second row is created.** This is the
  same mechanism under concurrency: a burst of 6 simultaneous identical scans
  yields exactly one `201` and five `409` (tested).
- **Attendance percentage** — `present / registered × 100`, rounded, where
  `registered` = registrations currently in status `REGISTERED` and `present` =
  check-ins whose registration is still `REGISTERED`. Cancelled registrations
  count toward neither numerator nor denominator. `registered = 0 ⇒ 0%`. All
  figures come from live `Registration` / `Attendance` documents — nothing is
  hard-coded.
- **Cancelled registrations** — excluded from `registered` and `present`; their
  QR is refused (409) and their credential fails check-in (nonce rotated +
  status check).
- **Event ownership** — `loadOwnedEvent` is the single ownership gate for every
  organiser attendance operation; the frontend `:eventId` is never trusted.
- **Event-status / date rule (documented)** — check-in is allowed **only** while
  the event is `UPCOMING` or `ONGOING`. `DRAFT` / `PLANNED` are "too early",
  `COMPLETED` / `CANCELLED` are closed. There is **no wall-clock window check**:
  timing is governed by the organiser-controlled status, which keeps testing
  unblocked and avoids timezone handling that the phase brief explicitly warns
  against.

---

## 9. UI

| Screen | Contents |
| --- | --- |
| **Participant QR** (`/user/my-events/:registrationId/qr`) | Event title + status badge, a large QR (≈240 px, error-correction M), guidance text; When / Where / Registration badge / Attendance badge. After check-in: a green **"Attendance Recorded"** panel with the check-in time — the QR stays visible. Errors (not owner / cancelled / unavailable) render a controlled message with a back link and no QR. |
| **My Events** (`/user/my-events`) | Each `REGISTERED` row gains an **"Attendance QR"** link; once checked in the row shows a **Present** badge and *"Checked in <time>"*. |
| **Organiser Attendance** (`/organiser/events/:id/attendance`) | "← Event details" link; title + status badge; four summary cards (Registered / Present / Not checked in / Attendance %); **Scan QR** panel — camera preview via `html5-qrcode`, "Start camera", scan guidance, and a collapsible **manual entry** field (organiser-only); a **scan-result card**; a **Recent check-ins** panel; **filter** buttons (All / Present / Not checked in / Cancelled) + **search**; an attendance **table** (Participant / Email / Registration / Attendance / Checked in) that scrolls inside its own container. |
| **Scan result** | *Attendance Marked* (✓, emerald) with participant / event / status / time · *Already Checked In* (!, amber) with participant + original time · *Invalid QR Code* (✕, rose) with a safe reason. Icon **and** label, never colour alone. |
| **Event details** (organiser) | New **"Attendance"** link beside "Participants". |
| **Participants** (organiser) | New **"Attendance →"** cross-link. |

**Empty states** — "No participants have checked in yet." (recent list) ·
"No participants have registered for this event yet." / "No participants match
this filter." (table). **Loading states** — skeletons for the QR page and the
attendance page; the check-in button and manual-entry submit are disabled while
a request is in flight (an `inFlight` ref also blocks duplicate submits).
**Error states** — camera denied → *"Camera access is required to scan
attendance QR codes."* + **Try Again**; no camera → manual-entry fallback;
network failure during verification → *"Unable to verify attendance. Check your
connection and try again."* Attendance is **never** marked client-side. No stack
traces or internal identifiers are shown.

---

## 10. Responsive Testing — actual results

Headless Chrome, `Emulation.setDeviceMetricsOverride`, all six required
viewports: **1920×1080, 1366×768, 1024×768, 768×1024, 390×844, 375×667**.

`phase7-responsive-check.mjs` — **66 / 66 passed**

| Surface | Checks per viewport | Result |
| --- | --- | --- |
| Organiser attendance page (scanner open) | no page h-overflow · sidebar visible/off-canvas · **camera region fits viewport width, no internal overflow** · summary + recent panels render · **table scrolls inside its own container** | 5 × 6 = 30 ✓ |
| Participant QR page | no page h-overflow · **QR image renders and fits** (≥120 px, within viewport) · attendance status visible | 3 × 6 = 18 ✓ |
| My Events (QR link + Present badge) | no page h-overflow · badges do not wrap · QR link + Present badge present | 3 × 6 = 18 ✓ |

Desktop (1920/1366), laptop, tablet (1024/768) and mobile (390/375) all pass;
the camera preview is capped at `max-w-sm` and never forces a desktop-sized
scanner onto mobile; the attendance table uses `overflow-x-auto` so only the
table scrolls, never the page. Screenshots captured and visually inspected
(participant QR, attendance dashboard, scan success, already-checked-in, camera
preview desktop + mobile, "Attendance Recorded").

---

## 11. Security Testing — actual results

From `phase7` backend integration suite (**75 / 75 passed**):

| Check | Result |
| --- | --- |
| Authentication — unauthenticated check-in | **401** ✓ |
| RBAC — USER → check-in endpoint | **403** ✓ |
| RBAC — ADMIN → check-in / attendance list / participant QR | **403 / 403 / 403** ✓ |
| Registration ownership — USER B → USER A's QR | **403**, credential not leaked ✓ |
| Event ownership — ORG A → check-in for ORG B's event | **403** ✓ |
| Event ownership — ORG B → ORG A's attendance list / summary | **403 / 403** ✓ |
| QR credential security — payload keys are `{v,rid,eid,n}` only; no email/password/JWT/hash | ✓ |
| Wrong-event — ORG scans event-A credential at event B | **422** "not valid for this event", no row ✓ |
| Wrong-event (defence-in-depth) — signed token whose registration is for another event | **422** ✓ |
| Invalid QR — random string / bad signature / missing credential | **422 / 422 / 422**, no stack ✓ |
| Cancelled-registration — pre-cancel credential scanned after cancel | rejected, no row ✓ |
| Cancelled-registration — QR endpoint after cancel | **409**, no QR ✓ |
| Duplicate check-in prevention — 6 concurrent identical scans | exactly **1 × 201**, 5 × 409, **1 DB row** ✓ |
| Event-status gate — check-in on a `PLANNED` event | **409** "must be in progress" ✓ |
| Error hygiene — no stack / Mongo error / internal path in any 4xx body | ✓ |
| ID handling — bad/unknown registration & event ids | **400 / 404** ✓ |
| DB — `attendances` has a unique index on `registration`; rows reference registration + event + user + checkedInBy; registration stores only `qrNonce` | ✓ |

---

## 12. Functional Testing — actual results

### `phase7` backend integration suite — **75 / 75 passed**

Covers the phase brief's required test matrix:

| # | Test | Result |
| --- | --- | --- |
| 1 | User views QR (active registration) | 200 + credential + payload + event info ✓ |
| 2 | Cancelled registration cannot get / use a QR | QR 409; pre-cancel credential rejected; no row ✓ |
| 3 | Successful scan (own event) | 201, PRESENT, participant name ✓ |
| 4 | Duplicate scan | 409 `already marked present` + original time; one row ✓ |
| 5 | Wrong event | 422, no row ✓ |
| 6 | Invalid QR (garbage / bad sig / empty / forged) | 422, safe ✓ |
| 7 | USER cannot use the check-in endpoint | 403 ✓ |
| 8 | Unauthenticated check-in | 401 ✓ |
| 9 | Cross-organiser check-in | 403 ✓ |
| 10 | USER views own attendance status | `/registrations/mine` shows PRESENT; QR page still returns credential + shows PRESENT ✓ |
| 11 | USER cannot view another user's QR | 403, no credential leak ✓ |
| 12 | Organiser attendance list (own event) | rows + Alice PRESENT + Bob not-checked-in + summary 2/1/1/50% ✓ |
| 13 | Cross-organiser attendance list / summary | 403 / 403 ✓ |
| 14 | Duplicate DB constraint under concurrency | one 201 / one row ✓ |
| 15–16 | Camera permission denied / unavailable | covered in E2E (below) |
| 17 | No registrations | rows `[]`, summary all-zero, recent `[]` ✓ |
| 18 | All participants checked in | registered 1 / present 1 / remaining 0 / **100%** ✓ |
| + | filters (present / not_checked_in / cancelled), search, unknown filter → 400 | ✓ |
| + | Phase-6 `/registrations/mine` + cancel still work | ✓ |

### `phase7-frontend-e2e.mjs` — **32 / 32 passed**

Headless Chrome + CDP, real API calls, fake media device.

- **Participant** — register → *My Events* shows "Attendance QR" → QR page
  renders the QR image + status rows + guidance; no raw credential / DB id in
  visible text.
- **Cancelled registration** — no "Attendance QR" link; direct navigation to the
  QR route shows a controlled error and no QR image.
- **Organiser** — event details "Attendance" link → dashboard with summary cards,
  scanner UI (Start camera + manual entry), filter buttons, participant row, and
  the "no check-ins yet" empty state.
- **Check-in (manual entry)** — *Attendance Marked* with name + Present + time;
  table row flips to Present; summary → **100%**.
- **Duplicate** — *Already Checked In* with the original time.
- **Invalid credential** — *Invalid QR Code*.
- **Wrong event** — event-X credential at event-Y's scanner → *Invalid QR Code*
  + "not valid for this event".
- **Camera** — permission **denied** (via CDP `Browser.setPermission`) →
  *"Camera access is required…"* + **Try Again**; permission **granted** → the
  scanner reaches the scanning state with a live preview; the page never crashes.
- **Post check-in** — *My Events* shows "Present" + "Checked in <time>"; the QR
  page shows **"Attendance Recorded"** and the QR is still displayed.
- **Access control** — a USER navigating to `/organiser/.../attendance` is
  redirected off `/organiser`.
- **No console errors** during the whole run.

**Phase 7 new total: 75 + 32 + 66 = 173 / 173.**

---

## 13. Regression Testing — actual previous-phase results

Each suite run against a **clean database** (3 canonical accounts, no
events/registrations/attendances) with a fresh headless-Chrome profile.

| Suite | Result |
| --- | --- |
| Phase 1 — backend (auth + RBAC) | **51 / 51** |
| Phase 1 — frontend E2E | **23 / 23** |
| Phase 2 — frontend E2E (Admin) | **47 / 47** |
| Phase 2 — quick regression check | **13 / 13** ¹ |
| Phase 2 — responsive | **40 / 40** |
| Phase 3 — frontend E2E (events) | **51 / 51** |
| Phase 3 — responsive | **50 / 50** |
| Phase 4 — frontend E2E (planning) | **44 / 44** |
| Phase 4 — responsive | **70 / 70** |
| Phase 5 — AI analyzer scenarios | **26 / 26** |
| Phase 5 — frontend E2E (AI assistant) | **27 / 27** |
| Phase 5 — responsive | **37 / 37** |
| Phase 6 — frontend E2E (registration) | **34 / 34** |
| Phase 6 — responsive | **90 / 90** |
| **Regression subtotal** | **603 / 603** |

¹ `phase2-regression-check.mjs` carried three assertions against the Phase-1
`"User area"` USER stub, which **Phase 6** replaced with the real participant
dashboard. Those fixture assertions were updated this phase (test-fixture only —
no application change) to check the participant dashboard and the `/user/my-events`
route. This suite was not part of the Phase-6 regression tally; the Phase-1–5
subset that was (466 checks) is fully green above.

**A first regression pass (no DB reset between suites) surfaced two failures**
that were confirmed **not** Phase-7 regressions: (a) a `phase2-frontend-e2e`
"deactivate the first organiser" assertion broke because earlier E2E suites
leave `@*.local` accounts behind — it passes on a clean DB; (b) a transient
CDP-connection race on one `phase4-frontend-e2e` launch — it passes 44/44 in
isolation. Phase 7 changes nothing in the Admin module, the planning workspace,
or the AI service.

**Grand total: regression 603 + Phase 7 new 173 = 776 / 776 automated checks.**

---

## 14. Build

| Check | Result |
| --- | --- |
| **Frontend production build** (`npm run build`) | ✅ **256 modules, 0 errors, 0 warnings**. Main bundle 375 kB (gzip 111 kB); `html5-qrcode` is a **lazy chunk** (464 kB, loaded only when an organiser starts the camera) — the earlier 500 kB chunk-size warning is gone. |
| **Backend startup** (cold `node src/server.js`) | ✅ Connects to `event_management_system`, listening on :5000, no errors/warnings. |
| **MongoDB connection** | ✅ `database "connected"` on `/api/health`. One new collection `attendances` with the unique `registration` index; `registrations` gains `qrNonce`. |
| **AI service health** | ✅ `GET :8000/health` → `{ success: true }`. Not modified this phase. |
| Dependencies added (frontend only) | `qrcode@^1.5.4` (QR generation), `html5-qrcode@^2.3.8` (camera scanning). Backend adds **no** dependency. |

Database hygiene: the old `event_management` database was never connected to or
written by any Phase-7 code (the backend and every test harness target
`event_management_system`); its pre-existing legacy contents (2 users, 2 events,
1 registration, an empty `attendances` collection) are unchanged. The Phase-7
`event_management_system` database ends the phase at exactly the 3 canonical
accounts with no residual test data.

---

## 15. Files Changed

### New — backend (4)

| File | Why |
| --- | --- |
| `backend/src/utils/qrToken.js` | Signed QR credential: nonce issue, sign, verify (constant-time), payload wrap, credential extraction. |
| `backend/src/models/attendance.model.js` | The dedicated `Attendance` model + unique `registration` index + `{event,checkedInAt}` index. |
| `backend/src/services/attendance.service.js` | `getMyQr`, `checkInByCredential`, `getEventAttendanceSummary`, `listEventAttendance`, `attendanceByRegistrationForUser`. |
| `backend/src/controllers/attendance.controller.js` | Thin handlers; the check-in handler translates the "already present" sentinel into a controlled 409 body. |

### New — frontend (7)

| File | Why |
| --- | --- |
| `frontend/src/services/attendanceService.js` | API client for QR retrieval + check-in + attendance list/summary. |
| `frontend/src/components/attendance/QrImage.jsx` | Browser QR rendering via `qrcode`, with loading / failure states. |
| `frontend/src/components/attendance/AttendanceStatusBadge.jsx` | Present / Not-checked-in pill. |
| `frontend/src/components/attendance/QrScanner.jsx` | Camera scanner (lazy `html5-qrcode`), permission handling, manual-entry fallback. |
| `frontend/src/components/attendance/ScanResultCard.jsx` | Success / already / invalid result card (icon + label). |
| `frontend/src/pages/user/EventQr.jsx` | The participant Attendance QR page. |
| `frontend/src/pages/organiser/OrganiserEventAttendance.jsx` | The organiser attendance dashboard + scanner + list. |

### Modified — backend (7)

| File | Change |
| --- | --- |
| `backend/src/models/registration.model.js` | `+ qrNonce` field (`select:false`); doc comment. |
| `backend/src/services/registration.service.js` | Issue `qrNonce` on register / re-register; **rotate** on cancel; `listMyRegistrations` now attaches an `attendance` field per row. |
| `backend/src/routes/registration.routes.js` | `+ GET /:registrationId/qr` (USER). |
| `backend/src/routes/event.routes.js` | `+ GET /:id/attendance`, `+ GET /:id/attendance/summary`, `+ POST /:id/attendance/check-in` (ORGANISER). |
| `backend/src/config/env.js` | `+ env.qr.secret` (`QR_TOKEN_SECRET`, optional). |
| `backend/.env.example` | Documented `QR_TOKEN_SECRET`. |
| `backend/package.json` | Version 0.7.0 + description. |

### Modified — frontend (7)

| File | Change |
| --- | --- |
| `frontend/src/routes/AppRoutes.jsx` | `+ /user/my-events/:registrationId/qr`, `+ /organiser/events/:id/attendance`. |
| `frontend/src/layouts/UserLayout.jsx` | `titleFor` → "Attendance QR". |
| `frontend/src/layouts/OrganiserLayout.jsx` | `titleFor` → "Attendance". |
| `frontend/src/pages/user/MyEvents.jsx` | "Attendance QR" link on active rows; Present badge + "Checked in" line. |
| `frontend/src/pages/organiser/OrganiserEventDetails.jsx` | "Attendance" link beside "Participants". |
| `frontend/src/pages/organiser/OrganiserEventParticipants.jsx` | "Attendance →" cross-link. |
| `frontend/src/services/api.js` | Interceptor also surfaces a response's `data` payload (needed by the "already checked in" 409). |
| `frontend/package.json` / `package-lock.json` | `+ qrcode`, `+ html5-qrcode`; version 0.7.0. |

### Modified — docs

`README.md` — status line, a new "QR-based attendance & event check-in (Phase 7)"
section, `QR_TOKEN_SECRET` in the env reference, roadmap.

### Test fixtures (scratchpad, not committed)

`phase7-frontend-e2e.mjs`, `phase7-responsive-check.mjs` (new); the temporary
`backend/__phase7_tests.mjs` harness was run and then deleted;
`phase2-regression-check.mjs` had three Phase-6-obsolete assertions repaired.

### Not modified

The Phase-5 AI service (`ai-service/*`), the Phase-4 planning models/services,
the Admin module, and the Phase-6 registration workflow (aside from the additive
`attendance` field on `/registrations/mine`).

---

## 16. Known Issues

1. **Check-in requires the event to be UPCOMING or ONGOING**, set by the
   organiser — there is deliberately no wall-clock date/time enforcement (per the
   phase brief's warning against timezone logic and against blocking testing).
   Documented in §8 and the README.
2. **A participant who checks in and then cancels** their registration is no
   longer counted in `registered` or `present`; the historical `Attendance` row
   is kept. This keeps the percentage honest but means "present" can briefly
   differ from the raw attendance-row count. Documented in the summary logic.
3. **No manual "mark present" override** — by design (phase brief §50). The only
   path to attendance is QR → verify → check-in.
4. **No admin attendance view** — admin oversight is unchanged (phase brief §41).
5. **`html5-qrcode` bundle weight** — mitigated by a dynamic `import()` so it is
   fetched only when an organiser opens the camera; the initial bundle is
   unaffected. It is a well-maintained, widely used library and was chosen over
   hand-rolling camera/permission/decoding logic.
6. **Camera scanning cannot be exercised headlessly with a real QR** — the E2E
   suite drives check-in through the organiser-only manual-entry field (also the
   documented no-camera fallback) and verifies the camera **permission-denied**
   and **preview-starts** paths via CDP with a fake media device. Real-camera
   decoding is a manual check.
7. **No git commits exist in the repository** — `git diff` is cumulative across
   the Phase-4-visual, Phase-5, Phase-6 and Phase-7 work; `backend/.env`
   (holding `QR_TOKEN_SECRET`) is git-ignored.
8. **Capacity race (inherited from Phase 6)** — unrelated to attendance; noted
   only because the same "count-then-insert" shape exists for registration
   capacity. Attendance itself is race-safe via the unique index.

---

*End of Phase 7 report. Next phases (not started): certificate generation,
feedback collection, sentiment analysis, post-event / participation analytics,
advanced notifications, reporting.*
