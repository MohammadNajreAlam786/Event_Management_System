# AI-Powered Event Planning & Management System

An intelligent, full-stack platform for the complete event lifecycle — from
**pre-event planning** through registration, QR-based attendance, feedback, and
AI-driven analysis for future improvement.

> **Status:** Phase 10 — post-event analytics, statistics & reporting.
> Implemented so far: full-stack foundation (Phase 0); auth + RBAC (Phase 1);
> clean database (Phase 1.5); Admin module (Phase 2); Event model + organiser
> dashboard + event CRUD + lifecycle + admin oversight (Phase 3); a per-event
> planning workspace — tasks, schedule, resources, budget, team, overview, and a
> dynamic readiness score (Phase 4); an AI Planning Assistant that analyses the
> planning data and returns prioritised recommendations and risks (Phase 5);
> a participant side — browse/search/filter public events, view details,
> register online (duplicate-proof, capacity-aware), a "My Events" list with
> cancel, and an organiser participant list (Phase 6);
> QR-based attendance — each active registration yields a signed QR credential,
> the organiser scans it (camera or manual entry) to record a check-in in a
> dedicated Attendance model, with an attendance dashboard, list, filters and
> live summary (Phase 7);
> automated participation certificates — attendance-gated eligibility on a
> completed event, idempotent bulk generation, on-demand PDF, a public
> verification page, plus a database-backed notification centre driven by the
> registration / check-in / certificate / cancellation lifecycle (Phase 8);
> participant feedback — a 1–5 star rating + optional comment, available only
> to participants who attended a completed event, one per participant per event,
> with each comment classified POSITIVE / NEUTRAL / NEGATIVE by the AI service
> (VADER), an organiser feedback view with a basic sentiment summary, and a
> `FEEDBACK_AVAILABLE` notification (Phase 9);
> **post-event analytics — a read-only organiser page that derives registration,
> attendance, feedback, rating-distribution, sentiment and certificate
> statistics for a completed event from the existing records, with
> dependency-free bar charts, a factual performance summary, and a downloadable
> PDF report; a basic platform roll-up on the admin Statistics page (Phase 10)**.
> Not implemented yet: AI future-event recommendations, predictive analytics,
> forecasting.

---

## Project

The system is based on the academic project
**"AI-Powered Event Management System with QR-Based Attendance"** and extends it
by making **pre-event planning** a first-class part of the organiser workflow.

The full lifecycle the finished system targets:

```
Planning → Preparation → Coordination → Registration → Event Execution
        → QR Attendance → Feedback → AI Analysis → Reporting → Future Event Improvement
```

Three roles are planned:

| Role                | Responsibility                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| **Admin**           | Platform-level management.                                               |
| **Organiser**       | Event planning, preparation, coordination, execution, post-event review. |
| **User / Participant** | Event discovery, registration, attendance, feedback, certificates.    |

The **Organiser** is the primary role for the pre-event planning functionality.
AI assists with planning and decision support, but the organiser stays in
control of every AI-generated suggestion.

---

## Academic Reference

The original academic abstract is located at:

```
project-documents/Event_Management_system_Abstract .pdf
```

This abstract is the **primary reference** for the project's purpose and core
functionality. It must not be modified, renamed, moved, or deleted, and it stays
tracked in version control. All implementation work preserves the concepts it
describes: AI-powered event management, online participant registration, QR-based
attendance and tracking, AI event analytics, participation analysis, feedback and
sentiment analysis, automated certificate generation, notifications, event
statistics, reporting, and future event improvement. Pre-event planning is added
as an extension around those concepts, not as a replacement for them.

---

## Architecture

```
        ┌────────────┐      HTTP/JSON      ┌──────────────────┐      HTTP/JSON      ┌────────────────┐
        │  Frontend  │  ───────────────▶   │  Node / Express  │  ───────────────▶   │  FastAPI AI    │
        │ React+Vite │  ◀───────────────   │   Backend API    │  ◀───────────────   │    Service     │
        └────────────┘                     └───────┬──────────┘                     └────────────────┘
                                                   │ Mongoose
                                                   ▼
                                            ┌────────────┐
                                            │  MongoDB   │
                                            └────────────┘
```

| Layer      | Technology                                                          |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | React + Vite (JavaScript), Tailwind CSS, React Router, Axios, Zustand |
| Backend    | Node.js + Express, Mongoose, cors, helmet, morgan, dotenv          |
| Database   | MongoDB                                                            |
| AI Service | Python + FastAPI + Uvicorn                                        |

Principles carried forward into later phases:

- The AI service stays separated from the frontend. The frontend talks only to
  the backend; the backend calls the AI service.
- The backend is the single API layer.
- MongoDB holds persistent application data.

---

## Folder Structure

```
Event-Management-system/
├── project-documents/          # Academic abstract (do not modify) — tracked in git
│   └── Event_Management_system_Abstract .pdf
│
├── frontend/                   # React + Vite client
│   ├── public/
│   ├── src/
│   │   ├── assets/             # static assets (later phases)
│   │   ├── components/         # shared UI components
│   │   ├── hooks/              # custom React hooks (later phases)
│   │   ├── layouts/            # page frames (RootLayout)
│   │   ├── pages/              # route screens (placeholders in Phase 0)
│   │   ├── routes/             # React Router route table
│   │   ├── services/           # api.js — centralised Axios instance
│   │   ├── store/              # useAppStore.js — Zustand store
│   │   ├── utils/              # helpers (later phases)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css           # Tailwind entry + global base styles
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── config/             # env.js, db.js (Mongoose connection)
│   │   ├── controllers/        # health.controller.js
│   │   ├── middleware/         # notFound.js, errorHandler.js
│   │   ├── models/             # Mongoose models (later phases)
│   │   ├── routes/             # index.js, health.routes.js
│   │   ├── services/           # backend service modules (later phases)
│   │   ├── utils/              # logger.js
│   │   ├── app.js              # Express app assembly
│   │   └── server.js           # boot sequence (env → DB → listen)
│   ├── .env.example
│   └── package.json
│
├── ai-service/                 # Python + FastAPI service
│   ├── models/                 # Pydantic schemas (later phases)
│   ├── routes/                 # health.py
│   ├── services/               # planning / analytics logic (later phases)
│   ├── .env.example
│   ├── main.py                 # FastAPI app + health route
│   └── requirements.txt
│
├── .gitignore
└── README.md
```

---

## Requirements

