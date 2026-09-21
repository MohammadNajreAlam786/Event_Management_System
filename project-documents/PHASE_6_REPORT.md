# Phase 6 — User Event Discovery & Online Registration — Implementation Report

**Project:** AI-Powered Event Planning & Management System with QR-Based Attendance
**Phase:** 6 — participant (USER) event discovery + online registration
**Date:** 2026-09-07
**Database:** `event_management_system` (existing; a new `registrations` collection added — `event_management` untouched)
**Services:** Frontend `:5173` · Backend `:5000` · FastAPI AI service `:8000` · MongoDB `:27017`

Not in this phase (deliberately): QR generation / scanning / attendance, check-in, certificates, feedback, sentiment analysis, post-event analytics, advanced notifications. The AI Planning Assistant was not modified.

---

## 1. Summary

A full participant side was added on top of the existing Phase 3 Event system (no
event CRUD was duplicated). A logged-in `USER` now has their own area at
`/user/*` — a dashboard shell with **Dashboard · Browse Events · My Events** —
where they can:

- **browse** public events with case-insensitive title/venue search, a category
  filter and an "upcoming only" toggle;
- **view** a clean, public-only event details page (no organiser planning,
  budget, resources, team, AI or readiness data);
- **register** for a registrable event (one action, state-aware button);
- see a **My Events** list of their own registrations with status and dates, and
  **cancel** a registration (with confirmation);
- **re-register** for an event they previously cancelled while it is still open.

Duplicate registrations are impossible (a unique DB index plus reactivation
logic). Cancelled registrations are preserved as history. Registration honours
the existing event status model, the optional registration window, and the
optional `maxParticipants` capacity.

An **organiser** can view the participant list for **events they own** at
`/organiser/events/:id/participants` (name, email, status, dates — never
passwords), linked from the event details page. Admin permissions are unchanged.

---

## 2. User Workflow

```
USER (logs in) ──▶ /user  (dashboard: registration snapshot + "what's on soon")
      │
      ▼
Browse Events  /user/events        search · category · "upcoming only" · paginated
      │  (public events only: PLANNED / UPCOMING / ONGOING — never DRAFT / CANCELLED /
      │   COMPLETED / soft-deleted)
      ▼
View Event  /user/events/:id       public info only + a registration panel
      │
      ▼
Register  ── POST /api/events/:id/register ──▶ 201, registration row created
      │        (button: "Register Now" → confirmation → "Registered" + "Cancel Registration")
      ▼
My Events  /user/my-events          status · registered date · "view event" · "cancel"
      │
      ├─▶ Cancel  ── PATCH /api/registrations/:id/cancel ──▶ status CANCELLED, cancelledAt stamped
      │              (row kept — participation history for later phases)
      │
      └─▶ Re-register (event still open) ──▶ same row reactivated → REGISTERED
```

Registration state on any event is one of: **Not registered** → `Register Now` ·
**Registered** → `Registered` + `Cancel Registration` · **Cancelled (event still
open)** → `Register Again` · **Not registrable** → disabled + the reason.

---

## 3. Registration Architecture

**Model** — `backend/src/models/registration.model.js`

```js
Registration {
  user:         ObjectId → User   (required, index)
  event:        ObjectId → Event  (required, index)
  status:       'REGISTERED' | 'CANCELLED'   (default 'REGISTERED')
  registeredAt: Date  (default now)
  cancelledAt:  Date  (default null)
  createdAt, updatedAt            (timestamps)
}
```

**Relationships.** `user` and `event` are ObjectId references, consistent with
the rest of the project (Event → organiser, planning models → event). No user
document is copied into the registration; the participant list populates
`name email` on demand. No passwords are ever stored or returned.

