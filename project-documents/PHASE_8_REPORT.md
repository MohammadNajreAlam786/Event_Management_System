# PHASE 8 IMPLEMENTATION REPORT

**AI-Powered Event Planning & Management System with QR-Based Attendance**
Phase 8 — Automated Certificates & Event Notifications · completed 2026-09-08

---

## 1. Summary

Phase 8 adds two abstract features on top of the Phase-6/7 registration +
attendance data:

- **Automated participation certificates.** Eligibility is derived entirely
  from real records — a `Registration` that is still `REGISTERED`, an
  `Attendance` row with status `PRESENT`, and an `Event` whose status is
  `COMPLETED`. A dedicated `Certificate` model references all four
  (event / user / registration / attendance) and keeps snapshots of the
  recipient name, event title and date. The organiser generates certificates
  in bulk from a completed event; generation is **idempotent** (a unique
  `{user, event, type}` index) and **per-participant fault-tolerant**. Each
  certificate has a stable, human-readable **number** (`CERT-2026-000001`,
  from an atomic counter) and an opaque **verification code**. The PDF is
  rendered **on demand** with `pdfkit` — no files are stored. Participants
  view and download their certificates at `/user/certificates`; anyone can
  confirm one at the **public** `/verify/:code` page.
- **A database-backed notification centre.** A `Notification` model records
  event-lifecycle messages to a single recipient. Notifications are created as
  **side effects** of registration, check-in, certificate issue and event
  cancellation / update — every producer swallows and logs its own errors and
  never breaks the primary operation. Participants see them at
  `/user/notifications` with read/unread state, per-item and "mark all as
  read", and a sidebar unread badge.

Not touched: feedback, sentiment, post-event / participation analytics,
reporting (later phases). The Phase-5 AI Planning Assistant, the Phase-6
registration workflow and the Phase-7 QR attendance workflow are unchanged
except that `updateEvent` / status changes now *also* fire a notification.

---

## 2. Complete Workflow

```
USER
  │  register (Phase 6)                    →  EVENT_REGISTRATION_CONFIRMED  ──┐
  ▼                                                                          │
Registration  { …, status: REGISTERED }                                      │
  │  organiser scans QR on the day (Phase 7) →  ATTENDANCE_RECORDED  ─────────┤
  ▼                                                                          │
Attendance  { status: PRESENT }                                              │
  │  organiser sets Event → COMPLETED                                        │
  ▼                                                                          ▼
Certificate Eligibility  = REGISTERED + PRESENT + COMPLETED         USER Notification Centre
  │  organiser: "Generate certificates"  (idempotent, bulk)         (/user/notifications,
  ▼                                                                  read / unread, badge)
Certificate  { certificateNumber, verificationCode, …snapshots }
  │  →  CERTIFICATE_ISSUED  ────────────────────────────────────────────────►
  ▼
USER: view / download PDF (/user/certificates)   ·   anyone: /verify/:code
```

```
Event action                                   Notification
────────────                                   ────────────
organiser/admin sets Event → CANCELLED     →   EVENT_CANCELLED   (registered users only)
organiser edits venue / start / end date   →   EVENT_UPDATED     (registered users only)
```

---

## 3. Certificate Architecture

### Model (`backend/src/models/certificate.model.js`)

```
{ certificateNumber   String, unique          "CERT-2026-000001"
  verificationCode    String, unique          16 base32 chars (no I/L/O/U)
  event               → Event      (required)
  user                → User       (required)
  registration        → Registration (required)
  attendance          → Attendance (required)
  recipientName       String  (snapshot)
  eventTitle          String  (snapshot)
  eventDate           Date    (snapshot of Event.startDate)
  issuerName          String  (snapshot of the organiser name)
  institution         String  = "Sreyas Institute of Engineering and Technology"
  certificateType     'PARTICIPATION'
  status              'ISSUED'
  issueDate           Date }
indexes:  { certificateNumber } unique
          { verificationCode } unique
          { user, event, certificateType } UNIQUE   ← idempotent generation
          { event } (query)
```