- **Node.js** ≥ 18 (developed on Node 24) and **npm**
- **Python** ≥ 3.10 (developed on Python 3.14)
- **MongoDB** ≥ 6 running locally (or a reachable connection string)

---

## Installation

Clone the repository, then install each service independently.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

### 3. AI service

```bash
cd ai-service
python -m venv .venv

# activate the virtual environment
#   Windows PowerShell:  .venv\Scripts\Activate.ps1
#   macOS / Linux:       source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env      # optional
```

---

## Running

Start MongoDB first (as a service, or `mongod --dbpath <path>`), then run each
service in its own terminal.

### Backend

```bash
cd backend
npm run dev        # nodemon, auto-restart
# or: npm start    # plain node
```

The backend connects to MongoDB and only then starts listening. If MongoDB is
unreachable it logs a clear error and exits.

### Frontend

```bash
cd frontend
npm run dev
```

### AI service

```bash
cd ai-service
python -m uvicorn main:app --reload --port 8000
# or: python main.py   (reads AI_SERVICE_HOST / AI_SERVICE_PORT)
```

---

## Ports

| Service    | URL                       | Port  |
| ---------- | ------------------------- | ----- |
| Frontend   | http://localhost:5173     | 5173  |
| Backend    | http://localhost:5000     | 5000  |
| AI Service | http://127.0.0.1:8000     | 8000  |
| MongoDB    | mongodb://localhost:27017 | 27017 |

---

## Health checks

| Service    | Endpoint                              | Expected response                                        |
| ---------- | ------------------------------------ | ------------------------------------------------------- |
| Backend    | `GET http://localhost:5000/api/health` | `{ "success": true, "message": "Backend is running", ... }` |
| AI Service | `GET http://127.0.0.1:8000/health`   | `{ "success": true, "message": "AI service is running", ... }` |

The frontend home page (`/`) calls the backend health endpoint through the shared
Axios instance and shows the connection status ("Backend connection: online").

---

## Authentication & roles (Phase 1)

**Strategy:** the backend issues a JWT and delivers it in a single **HTTP-only,
SameSite=Lax cookie** (`secure` in production). JavaScript never sees the token;
the browser attaches it automatically (`axios` uses `withCredentials`). On load
the SPA calls `GET /api/auth/me` to rehydrate the session, so a refresh keeps the
user logged in. Logout clears the cookie server-side.

**Roles:** `ADMIN`, `ORGANISER`, `USER`. Registration is public for `USER` and
`ORGANISER` only — `ADMIN` is rejected. The first admin is created out-of-band:

```bash
cd backend
# set ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env first
npm run seed:admin        # idempotent — safe to run repeatedly
```

**Auth API**

| Method & path            | Auth        | Purpose                                  |
| ------------------------ | ----------- | ---------------------------------------- |
| `POST /api/auth/register`| public      | Create a USER or ORGANISER account       |
| `POST /api/auth/login`   | public      | Verify credentials, set the auth cookie  |
| `POST /api/auth/logout`  | public      | Clear the auth cookie                    |
| `GET  /api/auth/me`      | cookie      | Current user's safe profile              |
| `GET  /api/admin/test`   | ADMIN       | RBAC verification endpoint (Phase 1)     |
| `GET  /api/organiser/test`| ORGANISER  | RBAC verification endpoint (Phase 1)     |
| `GET  /api/user/test`    | USER        | RBAC verification endpoint (Phase 1)     |

**Frontend routes:** `/login`, `/register` (public); `/admin/*`, `/organiser/*`,
`/user` are guarded by `RoleProtectedRoute` — unauthenticated visitors go to
`/login`; a signed-in user hitting the wrong area is redirected to their own.
Frontend guards are UX only; the backend enforces the same rules on every API.

**Password policy:** at least 8 characters, including at least one letter and one
number.

---

## Admin module (Phase 2)

`/admin/*` is its own dashboard shell (sidebar + header). Every `/api/admin/*`
route requires an authenticated **ADMIN**.

| Method & path | Purpose |
| --- | --- |
| `GET /api/admin/dashboard/stats` | Real platform + event roll-ups + recent activity |
| `GET /api/admin/users` · `PATCH /api/admin/users/:id/status` | All accounts; activate/deactivate (an admin cannot deactivate themselves; `role` in the body is ignored) |
| `GET /api/admin/organisers` · `PATCH /api/admin/organisers/:id/status` | The same, scoped to organisers |
| `GET /api/admin/events` · `PATCH /api/admin/events/:id/status` | Event oversight; administrative status change (e.g. cancel) |

## Events (Phase 3)

**Event model** (`backend/src/models/event.model.js`) is the central entity, kept
focused: title, description, category, `organiser` (ref User), venue, start/end
dates, optional registration window, optional `maxParticipants`, optional image
URL, and `status`. Future planning concerns get their own models with an `event`
reference.

- **Status lifecycle:** `DRAFT → PLANNED → UPCOMING → ONGOING → COMPLETED`, or
  `CANCELLED`. Manual transitions in this phase — any valid value can be set by
  the owner (or, administratively, by an admin). New events are always `DRAFT`.
- **Categories:** `WORKSHOP, SEMINAR, CONFERENCE, HACKATHON, CULTURAL, SPORTS,
  TECHNICAL, ACADEMIC, OTHER`.
- **Ownership** is set from the session (`event.organiser = req.user.id`) and
  never from the request body. An organiser may only read/edit/delete/​re-status
  their own events; the backend enforces this on every route. An admin can see
  and administratively cancel any event but never becomes its owner.
- **Delete is a soft delete** (`isDeleted` / `deletedAt`) so later phases
  (registrations, attendance, certificates, reports) keep a stable reference.
  Every query filters soft-deleted events out.