**Duplicate prevention.** A **unique compound index `{ user: 1, event: 1 }`** —
so at most one registration row can exist per participant per event, enforced by
MongoDB, not by the disabled button. A second `POST …/register` while an active
row exists returns **409 Conflict** ("You are already registered for this
event."); an `E11000` race is caught and mapped to the same 409.

**Status handling / history.**
- Cancelling flips `status` to `CANCELLED` and stamps `cancelledAt`. The row is
  **not deleted** — participation history survives for attendance / certificates
  in later phases.
- Re-registering **reactivates the same row** (`status = REGISTERED`,
  `registeredAt = now`, `cancelledAt = null`). A user therefore never has two
  active registrations for one event, and the registration `_id` is **stable** —
  Phase 7 attendance can reference it directly.
- A second index `{ event: 1, status: 1 }` backs the organiser participant list
  and the capacity count.

**Registrability** (`evaluateRegistrability`, in the service — no new status
enum): registrable ⟺ `status ∈ {PLANNED, UPCOMING}` **and** (no
`registrationStartDate`, or now ≥ it) **and** (no `registrationEndDate`, or now ≤
it) **and** (no `maxParticipants`, or active registrations < it). Each failing
condition yields a specific friendly message (`cancelled` / `already taken
place` / `in progress` / `not open yet` / `has closed` / `is full`).

**Capacity.** `maxParticipants` is an existing, optional Event field — enforced
only when set, by counting `status: 'REGISTERED'` rows. (A brief check-then-write
window exists under high concurrency; acceptable for this project and noted in
Known Issues.)

---

## 4. API

All new endpoints follow the existing Express conventions (shared
`asyncHandler`, `ApiError`, the `{ success, data, message? }` envelope,
`authenticate` + `requireRole` middleware). Nothing existing was duplicated.

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/events/public` | USER | Discovery list — `?search=&category=&upcoming=&page=&limit=`; each event carries the caller's registration state + capacity |
| `GET /api/events/public/:id` | USER | One public event (any non-DRAFT, non-deleted) + registration state; DRAFT / deleted → 404 |
| `POST /api/events/:id/register` | USER | Create or reactivate the caller's registration |
| `GET /api/registrations/mine` | USER | The caller's own registrations (`?status=` optional) |
| `PATCH /api/registrations/:registrationId/cancel` | USER (owner) | Cancel the caller's registration |
| `GET /api/events/:id/registrations` | ORGANISER (owner) | Participant list for an owned event + summary counts |

Routing: the participant discovery + register + owner-participant-list routes
live in `event.routes.js` (mounted at `/api/events`, ahead of the Phase 4
planning router, so a `USER` request is never caught by the planning router's
`requireRole(ORGANISER)` gate). `GET /mine` and `PATCH …/cancel` live in a new
`registration.routes.js` mounted at `/api/registrations` (whole router:
`authenticate` + `requireRole(USER)`).

---

## 5. Security

Results are from the automated backend suite (71 checks) and the frontend E2E
(34 checks).

| Area | Enforcement | Result |
| --- | --- | --- |
| **Authentication** | Every route uses the existing `authenticate` middleware. No token → **401** on discovery, register, `/registrations/mine`, cancel, participant list. Invalid/tampered token → 401 (existing behaviour). | PASS |
| **User identity** | The user is `req.user.id` from the JWT session — never `req.body.userId` or a param. A participant cannot register or cancel "as" someone else. | PASS (by construction) |
| **RBAC** | `USER` → planning tasks **403**, AI analyze **403**, `/admin/users` **403**, `/events/my` **403**, `/events/:id/registrations` (organiser view) **403**. `ADMIN` → `/events/public` **403** (admins are not participants) while `/admin/events` still **200**. | PASS |
| **User ownership** | `USER` cancelling **another** user's registration → **403**. A user's `/registrations/mine` never contains another user's rows (there is no "get any registration by id" endpoint). | PASS |
| **Organiser event ownership** | Organiser A viewing Organiser B's event participants → **403**; Organiser B viewing A's → **403**; checked in the backend via `loadOwnedEvent` (the same helper used by all Phase 4 planning routes). | PASS |
| **Cross-user testing** | user 1 ✗ user 2's registration (cancel 403, not listed). | PASS |
| **Cross-organiser testing** | A ✗ B's participant list, B ✗ A's. | PASS |
| **Event-id handling** | Invalid ObjectId → **400**; unknown id → **404**; DRAFT via the public detail route → **404**; cancelled/completed via register → **409**. No response body leaks a stack, a Mongo error, a Python detail or an internal path (asserted with a regex over every error body). | PASS |
| **Data privacy** | Participant-facing event responses expose `organiserName` only — never the organiser's email or id, and never any planning/budget/resource/team/AI field. The organiser participant list returns `{ name, email }` only. | PASS |

---

## 6. UI

Reuses the existing design system — the shared `DashboardSidebar` /
`DashboardHeader` shell (as Admin and Organiser use), `EventStatusBadge`,
`EmptyState`, `ConfirmDialog`, `StatCard`, the existing button / card / input
styles, and the `max-w-[1400px]` content cap. No redesign.

| Screen | Notes |
| --- | --- |
| **User dashboard** (`/user`) | Snapshot: active-registration count, cancelled count, available-events count; "my upcoming registrations" list; "what's on soon" list; "Browse events" CTA. |
| **Browse Events** (`/user/events`) | Debounced search, category `<select>`, "upcoming only" checkbox; responsive card grid (`EventCard`); skeleton loading; empty state ("No upcoming events are currently available." / "No events match your search or filters."); error state with **Try again**; pagination. Cards show title, status, category, a truncated description, when/where, capacity ("N of N spots left" / "Full"), a "Registration closed" chip for non-registrable events, a "Registered" chip when the user is registered, and **View details**. |
| **Event details** (`/user/events/:id`) | Public info only + `RegistrationPanel`. 404 → friendly "not available" + back link. Loading skeleton. |
| **Registration** (`RegistrationPanel`) | State machine: `Register Now` → **Registration successful.** confirmation showing event / when / where / status + **View My Events**, then `Registered` + `Cancel Registration`. Cancelled + open → `Register Again`. Not registrable → disabled control + the reason. Register/cancel buttons disable while the request is in flight (no double submit). Cancel shows a `ConfirmDialog`. Errors are friendly (no internals). |
| **My Events** (`/user/my-events`) | Rows: event title + status + registration-status badges, date · venue, "Registered/Cancelled <date>"; **View event**; **Cancel registration** (with `ConfirmDialog`, only for a REGISTERED row whose event is not completed/cancelled). In-place refresh — no full reload. Empty ("You haven't registered for any events yet."), loading (skeleton rows), error (Try again). |
| **Organiser participant list** (`/organiser/events/:id/participants`) | Under the Organiser shell; "← Event details" link; title + status; summary chips (registered / cancelled / capacity); table Participant · Email · Status · Registered · Cancelled; empty state ("No participants have registered for this event yet."); loading skeleton; 403/404 → friendly message + back link. A **Participants** link was added to the event details page header. |

Navigation: the USER sidebar shows only participant links (Dashboard / Browse
Events / My Events) — no organiser or admin items. The Phase-1 `UserPage.jsx` /
`RoleAreaPage.jsx` stubs were removed and replaced by this area.

---

## 7. Responsive Testing

`phase6-responsive-check.mjs` — the four participant routes and the organiser
participant list, each at **1920×1080, 1366×768, 1024×768, 768×1024, 390×844,
375×667**: **90 / 90 passed**.

| Viewport | Result |
| --- | --- |
| **Desktop 1920×1080** | Content capped at 1400px and centred; card grid 3-up; details 2-column (details + registration panel). Screenshots inspected. |
| **Laptop 1366×768** | Well proportioned; sidebar on-canvas; card grid 3-up. |
| **Tablet 1024×768 & 768×1024** | Card grid 2-up (`sm:grid-cols-2`); details panel stacks under the details card; sidebar on-canvas (md = 768); participant table scrolls inside its own container. |
| **Mobile 390×844 & 375×667** | Everything 1-up; search / category / toggle wrap; register + cancel buttons fit side by side; confirmation and dialogs fit; My Events rows stack (`sm:flex-row`); participant table scrolls inside its bordered container — **the page never scrolls sideways**. |
| **No page-level horizontal overflow** at any of the six viewports | verified programmatically (`scrollWidth ≤ clientWidth`) with data loaded, plus status / registration badges asserted non-wrapping |

---

## 8. Testing — actual results

### Backend integration + security — `__phase6_tests.mjs` (removed after the run)

`==== 71 passed, 0 failed ====`

Covers all 15 required test cases plus capacity, admin-preservation, event-id
handling and the DB index:

| Test | Result |
| --- | --- |
| **T1** browse — public events shown (UPCOMING / PLANNED / ONGOING, incl. another organiser's) | PASS |
| **T2** search "machine learning" matches; case-insensitive; category + upcoming filters; bad category → 400 | PASS |
| **T3** details — public fields present; organiser email / id / planning data **absent**; registration + capacity info present | PASS |
| **T4** register → **201**, status `REGISTERED`, stable id, event echoed with `myRegistration` | PASS |
| **T5** duplicate register → **409** "already registered" | PASS |
| **T6** `/registrations/mine` includes the event with its summary | PASS |
| **T7** cancel → **200** status `CANCELLED`; row preserved in the list; cancel again → **409** | PASS |
| **T8** re-register after cancel → **201** `REGISTERED`, **same registration id**, exactly one row for the event | PASS |
| **T9** register for a **CANCELLED** event → **409** | PASS |
| **T10** register for a **COMPLETED** event → **409** | PASS |
| **T11** **DRAFT** event hidden from discovery; `GET /events/public/:draftId` → **404**; register → **404** | PASS |
| **T12** unauthenticated register / discovery / `/registrations/mine` → **401** | PASS |
| **T13** user 1 cancelling user 2's registration → **403**; user 2's row not in user 1's list | PASS |
| **T14** organiser views own event's participants → **200** with name + email + status + registeredAt, no password/hash; summary counts present | PASS |
| **T15** organiser A ✗ organiser B's participant list → **403** (and vice-versa); USER ✗ → 403; no token → 401 | PASS |
| ONGOING event → register **409** ("in progress") | PASS |
| capacity: 2nd participant fills the single spot → 1st gets **409** "This event is full." | PASS |
| §57 USER ✗ planning / AI analyze / `/admin/users` / `/events/my` → **403** | PASS |
| §21 ADMIN `/admin/events` still **200**; ADMIN `/events/public` → **403** | PASS |
| DB: unique compound index on `{ user, event }` present | PASS |
| cleanup: all test events + registrations removed | PASS |

### Frontend E2E — `phase6-frontend-e2e.mjs` (headless Chrome / CDP)

`==== 34 passed, 0 failed ====`

USER navigation (participant-only sidebar); browse shows PLANNED/UPCOMING, hides
DRAFT/CANCELLED, no planning data on cards; **T2** search narrows results; **T3**
details show public info only; **T4** register → "Registration successful."
confirmation with event/date/venue/status + "View My Events"; **T5** the button
state changes (no second "Register Now"); **T6** the event appears in My Events;
**T7** cancel via the confirm dialog → status "Cancelled", row preserved; **T8**
"Register Again" → back to registered, exactly one row; **T9** cancelled event →
"Registration unavailable" + reason; **T11** draft event → "not available";
access control (USER visiting `/organiser/...` → redirected to `/user`); **T14**
organiser "Participants" link → participant list shows the participant's name +
email + status, no password, summary counts; regression (admin dashboard still
renders); **0 console errors**.

### Frontend responsive — `phase6-responsive-check.mjs`

`==== 90 passed, 0 failed ====` (see §7).

---

## 9. Regression — actual results

Re-run after Phase 6 (frontend E2E on a clean browser profile per suite; the AI
service running for the Phase 5 suites):

| Suite | Result |
| --- | --- |
| Phase 1 — backend auth + RBAC | **51 / 51** |
| Phase 1 — frontend E2E | **23 / 23** |
| Phase 2 — Admin E2E | **47 / 47** |
| Phase 2 — Admin responsive | **40 / 40** |
| Phase 3 — Event E2E | **51 / 51** |
| Phase 3 — responsive | **50 / 50** |
| Phase 4 — planning E2E | **44 / 44** |
| Phase 4 — planning responsive | **70 / 70** |
| Phase 5 — AI analyzer scenarios | **26 / 26** |
| Phase 5 — planning E2E | **27 / 27** |
| Phase 5 — planning responsive | **37 / 37** |
| **Regression subtotal** | **466 / 466** |
| **+ Phase 6 (backend 71 · E2E 34 · responsive 90)** | **195 / 195** |
| **Grand total** | **661 / 661** |

Two stale Phase-1 **frontend** E2E assertions were updated (not app fixes): the
`/user` page text check ("User area" → the participant dashboard) because the
Phase-1 USER stub was replaced by the real participant area, and a long-stale
`/admin` "Admin area" text check (broken since the Phase-2 Admin dashboard
replaced that stub). Neither affects application behaviour; the path-based auth
and RBAC assertions in the same suites were unchanged and pass.

---

## 10. Build

| Check | Result |
| --- | --- |
| **Frontend production build** (`npm run build`) | ✓ **173 modules**, **0 errors, 0 warnings**. `index-*.js` 419.41 kB (gzip 121.25) · `index-*.css` 27.18 kB. (165 → 173: +10 new participant modules, −2 removed Phase-1 stubs.) |
| **Backend startup** (`npm start`, cold) | ✓ `MongoDB connected: database "event_management_system"` → `Backend API listening on http://localhost:5000`. `node --check` passes on every file in `backend/src`. |
| **Database connection** | ✓ `event_management_system` on `localhost:27017`; new `registrations` collection with indexes `{_id}`, `{user}`, `{event}`, `{user,event} UNIQUE`, `{event,status}`. Old `event_management` untouched (2 users). |
| **AI service startup** | ✓ still starts (`/health` → 200); not modified this phase. |

---

## 11. Files Changed

Phase-6-specific. (Other files in `git diff` — `CrudSection.jsx`,
`PlanningBadge.jsx`, `AdminLayout.jsx`, `PlanningWorkspaceLayout.jsx`,
`OrganiserDashboard.jsx`, `PlanningBudget.jsx`, `PlanningResources.jsx`,
`ai-service/*`, `backend/src/config/env.js`, `backend/src/middleware/errorHandler.js`,
`backend/src/routes/planning.routes.js`, `backend/.env.example`, the
`package.json` versions — are from the Phase-4 Visual Testing and Phase 5 tasks,
not this phase.)

### New — backend

| File | Why |
| --- | --- |
| `backend/src/models/registration.model.js` | The `Registration` model + `{user,event}` unique index + `{event,status}` index |
| `backend/src/services/registration.service.js` | Discovery / register / reactivate / my-registrations / cancel / organiser-participant-list logic; `evaluateRegistrability`; the participant-safe event serializer (no organiser email, no planning data) |
| `backend/src/controllers/registration.controller.js` | Thin `asyncHandler` handlers for the six endpoints |
| `backend/src/routes/registration.routes.js` | `/api/registrations` router (`authenticate` + `requireRole(USER)`) — `GET /mine`, `PATCH /:id/cancel` |

### New — frontend

| File | Why |
| --- | --- |
| `frontend/src/services/participantService.js` | Axios calls for discovery, register, my-registrations, cancel, organiser participant list |
| `frontend/src/layouts/UserLayout.jsx` | The `/user/*` dashboard shell (reuses `DashboardSidebar` / `DashboardHeader`) |
| `frontend/src/components/event/EventCard.jsx` | Participant-facing event card (public fields only) |
| `frontend/src/components/event/RegistrationStatusBadge.jsx` | Registered / Cancelled / Not-registered pill |
| `frontend/src/components/event/RegistrationPanel.jsx` | The register / registered / cancel / re-register state machine + confirmation |
| `frontend/src/pages/user/UserDashboard.jsx` | `/user` — registration snapshot + "what's on soon" |
| `frontend/src/pages/user/BrowseEvents.jsx` | `/user/events` — search / filter / grid / pagination / empty / loading / error |
| `frontend/src/pages/user/EventDetailsPublic.jsx` | `/user/events/:id` — public details + registration panel |
| `frontend/src/pages/user/MyEvents.jsx` | `/user/my-events` — the participant's registrations + cancel |
| `frontend/src/pages/organiser/OrganiserEventParticipants.jsx` | `/organiser/events/:id/participants` — participant list for an owned event |

### Modified

| File | Change | Why |
| --- | --- | --- |
| `backend/src/routes/event.routes.js` | Added `GET /public`, `GET /public/:id`, `POST /:id/register` (USER), `GET /:id/registrations` (ORGANISER) — placed so `/public` resolves before `/:id` and USER requests never hit the planning router's ORGANISER gate | The participant + organiser-participant endpoints, reusing the existing `/api/events` mount + `authenticate` |
| `backend/src/routes/index.js` | Mounted `registrationRoutes` at `/api/registrations` (before the RBAC-test catch-all) | Expose `GET /mine` and `PATCH /:id/cancel` |
| `frontend/src/routes/AppRoutes.jsx` | Replaced the single `/user` stub route with a nested tree under `<UserLayout>` (index / events / events/:id / my-events / *); added `/organiser/events/:id/participants`; removed the `UserPage` import | Wire up the participant area + the organiser participant list |
| `frontend/src/layouts/OrganiserLayout.jsx` | `titleFor()` maps the `participants` segment → "Participants" | Header title on the new organiser page |
| `frontend/src/pages/organiser/OrganiserEventDetails.jsx` | Added a **Participants** link in the header actions | Entry point to the participant list (§35) |
| `README.md` | New "Participant event discovery & registration (Phase 6)" section (visibility/registrability table, model, endpoint table); status + roadmap updated | Document the feature (§63) |

### Deleted

| File | Why |
| --- | --- |
| `frontend/src/pages/UserPage.jsx` | Phase-1 "User area" stub — replaced by `UserDashboard` under `UserLayout` |
| `frontend/src/components/RoleAreaPage.jsx` | Backed only `UserPage` (Admin/Organiser stopped using it in Phases 2–3); now unused |

---

## 12. Known Issues

1. **Capacity race window.** `maxParticipants` is enforced with a count-then-insert
   check. Two registrations arriving in the same instant could both pass the
   check and exceed the cap by one. Acceptable for this project; a fully correct
   fix (a transaction or an atomic counter) is deliberately out of scope per the
   phase brief's "do not invent complex business rules". Capacity **is**
   enforced for all normal (sequential) traffic and is covered by a test.
2. **`ONGOING` events are visible but not registrable.** The brief's status list
   (DRAFT / PUBLISHED / CANCELLED / COMPLETED) doesn't map 1:1 to this project's
   enum (`DRAFT / PLANNED / UPCOMING / ONGOING / COMPLETED / CANCELLED`). Chosen
   mapping: discovery shows `PLANNED / UPCOMING / ONGOING`; registration is
   allowed only for `PLANNED / UPCOMING`. An in-progress event shows a clear
   "This event is already in progress." reason. This is a documented decision,
   not a new status system.
3. **Admin has no dedicated registration view.** Per §21 ("do not unnecessarily
   broaden admin capabilities"), no new admin endpoint was added. Admins retain
   their existing event oversight (`GET /api/admin/events`,
   `PATCH /api/admin/events/:id/status`). If a future phase wants admin
   visibility into registrations, `listEventRegistrationsForOrganiser` is the
   place to relax the ownership check.
4. **A hard-deleted event reference** would drop a row from `My Events`
   (`listMyRegistrations` filters `r.event == null`). In practice events are
   **soft**-deleted, so this cannot happen; the guard is defensive only.
5. **Two stale Phase-1 frontend E2E text assertions** were updated (not app
   changes) — see §9. No commits have been made in this project;
   `git diff` shows the cumulative uncommitted changes from the Phase-4 Visual,
   Phase 5 and Phase 6 tasks. `backend/.env` stays git-ignored.

---

## Acceptance Criteria

- [x] USER can browse available events · [x] search · [x] filter (category + upcoming)
- [x] USER can view event details · [x] register · [x] duplicate registration prevented (DB unique index + 409)
- [x] Registration stored in MongoDB · [x] associated with the authenticated user (JWT id, never body)
- [x] USER can view My Events · [x] see registration status · [x] cancel where permitted
- [x] Cancelled registrations preserved (row kept, status flipped, `cancelledAt` stamped)
- [x] DRAFT / CANCELLED / COMPLETED events cannot be registered for
- [x] USER cannot access organiser planning · [x] AI planning · [x] another user's registrations
- [x] ORGANISER can view registrations for own events · [x] cannot view another organiser's (backend-enforced)
- [x] Authentication enforced · [x] backend ownership enforced
- [x] Empty / loading / error states · [x] Desktop / Tablet / Mobile UI · [x] no page-level horizontal overflow
- [x] Browser console has no new errors · [x] existing regression tests pass (466/466)
- [x] Production build passes · [x] backend starts successfully

**Phase 6 complete. QR generation/scanning, attendance, check-in, certificates,
feedback, sentiment analysis, post-event analytics and advanced notifications
have not been started.**