Snapshots make the rendered PDF stable even if the user or event is later
renamed. There is **no `REVOKED` status** — the phase brief (§11 / §36) says
not to add fake revoke functionality, and nothing deletes a certificate.

### Relationships

```
User ─1─┬─< Registration >─┬─1─ Event
        │        │ 1        │
        │   < Attendance >  │
        │        │ 1        │
        └────< Certificate >┘        (Certificate → registration, attendance, event, user;
                                      unique on {user, event, certificateType})
```

Every `Certificate` is created only after its `Registration` and `Attendance`
have been loaded and verified, so a certificate without those relationships
cannot exist (§56).

### Eligibility (§5) — `certificate.service.js` `evaluate()`

A participant is eligible iff, in order: `Event.status === 'COMPLETED'` →
`Registration.status === 'REGISTERED'` → an `Attendance` row exists →
`Attendance.status === 'PRESENT'`.

**§57 policy (documented):** if a participant checked in and *then* cancelled
their registration, they are **not** eligible for a **new** certificate (a
cancelled registration is not "valid for the event"). A certificate issued
**before** the cancel is **kept** — never auto-deleted or revoked (§7). The
historical `Attendance` row is likewise never deleted.

### Duplicate prevention (§12 / §26)

The unique `{user, event, certificateType}` index is the guarantee. The
service also pre-checks `certByUser`, and `Certificate.create` is wrapped so a
race that produces `E11000` is counted as `alreadyIssued`, not `failed`.
Second run of "Generate certificates": `generated: 0, alreadyIssued: N`.

### PDF generation (`backend/src/utils/certificatePdf.js`)

`pdfkit@0.17.1` (added — see §13), A4 landscape, built-in Times / Helvetica
fonts, **no logos**. The layout uses explicit coordinates (never text flow) so
long names / titles ellipsise rather than overlap or clip. The PDF contains:
institution + department header, "CERTIFICATE OF PARTICIPATION", the recipient
name, the event title, "held on <date>", an attendance-verification line, an
organiser signatory line, and a footer with certificate number, issue date,
verification code and a `…/verify/<code>` hint. Wording is participation-only
("for actively participating in") — no claim of completion or achievement
(§14).

### Storage (§18)

**PDFs are rendered on demand and never stored.** Only the `Certificate` record
is persisted; `GET /certificates/:id/download` rebuilds the PDF from it each
time. Consequences: no filesystem path is ever constructed from user input, so
path traversal (§61 / §62) is structurally impossible; there are no stale
files to clean up. `generateForEvent` **smoke-renders the PDF before**
`Certificate.create`, so a render failure counts as `failed` and never leaves
a fake `ISSUED` row (§28). Bulk generation loops per participant in
`try/catch` — one failure is recorded in `failures[]` and the batch continues
(§27).

### Verification (§33 / §34 / §35)

`GET /api/certificates/verify/:verificationCode` is **public** (declared before
`authenticate`). The code is normalised (uppercase, strip non-alphanumerics);
too-short / unknown / traversal-looking input returns `200 { valid: false }`
(a controlled response, never a DB error). A match returns `{ valid: true,
certificate: { certificateNumber, recipientName, eventTitle, eventDate,
issueDate, status, institution, issuerName, certificateType } }` — **no** email,
user id, event id, or planning data.

---

## 4. Notification Architecture

### Model (`backend/src/models/notification.model.js`)

```
{ recipient  → User (required, indexed)
  event      → Event | null
  type       'EVENT_REGISTRATION_CONFIRMED' | 'ATTENDANCE_RECORDED'
           | 'CERTIFICATE_ISSUED' | 'EVENT_CANCELLED' | 'EVENT_UPDATED'
  title, message  String
  read       Boolean, readAt Date | null }
indexes:  { recipient, read, createdAt: -1 }               ← the centre query
          { recipient, event, type } UNIQUE  partial       ← de-dup backstop
            (partialFilterExpression: type ∈ the 4 "once per event" types;
             EVENT_UPDATED excluded — an event can be meaningfully edited twice)
```

### Creation triggers (all side effects, all non-throwing)