- **Dates:** the client sends full ISO (UTC) strings; `datetime-local` inputs are
  converted to/from UTC in the browser so no date silently shifts.

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/events` | ORGANISER | Create (status forced to `DRAFT`) |
| `GET /api/events/my` | ORGANISER | Own events — `?search=&status=&page=&limit=` |
| `GET /api/events/my/stats` | ORGANISER | Own per-status counts (dashboard) |
| `GET /api/events/:id` | ORGANISER owner, or ADMIN | One event |
| `PATCH /api/events/:id` | ORGANISER owner | Edit content (not status/owner) |
| `PATCH /api/events/:id/status` | ORGANISER owner | Change status |
| `DELETE /api/events/:id` | ORGANISER owner | Soft delete |

**Organiser routes:** `/organiser` (dashboard), `/organiser/events` (My Events),
`/organiser/events/create`, `/organiser/events/:id`, `/organiser/events/:id/edit`.

---

## Pre-event planning (Phase 4)

Each event gets a **planning workspace** at `/organiser/events/:id/planning`
(open it from the event's details page). Tabs: **Overview · Tasks · Schedule ·
Resources · Budget · Team · Readiness**.

Five planning models, each with an `event` reference (the Event stays focused —
planning data is never crammed into it):

| Model | Key fields | Enums |
| --- | --- | --- |
| `EventTask` | title, description, assignedTo, priority, status, dueDate | priority `LOW/MEDIUM/HIGH/CRITICAL`; status `TODO/IN_PROGRESS/COMPLETED` |
| `EventSchedule` | title, startTime, endTime, location, type | type `SESSION/REGISTRATION/CEREMONY/BREAK/MEAL/WORKSHOP/OTHER` |
| `EventResource` | name, category, quantity, unit, status, estimatedUnitCost, notes; `estimatedTotalCost` is a virtual (qty × unit cost) | status `REQUIRED/ORDERED/AVAILABLE/NOT_AVAILABLE` |
| `EventBudgetItem` | category, description, estimatedAmount, actualAmount (`null` = not entered), status, notes | status `PLANNED/APPROVED/PAID` |
| `EventTeamMember` | name, email, role, responsibility, status (contact record — **not** a User account) | status `INVITED/CONFIRMED/ACTIVE/COMPLETED` |

**API** — all under `/api/events/:eventId/...`, requiring an authenticated
**ORGANISER who owns `:eventId`** (checked once, in middleware; USER/ADMIN → 403):

| Path (× GET list, POST create, PATCH `:id`, DELETE `:id`) |
| --- |
| `/tasks` `/schedule` `/resources` `/budget` `/team` |
| `GET /planning/overview` — real counts + progress + readiness summary + needs-attention + upcoming deadlines |
| `GET /planning/readiness` — component scores + weighted overall + needs-attention |

**Readiness** is deterministic and documented in
`backend/src/services/planning.service.js`:

```
component (0–100):  tasks = completed/total ·  schedule = 100 (or 60 with a conflict, 0 if none)
                    resources = AVAILABLE/total ·  budget = (APPROVED+PAID)/total ·  team = CONFIRMED+/total
weights:            tasks 30 · schedule 20 · resources 20 · budget 15 · team 15   (= 100)
overall = round(Σ score×weight / 100)
status:  0–39 NOT_READY · 40–69 PARTIALLY_READY · 70–89 MOSTLY_READY · 90–100 READY
```

Schedule items whose times overlap are flagged as conflicts (a warning, not a
block). Deletes across all planning areas require a confirmation dialog.

---

## AI Planning Assistant (Phase 5)

An eighth tab, **AI Assistant**, in the planning workspace
(`/organiser/events/:id/planning/ai`). One action — **Analyze Event Plan** —
reviews the current planning data and returns a structured, prioritised set of
recommendations and risks, plus a plain-language explanation of the readiness
score. It is an **assistant**: everything it returns is informational, and it
never creates, edits or deletes any planning data.

**Request path**

```
Browser ──▶ Express backend ──▶ FastAPI AI service
  (Axios, auth cookie)   (server-to-server JSON: planning data only —
                          no DB credentials, no tokens, no user records)
```

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/events/:eventId/ai/analyze` | ORGANISER who owns `:eventId` (USER / ADMIN → 403) | Analyse the event's planning data |

The backend gathers `{ event, tasks, schedule, resources, budget, team,
readiness }` (readiness is the **existing Phase 4 score**, passed through — never
recomputed), POSTs it to `POST http://127.0.0.1:8000/analyze`, validates the
reply, and returns:

```jsonc
{
  "method": "rule-based",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL",   // highest severity found
  "summary": "…",                                  // data-filled, not generic
  "readinessAssessment": "…",                      // explains the Phase 4 score
  "recommendations": [
    { "category": "TASK|SCHEDULE|RESOURCE|BUDGET|TEAM|GENERAL",
      "priority": "…", "title": "…", "description": "…",
      "reason": "…", "suggestedAction": "…" }
  ],
  "risks": [
    { "category": "…", "severity": "…", "title": "…",
      "description": "…", "mitigation": "…" }
  ],
  "readiness": { "overallScore": 0, "status": "…" },
  "basedOn": { "tasks": 0, "schedule": 0, "resources": 0, "budget": 0, "team": 0 },
  "generatedAt": "ISO-8601"
}
```

**How the analysis works.** The FastAPI service (`ai-service/services/analyzer.py`)
runs a **deterministic rule-based analyzer** over the supplied data — it is *not*
a machine-learning model or an LLM, and the response says so
(`"method": "rule-based"`). Every statement it makes is backed by a value in the
input (an overdue critical task, a `NOT_AVAILABLE` technical resource, an
overlapping schedule pair, actuals exceeding the estimate, a registration slot
with no team member assigned, …). Missing-preparation suggestions are only raised
when other data implies the need (e.g. it suggests a technical-setup task only
when the schedule has sessions or a technical resource exists). Output is sorted
CRITICAL → LOW and `CRITICAL` is reserved for evidence-backed cases. The single
seam for a future LLM narrative layer is `analyzer._narrative()`.

**Fallback / error behaviour.** If the AI service is unreachable, times out, or
returns an unexpected shape, the endpoint responds **503** with
`{"message": "AI planning assistance is temporarily unavailable."}` and nothing
internal (no stack, no Python detail). The UI shows that message with a **Try
Again** button; **the rest of the planning workspace keeps working**. The AI
result is generated on demand and is **not** stored in MongoDB — after any
planning change the organiser re-runs **Analyze Again**.

---

## Participant event discovery & registration (Phase 6)

A participant (`USER`) area at `/user/*` (its own dashboard shell — sidebar:
**Dashboard · Browse Events · My Events**):

- **Browse Events** (`/user/events`) — public events only, with title/venue
  search (case-insensitive), a category filter and an "upcoming only" toggle.
- **Event details** (`/user/events/:id`) — public information only (never
  organiser tasks, schedule, resources, budget, team, AI or readiness data),
  plus a registration panel.
- **Register / cancel / re-register** — one action; state-aware button
  (**Register Now** → **Registered** + **Cancel Registration** →
  **Register Again**).
- **My Events** (`/user/my-events`) — the participant's own registrations with
  status, dates, "view event" and "cancel" (with confirmation).

An organiser sees the participant list for **their own** events at
`/organiser/events/:id/participants` (linked from the event details page):
name, email, status, registered/cancelled dates — never passwords.

**Visibility & registrability** follow the existing Event status model (no new
status system):

| Event status | In discovery list | Registrable |
| --- | --- | --- |
| `DRAFT` | no (behaves as "not found" to participants) | no |
| `PLANNED`, `UPCOMING` | yes | **yes** |
| `ONGOING` | yes | no (already in progress) |
| `COMPLETED`, `CANCELLED` | no | no |
| soft-deleted | no | no |

If the event sets `registrationStartDate` / `registrationEndDate`, registration
is only allowed inside that window. If it sets `maxParticipants`, registration
is blocked once that many active registrations exist ("This event is full.").

**Registration model** (`backend/src/models/registration.model.js`):
`{ user, event, status: REGISTERED | CANCELLED, registeredAt, cancelledAt }`.
One row per `(user, event)` — a **unique compound index** enforces that at the
database level. Cancelling flips `status` and stamps `cancelledAt` (the row is
kept for participation history); re-registering **reactivates the same row**, so
a user never has two active registrations and the registration `_id` stays
stable for later attendance to reference.

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/events/public` | USER | Discovery list — `?search=&category=&upcoming=&page=&limit=` |
| `GET /api/events/public/:id` | USER | One public event (+ the caller's registration state) |
| `POST /api/events/:id/register` | USER | Create / reactivate the caller's registration |
| `GET /api/registrations/mine` | USER | The caller's own registrations |
| `PATCH /api/registrations/:id/cancel` | USER (owner) | Cancel the caller's registration |
| `GET /api/events/:id/registrations` | ORGANISER (owner) | Participants for an owned event |

The user is always taken from the JWT session — never a body/param id. A
participant can only see and cancel their **own** registrations; an organiser
can only see the participant list for events they **own** (ownership checked in
the backend). Admin permissions are unchanged — admins are not participants and
`/events/public` returns 403 for them, matching the existing role model.

---

## QR-based attendance & event check-in (Phase 7)

Turns a Phase-6 registration into an event-day check-in:

```
USER → Registration → signed QR credential → ORGANISER scans → verified → Attendance → status
```

### QR credential design

A QR code is **not** the attendance record — it is a signed, opaque credential
for a specific registration on a specific event.

- **Token** (`backend/src/utils/qrToken.js`):
  `base64url({ v, rid, eid, n }) + "." + base64url(HMAC-SHA256(secret, part1))`
  where `rid` = registration id, `eid` = event id, `n` = the registration's
  current `qrNonce`.
- The server stores **only** `qrNonce` on the registration (`select: false`,
  never returned by any API). The token is a pure function of
  `(rid, eid, nonce, secret)`, so the participant's QR page re-renders the same
  code every time — no plaintext stored, no generation race.
- The QR **never** contains a password, hash, JWT, session token, email or any
  user-document field. The QR image encodes
  `{"typ":"EVENT_ATTENDANCE","cred":"<token>"}`.
- On **cancel** the nonce is rotated (the old QR image stops verifying); on
  **re-register** a fresh nonce is issued. Check-in also re-checks the live
  registration status, so a cancelled registration can never be checked in.
- Signing key: `QR_TOKEN_SECRET` (optional — falls back to a value derived from
  `JWT_SECRET`). Credentials are never logged.

### Attendance model (`backend/src/models/attendance.model.js`)

`{ registration, event, user, checkedInBy, checkedInAt, status: 'PRESENT' }` +
timestamps. A **unique index on `registration`** guarantees one check-in per
registration at the database level — concurrent scans of the same QR still
produce exactly one row (the second `create` hits `E11000` → a friendly 409).

### Check-in rules

Attendance is recorded only when **all** hold: the organiser owns the event; the
event status is `UPCOMING` or `ONGOING` (documented gate — `DRAFT`/`PLANNED`
too early, `COMPLETED`/`CANCELLED` closed; **no wall-clock window** check, to
avoid timezone guesswork); the credential signature verifies; the credential's
`eid` matches the scanned event **and** the registration's own event; the nonce
is current; the registration is `REGISTERED`; and no attendance row exists yet.

**Attendance %** = `present / registered × 100`, where `registered` = currently
`REGISTERED` registrations and `present` = check-ins whose registration is still
`REGISTERED` (cancelled registrations count toward neither).

### API

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/registrations/:registrationId/qr` | USER (owner) | The caller's own attendance QR (active registration only) |
| `POST /api/events/:id/attendance/check-in` | ORGANISER (owner) | Verify a scanned `{ credential }` and record attendance |
| `GET /api/events/:id/attendance` | ORGANISER (owner) | Attendance list — `?status=all\|present\|not_checked_in\|cancelled&search=` |
| `GET /api/events/:id/attendance/summary` | ORGANISER (owner) | `{ registered, present, notCheckedIn, cancelled, attendancePercentage }` |

`GET /api/registrations/mine` (Phase 6) now also returns `attendance` per row.

### UI

- **Participant** — a clean **Attendance QR** page (`/user/my-events/:registrationId/qr`,
  linked from *My Events*): event title/date/venue, the QR, registration +
  attendance badges; after check-in it shows **"Attendance Recorded"** and keeps
  the QR visible. *My Events* rows show a **Present** badge once checked in.
- **Organiser** — an **Attendance** page (`/organiser/events/:id/attendance`,
  linked from event details): a summary dashboard (Registered / Present /
  Not checked in / Attendance %), a **camera scanner** (`html5-qrcode`, lazy-loaded)
  with graceful permission handling and an **organiser-only manual-entry**
  fallback, a scan-result card (Attendance Marked / Already Checked In /
  Invalid QR Code — icon + label, not colour alone), a recent-check-ins list,
  and a searchable/filterable attendance table.

Camera permission denial shows *"Camera access is required…"* + **Try Again**;
no camera falls back to manual entry; network failure during verification shows
*"Unable to verify attendance. Check your connection and try again."* — attendance
is never marked client-side. Admin gains no attendance powers.

---

## Certificates & notifications (Phase 8)

### Certificate eligibility

A participation certificate is issued only when **all** hold (checked against
real Phase-6 / Phase-7 records — never a bare registration):

1. a `Registration` exists for the event,
2. it is currently `REGISTERED` (see the §57 policy below),
3. an `Attendance` row exists for that registration,
4. `Attendance.status === 'PRESENT'`,
5. `Event.status === 'COMPLETED'`.