| Trigger | Type | Where |
| --- | --- | --- |
| USER registers (or re-registers) | `EVENT_REGISTRATION_CONFIRMED` | `registration.service.registerForEvent` — deduped, so re-registering after a cancel does **not** send a second one |
| Organiser records a check-in | `ATTENDANCE_RECORDED` | `attendance.service.checkInByCredential`, after `Attendance.create` — a repeat scan 409s before reaching it |
| Certificate issued | `CERTIFICATE_ISSUED` | `certificate.service.generateForEvent`, per new certificate |
| Event → CANCELLED (organiser or admin) | `EVENT_CANCELLED` | `event.service.updateEventStatusByOwner` + `updateEventStatusByAdmin` — only when the status actually transitions **into** CANCELLED |
| Event venue / start / end date changed | `EVENT_UPDATED` | `event.service.updateEvent` — only for a meaningful change, only while the event is PLANNED/UPCOMING/ONGOING |

`EVENT_CANCELLED` / `EVENT_UPDATED` fan out **only to users with a
`REGISTERED` registration** for that event (§40 / §54) — never unrelated
users. Every call site is `notify*(…).catch(() => {})`; `createNotification`
itself catches `E11000` (→ deduped) and any other error (→ logged) and returns
`{ created: false }` rather than throwing. A notification failure can never
break registration, check-in, generation or a status change.

### Read / unread + ownership

`GET /notifications` and `unread-count` are filtered by the authenticated
`recipient`. `PATCH /notifications/:id/read` verifies `notification.recipient
=== req.user.id` (403 otherwise). `POST /notifications/read-all` only touches
`{ recipient: req.user.id, read: false }`. There is no way to pass another
user's id.

---

## 5. API

| Method & path | Auth | Notes |
| --- | --- | --- |
| `GET /api/events/:id/certificates/eligibility` | ORGANISER (owner) | `{ event:{…,eventCompleted}, summary:{totalParticipants,present,eligible,issued,notEligible}, rows:[{userId,name,email,registrationStatus,attendanceStatus,eligible,reason,certificate?}] }` |
| `POST /api/events/:id/certificates/generate` | ORGANISER (owner) | 409 unless `Event.status === 'COMPLETED'`. `200 { summary:{eligible,generated,alreadyIssued,failed,notEligible}, failures:[{name,reason}] }` |
| `GET /api/certificates/mine` | USER | The caller's own certificates (formatted verification code, no email/ids of other people) |
| `GET /api/certificates/:certificateId/download` | USER (owner) **or** ORGANISER (owns the event) | `application/pdf`; `Content-Disposition: attachment` (or `inline` with `?inline=1`); 400 bad id, 404 unknown, 403 otherwise |
| `GET /api/certificates/verify/:verificationCode` | **public** | `200 { valid, certificate? }` — public fields only |
| `GET /api/notifications` `?unread=&page=&limit=` | USER | `{ notifications, unreadCount, pagination }` |
| `GET /api/notifications/unread-count` | USER | `{ unreadCount }` |
| `PATCH /api/notifications/:notificationId/read` | USER (owner) | 400 bad id, 404 unknown, 403 not owner |
| `POST /api/notifications/read-all` | USER | `{ updated }` — only the caller's notifications |

No existing Phase 1–7 endpoint changed shape. `certificate.routes.js` and
`notification.routes.js` are new routers; the generation/eligibility routes sit
on the existing `event.routes.js` beside the other owner-scoped event
operations.

---

## 6. Security