`DRAFT` / `PLANNED` / `UPCOMING` / `ONGOING` / `CANCELLED` events cannot generate
certificates (`POST …/generate` → 409). **§57 policy:** a participant who
checked in and *later* cancelled is not eligible for a **new** certificate; a
certificate issued **before** the cancel is kept — never auto-deleted or revoked.

### Certificate model (`backend/src/models/certificate.model.js`)

```
{ certificateNumber, verificationCode, event, user, registration, attendance,
  recipientName, eventTitle, eventDate, issuerName, institution,
  certificateType: 'PARTICIPATION', status: 'ISSUED', issueDate }
```

- **`certificateNumber`** — `CERT-<year>-<6 digits>`, minted from an atomic
  `Counter` (`{ _id, seq }` + `$inc`), so concurrent generation never collides.
- **`verificationCode`** — 16 unambiguous base32 chars (80 bits), unique,
  displayed grouped as `XXXX-XXXX-XXXX-XXXX`. Contains nothing sensitive.
- Unique indexes on `certificateNumber`, `verificationCode`, and
  **`{ user, event, certificateType }`** — the DB-level guarantee that
  "Generate certificates" is idempotent.
- `recipientName` / `eventTitle` / `eventDate` / `issuerName` are **snapshots**
  taken at issue time so the PDF stays stable.

### PDF generation & storage

The PDF is rendered **on demand** with `pdfkit` (built-in fonts, no logos) from
the certificate record — **no files are stored**, so there is no filesystem
path to traverse and nothing to clean up. Generation smoke-renders the PDF
*before* persisting the record, so a render failure never leaves a fake
`ISSUED` row. Bulk generation is per-participant safe: one failure is counted
and reported, the rest continue.

### Notifications (`backend/src/models/notification.model.js`)

`{ recipient, event, type, title, message, read, readAt }` + timestamps.
Types: `EVENT_REGISTRATION_CONFIRMED`, `ATTENDANCE_RECORDED`,
`CERTIFICATE_ISSUED`, `EVENT_CANCELLED`, `EVENT_UPDATED`. Created as a **side
effect** of the operations that produce them — the producers swallow and log
their own errors and **never break the primary operation**. A partial unique
index on `{ recipient, event, type }` (all types except `EVENT_UPDATED`)
de-duplicates, so a repeat scan, a re-registration or a re-run of "Generate
certificates" never produces a second notification. `EVENT_CANCELLED` /
`EVENT_UPDATED` fan out only to users **currently registered** for that event.

### API

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/events/:id/certificates/eligibility` | ORGANISER (owner) | Per-participant eligibility + certificate status + summary |
| `POST /api/events/:id/certificates/generate` | ORGANISER (owner) | Idempotent bulk generation; returns `{ eligible, generated, alreadyIssued, failed, notEligible }` |
| `GET /api/certificates/mine` | USER | The caller's own certificates |
| `GET /api/certificates/:certificateId/download` | USER (owner) or ORGANISER (owns the event) | The PDF — `?inline=1` to preview |
| `GET /api/certificates/verify/:verificationCode` | **public** | `{ valid, certificate? }` — name / event / dates / number only, **no** email / ids / planning data |
| `GET /api/notifications` `?unread=&page=&limit=` | USER | The caller's notifications |
| `GET /api/notifications/unread-count` | USER | Badge count |
| `PATCH /api/notifications/:notificationId/read` | USER (owner) | Mark one read |
| `POST /api/notifications/read-all` | USER | Mark all the caller's notifications read |

### UI

- **Participant** — `/user/notifications` (read/unread, per-item + "Mark all as
  read", type chips, sidebar unread badge fed once per mount, no polling) and
  `/user/certificates` (number, dates, verification code, **View** / **Download**).
  *My Events* rows gain a **Certificate** shortcut once the event is completed
  and attendance is `PRESENT`.
- **Organiser** — `/organiser/events/:id/certificates` (linked from event
  details): eligibility summary cards, a **Generate certificates** action
  (disabled until the event is `COMPLETED`) with a generation-result panel, and
  an eligibility table with per-row certificate status + download.
- **Public** — `/verify` and `/verify/:code` — enter a code, see a
  valid/invalid result with the certificate's public details.

Admin gains no certificate or notification powers.

---

## Feedback & sentiment analysis (Phase 9)

Participants leave feedback on events they actually attended; the AI service
classifies each comment's sentiment; organisers see the feedback and a basic
summary for their own events.

### Eligibility

Feedback for an event is available to a participant only when **all** hold:

1. the event's `status` is `COMPLETED` (not `UPCOMING` / `ONGOING` / `CANCELLED`);
2. the participant has a `REGISTERED` registration for it; and
3. an `Attendance` record with `status: 'PRESENT'` exists for that registration.

A cancelled registration makes the participant ineligible for **new** feedback;
feedback submitted earlier is kept. One feedback per participant per event is
enforced by a unique index. Editing your own feedback is allowed and does not
re-check eligibility (it is a record of participation that already happened).

### Feedback model (`backend/src/models/feedback.model.js`)

`{ event, user, registration, attendance, rating (1–5 integer), comment
(≤1000 chars, optional — min 5 when supplied), sentiment
(POSITIVE|NEUTRAL|NEGATIVE|null), sentimentScore (0–1|null),
sentimentStatus (PENDING|ANALYZED|FAILED|SKIPPED), sentimentModel,
sentimentAnalyzedAt }` + timestamps. Indexes: unique `{user, event}`, plus
`{event, createdAt}` and `{event, sentiment}` for the organiser view.

### AI sentiment (`ai-service` — `POST /sentiment/analyze`)

The engine is **VADER** (Hutto & Gilbert, 2014) — a published, offline,
lexicon-and-rule sentiment model, loaded once at service start, with a small
event-feedback lexicon extension. It is **not** a keyword count and **not** a
fabricated result; responses carry `method: "vader"`. Request `{ "text": "..." }`
→ `{ sentiment, score (|compound|, a model confidence — not a calibrated
probability), compound, breakdown: {positive, neutral, negative}, method,
model }`. Empty / oversized / malformed input → `422`.

Classification bands on VADER's compound score: `≥ 0.35` POSITIVE,
`≤ -0.35` NEGATIVE, otherwise NEUTRAL (a widened neutral band so lukewarm
feedback is not over-reported as positive/negative).

Sentiment is analysed **synchronously before the feedback is saved**. If the AI
service is unavailable the feedback is still saved with `sentimentStatus:
'FAILED'` and no sentiment — a submission never fails because of sentiment
analysis. Editing the comment re-runs analysis so the stored sentiment always
matches the current text; a rating-only edit leaves it untouched. Rating-only
feedback is stored `SKIPPED` (nothing to analyse).

### Notification

`FEEDBACK_AVAILABLE` is created when an event transitions **into** `COMPLETED`
(by its organiser or an admin), for each participant who was `REGISTERED` **and**
`PRESENT`. It reuses the Phase 8 `Notification` model, is de-duplicated per
`(recipient, event)` by both a safe existence check and the partial unique
index, and is never sent for `CANCELLED` events.

### API

| Endpoint | Role | Purpose |
| --- | --- | --- |
| `GET /api/events/:id/feedback/mine` | USER | Eligibility + the caller's feedback (if any) — drives the form |
| `POST /api/events/:id/feedback` | USER (eligible) | Submit feedback (`{ rating, comment? }`) |
| `PATCH /api/events/:id/feedback/:feedbackId` | USER (owner) | Edit own feedback |
| `GET /api/events/:id/feedback` | ORGANISER (owns event) | All feedback + basic summary |

Rating is validated on the backend (integer 1–5; `0` / `6` / negative /
non-numeric rejected). Comments are stored verbatim and rendered as escaped text
by React — never as HTML. The organiser view exposes participant **name**,
rating, comment, sentiment and date — no email, no ids, no planning data.

### UI

- **Participant** — `/user/feedback` (a hub listing every attended completed
  event with its feedback status) and `/user/feedback/:eventId` (the star-rating
  + comment form, or the submitted feedback read-only with an **Edit** action;
  the form is withheld when the participant is not eligible). *My Events* and the
  `FEEDBACK_AVAILABLE` notification both link here.
- **Organiser** — `/organiser/events/:id/feedback` (linked from event details):
  summary cards (responses, positive / neutral / negative, average rating) and a
  list of feedback cards with participant name, rating, comment and a sentiment
  badge. This is a **basic** summary — not the analytics dashboard of a later
  phase.

Admin gains no feedback powers.

---

## Post-event analytics & reporting (Phase 10)

A **read-only** layer that turns the records created across the event lifecycle
(Event, Registration, Attendance, Certificate, Feedback + sentiment) into
post-event statistics and a downloadable report. Nothing is stored or mutated —
every figure is recomputed from the current database state on each request
(§33/§36/§37).

### Access

`GET /api/events/:id/analytics` and `GET /api/events/:id/report` — the **owning
ORGANISER** or any **ADMIN**. A USER gets `403`; a cross-organiser request gets
`403`. Ownership is resolved from the database against the authenticated id —
never from `req.query`/`req.body` (§71). The report additionally requires the
event to be `COMPLETED` (`409` otherwise).

### Availability policy — `analyticsStatus`

The backend returns an explicit `analyticsStatus` (`AVAILABLE` | `PARTIAL` |
`NOT_AVAILABLE`) plus the boolean `analyticsAvailable`. The analytics UI and the
report gate both consume this — the frontend never re-derives availability from
the event status.

| Event status | `analyticsStatus` | Analytics page | Report |
| --- | --- | --- | --- |
| `COMPLETED` | `AVAILABLE` | full analytics + charts + performance summary | ✅ |
| `ONGOING` | `PARTIAL` | "in progress" notice + current registrations + check-ins so far (no completed-event framing) | `409` |
| `UPCOMING` / `PLANNED` / `DRAFT` | `NOT_AVAILABLE` | "not yet available" notice + current registration count only | `409` |
| `CANCELLED` | `NOT_AVAILABLE` | a clear "Event Cancelled" label + registration counts (labelled as pre-cancellation) — **no** performance summary, **no** score | `409` |

Registration information is always returned — it is never destroyed or hidden;
only the *completed-event framing* (rates, summary, report) is withheld.

### Metrics & formulas

All rates are rounded to one decimal place; every denominator is guarded against
zero (→ `0`, never `null` / `NaN` / `Infinity`); the two "participation" rates
are additionally **clamped to ≤ 100 %**.

| Metric | Definition |
| --- | --- |
| Registrations | `Registration` rows with `status: 'REGISTERED'` (cancelled shown separately) — the current valid registration state |
| Attendees (`attendance.present`) | `Attendance` rows with `status: 'PRESENT'` whose registration is still `REGISTERED` |
| Absent | `registered − present` (min 0) |
| **Attendance rate** | `present / registered × 100` — both sides exclude cancelled, so this can never exceed 100 % |
| **Participants who attended** (`participation.attendedParticipants`, `certificates.eligible`) | **historical** — distinct users who were ever `PRESENT`, regardless of any later registration cancellation |
| Feedback responses | `Feedback` rows for the event |
| **Average rating** | `Σ rating / responses` (or `null` when there is no feedback) |
| Rating distribution | count of responses at each of 1–5 stars |
| Sentiment counts | `Feedback` rows grouped by `sentiment` ∈ {POSITIVE, NEUTRAL, NEGATIVE}; rows with no valid classification are excluded from the denominator |
| **Sentiment %** | `positive / analysed × 100` (same for neutral / negative), `analysed = positive + neutral + negative` |
| **Feedback participation rate** | `feedback responses / attendedParticipants × 100`, **clamped ≤ 100** |
| Certificates issued | `Certificate` rows with `status: 'ISSUED'` (total) |
| Eligible participants | `attendedParticipants` (historical) for an `AVAILABLE` event; `0` otherwise |
| **Certificate issuance rate** | `issuedForEligible / eligible × 100`, **clamped ≤ 100** (`0` when nobody is eligible). `issuedForEligible` = distinct eligible participants who hold an ISSUED certificate |

**Why historical eligibility.** A participant who attended, received a
certificate, and then cancelled their registration is still counted as having
attended — so the certificate-issuance and feedback-participation rates use a
*historical* attendee count as the denominator and can never exceed 100 %, even
though the live registration count (and `attendance.present`) correctly drop to
reflect the cancellation.

Figures come from a single `Promise.all` of aggregation `$group`s plus lean,
single-field projections of the event's attendance / certificate rows (used only
to de-duplicate by participant) — no per-user document loads, no N+1 (§34/§35).

### Admin platform summary

`totalAttendees` = **distinct participants** who actually attended, counted from
valid attendance records (`PRESENT` check-ins whose registration is still
`REGISTERED`, de-duplicated by user). `totalRegistrations` = active `REGISTERED`
registration rows.

### API

| Endpoint | Role | Returns |
| --- | --- | --- |
| `GET /api/events/:id/analytics` | ORGANISER (owner) / ADMIN | `{ event, state, analyticsStatus, analyticsAvailable, registrations, attendance, feedback, sentiment, certificates, participation, performanceSummary, generatedAt }` — **read-only** |
| `GET /api/events/:id/report` `?inline=1` | ORGANISER (owner) / ADMIN | `application/pdf` (only when `analyticsStatus === 'AVAILABLE'`, else `409`) — **read-only** |
| `GET /api/admin/analytics/summary` | ADMIN | basic platform totals: events by status, registrations, attendees, feedback total + average, sentiment totals, certificates issued |

### Report

A one-to-two-page A4 PDF (`pdfkit`, no new dependency). It **consumes the same
analytics object** returned by `getEventAnalytics` — every value in the report
(attendance rate, average rating, rating distribution, sentiment, feedback
participation, certificate eligibility / issuance / rate) is byte-for-byte the
number shown on the analytics page. Contents: event name / date / status /
organiser / a report reference / the event id / the generation timestamp, then
the registration, attendance, feedback (with rating distribution), sentiment and
certificate sections (each with small bar charts), and a **strictly factual**
performance summary — no success claims, no recommendations (§53/§74).
Filename `<EventTitle>_Report.pdf`.

### UI

- **Organiser** — `/organiser/analytics` (a sidebar item): an event selector
  (own events, `?event=<id>` deep-links), the six overview stat cards, three
  dependency-free bar charts (registration vs attendance, rating distribution,
  sentiment), a factual summary, and **Preview report** / **Download report**.
  Completed-event rows on *My Events* and the event-details header gain a
  **View Analytics** link.
- **Admin** — `/admin/statistics` (was a placeholder): the platform roll-up
  cards + a platform-sentiment chart, plus the same per-event analytics view via
  a selector over **every** event.
- Charts carry visible text labels and numeric values (never colour alone —
  §42). Loading, empty ("No registration/feedback data available") and error
  states are handled; no polling, one request per selected event (§78).

---

## AI-based future event improvement recommendations (Phase 11)

**AI-based, data-grounded future event improvement recommendations** for a
*single completed event*, built strictly from that event's own historical
records — never cross-event trends, never forecasting, never a prediction of
what a future event's outcome will be. The engine explains what already
happened and suggests what an organiser may want to consider next time; it
never guarantees an outcome.

### How it works

1. The backend reuses the existing, corrected **Phase 10** analytics service
   (`getEventAnalytics`) and the existing **Phase 5** planning gatherer
   (`gatherAiContext`) — there is exactly one place each metric formula lives;
   Phase 11 duplicates none of them.
2. That combined snapshot (registrations, attendance, feedback, sentiment,
   certificates, participation, tasks, schedule, resources, budget, team,
   readiness) is sent to the AI service's `POST /improve-event` endpoint.
3. A transparent **rule-based** engine (no ML model, no LLM — the same
   philosophy as Phase 5's Planning Assistant and Phase 9's sentiment engine)
   evaluates nine recommendation categories against the real numbers it was
   given and returns only the recommendations the data supports.
4. The backend independently re-validates every recommendation before storing
   it — dropping anything with an invalid category, missing evidence, an empty
   `sourceMetrics` list, a non-finite number, or wording that oversells the
   result — before it ever reaches an organiser.

### Recommendation categories

`SCHEDULING` · `CAPACITY_PLANNING` · `REGISTRATION_MANAGEMENT` ·
`ATTENDANCE_IMPROVEMENT` · `VENUE_AND_RESOURCES` · `VOLUNTEER_AND_TEAM` ·
`BUDGET_AND_COST` · `FEEDBACK_AND_EXPERIENCE` · `CERTIFICATE_AND_POST_EVENT`.
A category is only produced when the underlying data supports it — e.g. no
capacity recommendation is generated when the event has no `maxParticipants`,
no scheduling recommendation when no schedule was recorded.

Each recommendation carries: `category`, `title`, `priority`
(`LOW`/`MEDIUM`/`HIGH`), the `recommendation` text, a `reason`, `evidence`
(the real numbers behind it), a cautiously-worded `expectedBenefit`,
`confidence` (an **evidence-strength** label — how much underlying data the
recommendation rests on, e.g. sample size — **not** a statistical confidence
interval or an ML probability), and `sourceMetrics` (which fields of the
snapshot it was derived from). The response also includes top-level
`strengths[]`, `improvementAreas[]`, and a mandatory `limitations[]` section
that says plainly when data was missing or insufficient (e.g. *"Budget data
was unavailable."*, *"No scheduling recommendation was generated because
historical timing data was insufficient."*).

### Grounding & safety

- The rule engine only ever **echoes real input numbers** into `evidence` — it
  never invents a rating, a percentage, a budget figure, or a reason not
  present in the data.
- Missing or insufficient data always produces a *limitation*, never a guess.
- The backend screens every recommendation for banned, outcome-guaranteeing
  language (e.g. *"will definitely increase attendance"*, *"guaranteed
  success"*, *"this event will fail"*, *"predicted attendance will be exactly
  …"*) and drops anything that matches, belt-and-braces on top of the engine
  never emitting it.
- Nothing here predicts attendance, predicts event success, forecasts a
  future event, or claims a guaranteed outcome for the *next* event.

### Access

`GET /api/events/:id/improvements` — the **owning ORGANISER** or any
**ADMIN** (view-only, matching the Phase 10 analytics access pattern).
`POST /api/events/:id/improvements/generate` — the **owning ORGANISER only**
(generation is left to the organiser's own judgement, the same rule used for
certificate generation in Phase 8 — admin does not generate on an organiser's
behalf). A USER or an unauthenticated caller gets `401`/`403`; a cross-owner
request gets `403`; ownership is resolved from the database against the
authenticated session, never from `req.query`/`req.body`. Recommendations are
only generated for a `COMPLETED` event — `DRAFT`/`UPCOMING`/`ONGOING`/
`CANCELLED` return a `409` on generate and a safe "not available yet" state on
read, with a plain-language reason.

### Storage

One `ImprovementRecommendation` document **per event**, upserted on each
`generate` call (regenerating never accumulates a history — it is safe to run
again after new certificates/feedback come in). It stores the event and
organiser reference, a snapshot of the analytics figures used, the
recommendations/strengths/improvementAreas/limitations, the AI method/engine
version, and a generation timestamp — no passwords, tokens, or unnecessary
personal data.

### API

| Endpoint | Role | Returns |
| --- | --- | --- |
| `GET /api/events/:id/improvements` | ORGANISER (owner) / ADMIN | the latest stored recommendations, or `{ generated:false, reason }` if not yet generated / not completed — **read-only, never calls the AI service** |
| `POST /api/events/:id/improvements/generate` | ORGANISER (owner) | generates (or regenerates) and stores recommendations for a completed event; `409` if not completed |

### Future-plan integration — copyable checklist only

The organiser can tick individual recommendations and build a plain-text
checklist (`- [ ] title: recommendation`) to copy into their next event's
planning. This is **entirely client-side** — nothing is written to the
backend, and nothing is auto-applied. Using a recommendation never
automatically changes an event's dates, venue, capacity, or budget, never
assigns a volunteer, sends a notification, or modifies any existing
registration, attendance record, or certificate. Turning a recommendation
into real planning changes is always a deliberate, separate action the
organiser takes in the Phase 4 planning workspace.

### AI service

`POST /improve-event` on the same FastAPI service used since Phase 5 (no new
service). Deterministic, rule-based (`ai-service/services/improvement.py`),
zero ML/LLM libraries — every response carries `method:"rule-based"` and an
`engine` version string. Validates its input with Pydantic, never touches
MongoDB, never requires a password or JWT, and never modifies any record.
`GET /health`'s `capabilities` now also reports `improvementRecommendations`.

### UI

`/organiser/improvements` (a sidebar item, plus a **View Improvements** link
on a completed event's details page): an event selector (completed events
first), a **Generate recommendations** / **Regenerate recommendations**
button, Strengths and Improvement areas lists, recommendation cards grouped
with priority + evidence-strength badges, evidence and source-metric detail,
a Limitations section, and the checklist builder described above. Non-
completed events show a clear, non-alarming "not available yet" state instead
of an error.

### AI service unit tests

Kept in-tree, like the Phase 5 and Phase 9 AI test suites:

```bash
cd ai-service && pytest tests/test_improvement.py -q
```

---

## Available scripts

### Frontend (`frontend/`)

| Command           | Description                        |
| ----------------- | -------------------------------- |
| `npm run dev`     | Start the Vite dev server         |
| `npm run build`   | Production build to `dist/`       |
| `npm run preview` | Preview the production build      |

### Backend (`backend/`)

| Command              | Description                              |
| -------------------- | -------------------------------------- |
| `npm run dev`        | Start with nodemon (auto-restart)       |
| `npm start`          | Start with plain node                   |
| `npm run seed:admin` | Create the initial ADMIN account (idempotent) |

---

## Environment variables

Each service ships a `.env.example`. Copy it to `.env` (git-ignored) and adjust.
Never commit real secrets.

**backend/.env**

```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/event_management_system
CLIENT_URL=http://localhost:5173