| Concern | Result |
| --- | --- |
| **Authentication** | Every protected endpoint → **401** unauthenticated (verified: eligibility, generate, `/certificates/mine`, `/notifications`) |
| **USER RBAC** | USER → `certificates/eligibility` / `certificates/generate` → **403**; USER → `GET /notifications` allowed (own only) |
| **ORGANISER RBAC** | ORGANISER → `GET /certificates/mine` → **403**; ORGANISER → `GET /notifications` → **403** |
| **Certificate ownership** | USER B → USER A's `…/download` → **403**; a certificate id from another user is never accepted |
| **Event ownership** | ORGANISER B → ORGANISER A's `certificates/eligibility` / `certificates/generate` → **403** (via `loadOwnedEvent`); owning organiser **can** download a participant's certificate for their own event |
| **Notification ownership** | USER B → `PATCH /notifications/:userA_id/read` → **403**; `read-all` only affects the caller; a list request never returns another user's rows |
| **Verification privacy** | `/verify/:code` returns name / event / dates / number / institution only — verified to contain **no** email, user id, event id (`{…}` object) or planning data |
| **File security (§61 / §62)** | No filesystem path is built from input — the PDF is rendered from the DB record. A traversal-looking verification code (`..%2f..%2fetc%2fpasswd`) → `200 { valid: false }`, no error |
| **Duplicate certificate prevention** | Unique `{user,event,certificateType}` index + pre-check + `E11000` handling → re-run yields `generated: 0` |
| **Duplicate notification prevention** | Partial unique `{recipient,event,type}` index → re-scan / re-register / re-generate never adds a second notification |
| **Error hygiene** | No stack, Mongo error string, or internal path in any 4xx body (verified across the 409 / 403 / 400 responses) |
| **Admin** | Admin gains **no** certificate or notification powers (only the existing `PATCH /admin/events/:id/status`, which now also fires `EVENT_CANCELLED` to registered users) |

---

## 7. UI

### Participant

- **`/user/notifications`** — read/unread cards (unread = indigo dot + tinted
  background), type chips, per-item **Mark read**, **Mark all as read**,
  an **All / Unread** filter, a "View" shortcut on `CERTIFICATE_ISSUED`, an
  empty state, a loading skeleton. The sidebar **Notifications** item shows an
  unread-count badge, fetched once per layout mount and refreshed via an
  `<Outlet context>` callback after the page marks things read — **no polling**.
- **`/user/certificates`** — one card per certificate: event title + **Issued**
  badge, certificate number, issue date, event date, verification code
  (monospace), **View** (opens the PDF in a new tab) and **Download**. Empty
  state, loading skeleton, per-row busy state, a link to the verification page.
- **My Events** — a row for a `COMPLETED` event where attendance is `PRESENT`
  gains a **Certificate** shortcut to `/user/certificates`.

### Organiser

- **`/organiser/events/:id/certificates`** (linked from event details, and
  cross-linked from Participants / Attendance) — four summary cards
  (Participants / Attended / Eligible / Issued); a **Generate certificates**
  panel (button disabled until the event is `COMPLETED`, and while a request
  is in flight) with a **generation-result panel** (Eligible / Generated /
  Already issued / Not eligible / Failed); an **eligibility table**
  (Participant / Email / Registration / Attendance / Certificate) with per-row
  certificate status + number + a **Download** button; empty state; loading
  skeleton; error states for 403 / 404.

### Public

- **`/verify`** and **`/verify/:code`** — a code input and a result card:
  **Valid certificate** (green, ✓, with participant / event / dates / number /
  issuer) or **Certificate not found or invalid** (rose). Icon **and** label,
  not colour alone.

### States (§68 / §69 / §70)