# Auth (Phase 1) — JWT_SECRET is required; the server refuses to start without it.
JWT_SECRET=change_this_to_a_long_random_secret
JWT_EXPIRES_IN=1d
AUTH_COOKIE_NAME=em_token

# QR attendance (Phase 7) — optional; falls back to a value derived from JWT_SECRET.
# QR_TOKEN_SECRET=change_this_to_a_long_random_secret

# Initial admin — used only by `npm run seed:admin`
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change_this_admin_password_1

# AI service (Phase 5) — the backend calls this; the browser never does.
AI_SERVICE_URL=http://127.0.0.1:8000
AI_TIMEOUT_MS=20000
```

**frontend/.env**

```
VITE_API_URL=http://localhost:5000/api
```

**ai-service/.env**

```
AI_SERVICE_HOST=127.0.0.1
AI_SERVICE_PORT=8000
```

---

## Roadmap

Done: **Phase 0** full-stack foundation · **Phase 1** authentication & RBAC ·
**Phase 1.5** clean database (`event_management_system`) · **Phase 2** Admin
module · **Phase 3** Event model + organiser dashboard + event CRUD + ownership +
lifecycle + admin oversight · **Phase 4** pre-event planning workspace (tasks,
schedule, resources, budget, team, overview, readiness) · **Phase 5** AI Planning
Assistant (rule-based analysis → prioritised recommendations & risks + readiness
explanation) · **Phase 6** participant event discovery + online registration
(browse/search/filter, register/cancel/re-register, My Events, organiser
participant list) · **Phase 7** QR-based attendance & event check-in (signed QR
credential per registration, camera/manual organiser scanner, dedicated
Attendance model, attendance dashboard + list + live summary) · **Phase 8**
automated participation certificates (attendance-gated eligibility, idempotent
bulk generation, on-demand `pdfkit` PDF, public verification) + a database-backed
notification centre (registration / check-in / certificate / cancellation) ·
**Phase 9** participant feedback (1–5 star rating + optional comment,
attendance-gated, one per participant per event) + AI sentiment analysis
(VADER, `POST /sentiment/analyze`, POSITIVE / NEUTRAL / NEGATIVE + confidence,
re-run on edit) + an organiser feedback view with a basic sentiment summary +
a `FEEDBACK_AVAILABLE` notification ·
**Phase 10** post-event analytics, statistics & reporting (a read-only organiser
analytics page — registration / attendance / feedback / rating-distribution /
sentiment / certificate statistics derived from existing records, dependency-free
bar charts, a factual performance summary, a downloadable PDF report; a basic
platform roll-up on the admin Statistics page; ADMIN can view any event) ·
**Phase 10 Fix** analytics/reporting data-consistency stabilization (historical,
never-exceeds-100% certificate issuance & feedback-participation formulas, an
explicit `analyticsStatus` availability contract, a corrected distinct-attendees
admin metric, defensive chart/report clamping) ·
**Phase 11** AI-based, data-grounded future event improvement recommendations
(a transparent rule-based engine analyses one completed event's own historical
records — registrations, attendance, feedback, sentiment, certificates,
planning — across nine recommendation categories, with mandatory evidence,
evidence-strength labelling, and a limitations section; ORGANISER-owner
generates, ADMIN can view; a purely client-side, opt-in checklist to carry
ideas into the next event's planning — no automatic changes to any event,
booking, budget, volunteer assignment, notification, registration, attendance,
or certificate).

Later phases (not implemented yet): cross-event trend analysis, attendance/
success prediction, and any other forecasting feature.