Empty: "No notifications yet" / "No unread notifications" / "No certificates
yet" / "No participants". Loading: skeletons for every list + generation
("Generating…") + download ("Preparing…"). Errors handled with friendly
copy: not eligible, already issued, event not completed (409 "…once the event
is completed"), event cancelled, PDF render failure (500 "The certificate PDF
could not be generated. Please try again." — operational, no stack), certificate
not found (404), invalid verification code, unauthorized access (403),
notification not found (404), network error. No stack traces reach the client.

---

## 8. PDF Testing — actual results

The **actual generated PDF was opened and inspected** (not just the HTTP
status), both from a direct render and from the real
`GET /api/certificates/:id/download` response:

| Check | Result |
| --- | --- |
| Opens as a valid PDF | ✅ `%PDF-1.3` header, `%%EOF` trailer |
| Text readable | ✅ all lines render with Times / Helvetica |
| No overlapping elements | ✅ explicit-coordinate layout; long event title (60+ chars) sits on one line, would ellipsise if longer |
| No clipped text | ✅ within the inner border on A4 landscape |
| Proper margins | ✅ 24 pt outer + 33 pt inner decorative border |
| Suitable for printing | ✅ A4 landscape, vector, ~2.5 KB |
| Consistent layout | ✅ identical structure across recipients; only the name / title / number / code differ |
| Download headers | ✅ `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="<sanitised event>_Certificate.pdf"`, `?inline=1` → `inline` |

A rendered screenshot of a downloaded certificate is in the test artefacts.

---

## 9. Responsive Testing — actual results

`phase8-responsive-check.mjs` — **72 / 72 passed** across the six required
viewports: **1920×1080, 1366×768, 1024×768, 768×1024, 390×844, 375×667**.

| Surface | Per-viewport checks | Result |
| --- | --- | --- |
| `/user/notifications` | no page h-overflow · sidebar visible/off-canvas · content + all controls fit the viewport | 3 × 6 = 18 ✅ |
| `/user/certificates` | no page h-overflow · sidebar · content + Download/View fit | 3 × 6 = 18 ✅ |
| `/organiser/events/:id/certificates` | no page h-overflow · sidebar · summary + Generate control fit · **eligibility table scrolls inside its own `overflow-x-auto` container** | 4 × 6 = 24 ✅ |
| `/verify/:code` (public) | no page h-overflow · valid-certificate result renders | 2 × 6 = 12 ✅ |

Desktop, laptop, tablet and mobile all pass; the eligibility table scrolls
inside its container, never the page; notification cards and controls stack and
stay readable on mobile. Screenshots (desktop + mobile) were captured and
visually inspected for notifications, participant certificates, organiser
certificate management (before + after generation) and the verify page.

---

## 10. Functional Testing — actual results

### `phase8` backend integration suite — **111 / 111 passed**

Covers all 20 required test cases plus §7, §54, §60, §68 and regression
touch-points:

| # | Test | Result |
| --- | --- | --- |
| 1 | Registered + Present + Completed → eligible | ✅ (`eligible: true`, `attendanceStatus: 'PRESENT'`) |
| 2 | Registered, no attendance → not eligible | ✅ (reason names "check in") |
| 3 | Cancelled event → no generation | ✅ 409; also §7: existing certs kept + still verify |
| 4 | Active event → generation unavailable | ✅ 409; eligibility reports `eventCompleted: false` |
| 5 | Generate certificate | ✅ `{eligible:2, generated:2, alreadyIssued:0, failed:0, notEligible:2}`; 2 rows persisted with all 4 refs + snapshots |
| 6 | Duplicate generation | ✅ `{generated:0, alreadyIssued:2}`; still exactly 2 rows |
| 7 | User views own certificate | ✅ own only; user with none → `[]` |
| 8 | User downloads certificate | ✅ `application/pdf`, safe filename, valid PDF bytes |
| 9 | Cross-user certificate access | ✅ 403; bad id → 400; unknown id → 404; owning organiser → 200; other organiser → 403 |
| 10 | Certificate verification (valid) | ✅ `valid:true` + name/event/number/dates; **no PII / ids** |
| 11 | Invalid verification code | ✅ unknown / too-short / traversal → `200 {valid:false}` |
| 12 | Registration notification | ✅ `EVENT_REGISTRATION_CONFIRMED`, names the event, event ref (title only) |
| 13 | Attendance notification | ✅ `ATTENDANCE_RECORDED`; re-scan → still one |
| 14 | Certificate notification | ✅ `CERTIFICATE_ISSUED`; re-generate → still one |
| 15 | Event cancellation notification | ✅ registered users get it (organiser cancel **and** admin cancel); a non-registered user does not |
| 16 | Notification ownership | ✅ cross-user `PATCH …/read` → 403; unauth `GET` → 401; ORGANISER `GET` → 403; bad/unknown id → 400/404 |
| 17 | Mark notification read | ✅ 200; unread count −1; drops out of the unread list |
| 18 | Mark all read | ✅ unread → 0; other user unaffected; a fresh action creates a new unread |
| 19 | Duplicate notification prevention | ✅ re-scan / cancel+re-register / re-generate → exactly one of each type |
| 20 | PDF integrity | ✅ `%PDF-` + `%%EOF` + non-trivial size; saved + visually inspected |
| + | empty completed event (§68) | ✅ rows `[]`, summary zeros, generate → `generated: 0` |
| + | DB indexes (§60) | ✅ unique `certificateNumber` / `verificationCode` / `{user,event,type}`; `{recipient,read,createdAt}` + partial-unique `{recipient,event,type}` |
| + | regression | ✅ Phase 7 check-in, Phase 6 `/registrations/mine`, Phase 5 AI health |

### `phase8-frontend-e2e.mjs` — **32 / 32 passed**

Headless Chrome + CDP, real API calls.

- **USER** — sidebar has Notifications + Certificates; after registering,
  `/user/notifications` shows "Registration confirmed" (unread indicator +
  sidebar badge); **Mark read** decrements the indicators; after check-in +
  generation, "Attendance recorded" and "Certificate available" appear;
  **Mark all as read** clears the badge and all indicators;
  `/user/certificates` lists the certificate (number, Issued, View, Download);
  the PDF blob downloads (`application/pdf`, > 1500 bytes) and clicking
  **Download** shows no error; *My Events* shows the **Certificate** shortcut.
- **ORGANISER** — event details has a **Certificates** link; the page shows the
  eligibility summary + participant row (attendance **Present**); on an
  **active** event the note "…once the event is marked Completed" is shown and
  the button is **disabled**; on the completed event **Generate certificates**
  produces "Generation complete / Generated: 1" and the row flips to
  **Issued** + `CERT-…` + Download; **re-running** reports "Already issued: 1 /
  Generated: 0".
- **Public** — `/verify/<code>` → "Valid certificate" + participant + event,
  **no email shown**; `/verify/<bad>` → "Certificate not found or invalid";
  `/verify` → a code-entry form.
- **Access control** — a USER visiting `/organiser/.../certificates` is
  redirected off `/organiser`.
- **No console errors** for the whole run.

**Phase 8 new total: 111 + 32 + 72 = 215 / 215.**

---

## 11. Security Testing — actual results

All from the 111-check backend suite (see the table in §6). Summary: 401 on
every endpoint unauthenticated · USER↔ORGANISER RBAC enforced both ways ·
certificate ownership (cross-user 403, owning-organiser 200) · event ownership
(cross-organiser 403 on eligibility + generate) · notification ownership
(cross-user 403, `read-all` scoped) · verification returns no PII / ids /
planning data · no filesystem path is derived from input · duplicate
certificate + duplicate notification both prevented at the DB level · no
stack / Mongo / path leaked in any error body.

---

## 12. Regression Testing — actual previous-phase results

Each suite run against a **clean database** with a fresh headless-Chrome
profile.

| Suite | Result |
| --- | --- |
| Phase 1 — backend (auth + RBAC) | **51 / 51** |
| Phase 1 — frontend E2E | **23 / 23** |
| Phase 2 — frontend E2E (Admin) | **47 / 47** |
| Phase 2 — quick regression check | **13 / 13** |
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
| Phase 7 — frontend E2E (QR attendance) | **32 / 32** ¹ |
| Phase 7 — responsive | **66 / 66** |
| **Regression subtotal** | **701 / 701** |

¹ In the batched regression run, `phase7-frontend-e2e` reported 31/32 — the one
failure is the **"camera permission denied"** assertion, which cannot be
exercised when Chrome is launched with `--use-fake-device-for-media-stream
--use-fake-ui-for-media-stream` (the `-ui-` flag auto-grants the permission,
overriding the CDP `Browser.setPermission(denied)`). Re-running that single
suite against a Chrome launched **without** `--use-fake-ui-for-media-stream`
gives **32 / 32**. This is a documented test-harness / Chrome-flag interaction
(noted in the Phase 7 report), **not a Phase-8 regression** — Phase 8 changes
nothing in the QR scanner or camera code.

**Grand total: regression 701 + Phase 8 new 215 = 916 / 916 automated checks.**

---

## 13. Build

| Check | Result |
| --- | --- |
| **Frontend production build** (`npm run build`) | ✅ **263 modules, 0 errors, 0 warnings**. Main bundle 375 kB (gzip 111 kB); the `html5-qrcode` lazy chunk (484 kB) is unchanged — Phase 8 adds **no** frontend dependency. |
| **Backend startup** (cold `node src/server.js`) | ✅ Connects to `event_management_system`, listening on :5000, no errors/warnings. |
| **MongoDB connection** | ✅ `database: "connected"`. New collections `certificates`, `notifications`, `counters` are created on first use with their indexes. |
| **AI service health** | ✅ `GET :8000/health` → `{ success: true }`. Not modified this phase. |
| **Certificate PDF generation test** | ✅ `buildCertificatePdf(...)` → `%PDF-1.3` … `%%EOF`, ~2.5 KB; opened and visually verified. |
| Dependency added | **`pdfkit@^0.17.1`** — backend only (pure JS, no native deps, no headless browser). |

`npm audit` reports 3 moderate advisories in `qs` → `body-parser` → `express`
— **pre-existing** (Express 4 transitive), unrelated to `pdfkit`, not addressed
this phase.

Database hygiene: the old `event_management` database was never connected to or
written by any Phase-8 code. The `event_management_system` database ends the
phase at exactly the 3 canonical accounts with no residual test data
(`events / registrations / attendances / certificates / notifications /
counters` all empty).

---

## 14. Files Changed

### New — backend (10)

| File | Why |
| --- | --- |
| `backend/src/models/counter.model.js` | Atomic named sequence (`nextSequence`) for certificate numbers. |
| `backend/src/models/certificate.model.js` | The `Certificate` model + its 3 unique indexes. |
| `backend/src/models/notification.model.js` | The `Notification` model + its indexes (incl. the partial-unique de-dup index). |
| `backend/src/utils/certificatePdf.js` | `buildCertificatePdf` (pdfkit) + `formatVerificationCode`. |
| `backend/src/services/certificate.service.js` | `listEligibility`, `generateForEvent`, `listMyCertificates`, `getCertificateForDownload`, `verifyByCode`. |
| `backend/src/services/notification.service.js` | `createNotification` + the `notify*` producers + `listForUser` / `unreadCountForUser` / `markRead` / `markAllRead`. |
| `backend/src/controllers/certificate.controller.js` | Thin handlers; `download` sets the PDF headers + disposition. |
| `backend/src/controllers/notification.controller.js` | Thin handlers. |
| `backend/src/routes/certificate.routes.js` | `/api/certificates` — public `/verify/:code` before `authenticate`, then `/mine` + `/:id/download`. |
| `backend/src/routes/notification.routes.js` | `/api/notifications` — blanket `authenticate` + USER. |

### New — frontend (7)

| File | Why |
| --- | --- |
| `frontend/src/services/certificateService.js` | eligibility / generate / getMine / fetchPdf+download+openInNewTab / verify. |
| `frontend/src/services/notificationService.js` | list / unreadCount / markRead / markAllRead. |
| `frontend/src/components/certificate/CertificateStatusBadge.jsx` | Issued / Not-issued pill. |
| `frontend/src/pages/user/UserNotifications.jsx` | The participant notification centre. |
| `frontend/src/pages/user/UserCertificates.jsx` | The participant certificate list. |
| `frontend/src/pages/organiser/OrganiserEventCertificates.jsx` | Eligibility + bulk generation + result summary. |
| `frontend/src/pages/CertificateVerify.jsx` | Public `/verify` + `/verify/:code`. |

### Modified — backend (6)

| File | Change |
| --- | --- |
| `backend/src/routes/index.js` | Mount `/certificates` + `/notifications`. |
| `backend/src/routes/event.routes.js` | `+ GET /:id/certificates/eligibility`, `+ POST /:id/certificates/generate` (ORGANISER). |
| `backend/src/services/registration.service.js` | Fire `EVENT_REGISTRATION_CONFIRMED` after a successful register/re-register. |
| `backend/src/services/attendance.service.js` | Fire `ATTENDANCE_RECORDED` after `Attendance.create`. |
| `backend/src/services/event.service.js` | Fire `EVENT_CANCELLED` on status → CANCELLED (owner + admin); fire `EVENT_UPDATED` on venue/date change. |
| `backend/package.json` | `+ pdfkit`; version 0.8.0 + description. |

### Modified — frontend (7)

| File | Change |
| --- | --- |
| `frontend/src/routes/AppRoutes.jsx` | `+ /user/notifications`, `+ /user/certificates`, `+ /organiser/events/:id/certificates`, `+ /verify` + `/verify/:code` (public). |
| `frontend/src/layouts/UserLayout.jsx` | Nav items for Notifications (with badge) + Certificates; `titleFor`; unread count via `<Outlet context>`; no polling. |
| `frontend/src/layouts/OrganiserLayout.jsx` | `titleFor` → "Certificates". |
| `frontend/src/components/dashboard/DashboardSidebar.jsx` | Optional `badge: number` count pill on a nav item. |
| `frontend/src/pages/organiser/OrganiserEventDetails.jsx` | "Certificates" link. |
| `frontend/src/pages/user/MyEvents.jsx` | "Certificate" shortcut on a completed + present row. |
| `frontend/src/services/api.js` | Interceptor surfaces a `Blob` error body as `responseBlob` (for PDF-download failures). |
| `frontend/package.json` | version 0.8.0 + description (no dependency change). |

### Modified — docs

`README.md` — status line, a new "Certificates & notifications (Phase 8)"
section, roadmap.

### Test fixtures (scratchpad, not committed)

`phase8-frontend-e2e.mjs`, `phase8-responsive-check.mjs`, `p8-shots.mjs`,
`p8-run-regression.sh` (new); the temporary `backend/__phase8_tests.mjs`
harness was run and then deleted.

### Not modified

The Phase-5 AI service (`ai-service/*`), the Phase-4 planning models/services,
the Phase-6 `Registration` model, the Phase-7 `Attendance` model and QR code,
and the Admin module (beyond the additive `EVENT_CANCELLED` notification on the
existing admin cancel).

---

## 15. Known Issues

1. **PDF has no QR code / embedded institutional logo.** The verification
   *code* is printed (with a `…/verify/<code>` hint); a scannable QR on the PDF
   and a real logo are cosmetic extensions, deferred. No copyrighted logo was
   used (§16).
2. **`EVENT_UPDATED` heuristic.** A notification is sent only when `venue`,
   `startDate` or `endDate` changes on a PLANNED/UPCOMING/ONGOING event — not
   for description/category/image edits. This is the documented "meaningful
   change" rule (§41); it is intentionally conservative.
3. **§57 — attended-then-cancelled.** Such a participant is excluded from
   *new* certificate generation and from the eligibility "eligible" count; a
   certificate issued before the cancel is kept and still verifies. This is a
   deliberate policy choice, documented in `certificate.service.js` and the
   README.
4. **Forced PDF-render failure is not covered by an automated test** — it
   cannot be cleanly injected without mocking `pdfkit`. The design guarantee
   (smoke-render **before** `Certificate.create`; per-participant `try/catch`
   in bulk) is covered by code review and by the `failed` / `failures[]`
   plumbing that the suite exercises on the success path.
5. **No revocation.** Per §11 / §36, `REVOKED` was not added. `Certificate.status`
   is always `ISSUED`; the verify endpoint's `valid` flag is therefore always
   `true` for a found certificate. If a future phase needs revocation, add the
   status value + a guarded organiser/admin action then.
6. **Notification badge is not real-time.** The unread count is fetched once
   per `UserLayout` mount and refreshed after the notifications page marks
   things read (via outlet context) — there is no polling or websocket (§47
   "do not make excessive API requests").
7. **`npm audit`** — 3 moderate `qs`/`body-parser`/`express` advisories,
   pre-existing and unrelated to Phase 8; not fixed here to avoid an
   out-of-scope Express bump.
8. **No git commits exist in the repository** — `git diff` is cumulative
   across the Phase-4-visual → Phase-8 work; `backend/.env` is git-ignored.
   Phase 8 files are staged.

---

*End of Phase 8 report. Next phases (not started): feedback forms, feedback
analysis, sentiment analysis, post-event / participation analytics, event
performance analysis, future-event recommendations, advanced AI analytics.*
