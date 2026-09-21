# Phase 4 — Pre-Event Planning System — Completion Report

**Project:** AI-Powered Event Planning & Management System
**Phase:** 4 (per-event planning workspace: tasks, schedule, resources, budget, team, overview, readiness)
**Date completed:** 2026-09-05
**Database:** `event_management_system` (unchanged since Phase 1.5)

Not in this phase (deliberately): AI planning assistance, participant
registration, QR attendance, feedback/sentiment, certificates, analytics,
reporting.

---

## 1. Files created

**Backend (10)**

| File | Purpose |
|---|---|
| `backend/src/models/eventTask.model.js` | Task model — status `TODO/IN_PROGRESS/COMPLETED`, priority `LOW/MEDIUM/HIGH/CRITICAL`, optional `dueDate`, free-text `assignedTo` |
| `backend/src/models/eventSchedule.model.js` | Schedule item — `startTime`/`endTime` (end ≥ start), `type` enum, ordered by time |
| `backend/src/models/eventResource.model.js` | Resource — category/status enums, `quantity ≥ 1`, `estimatedUnitCost ≥ 0`, `estimatedTotalCost` **virtual** |
| `backend/src/models/eventBudgetItem.model.js` | Budget line — category/status enums, `estimatedAmount`, `actualAmount` (default **null** = not entered) |
| `backend/src/models/eventTeamMember.model.js` | Team member — contact record (name/email/role/responsibility/status), **not** a User account |
| `backend/src/services/planning.service.js` | Generic CRUD factory + list/filter/sort/paginate + overview / readiness / needs-attention / progress / upcoming-deadlines |
| `backend/src/controllers/planning.controller.js` | Thin handlers for all planning endpoints |
| `backend/src/routes/planning.routes.js` | Router mounted at `/api/events/:eventId` (mergeParams) |
| `backend/src/middleware/eventOwnership.js` | `requireEventOwnership` — one place that verifies the ORGANISER owns `:eventId`, sets `req.event` |
| `backend/src/utils/planningValidators.js` | Dependency-free field validation for all five areas (create + partial/update modes) |

**Frontend (23)**

| Area | Files |
|---|---|
| Service / meta | `services/planningService.js`, `utils/planningMeta.js` |
| Layout | `layouts/PlanningWorkspaceLayout.jsx` |
| Shared components | `components/planning/`: `PlanningBadge.jsx`, `PlanningSubNav.jsx`, `NeedsAttention.jsx`, `UpcomingDeadlines.jsx`, `ReadinessCard.jsx`, `CrudSection.jsx` (generic list + create/edit/delete), `PlanningForm.jsx` (config-driven modal form), `forms.jsx` (the 5 form configs) |
| Pages | `pages/organiser/planning/`: `PlanningOverview.jsx`, `PlanningTasks.jsx`, `PlanningSchedule.jsx`, `PlanningResources.jsx`, `PlanningBudget.jsx`, `PlanningTeam.jsx`, `PlanningReadiness.jsx` |

**Docs (1):** `project-documents/PHASE_4_REPORT.md`.

## 2. Files modified

**Backend:** `routes/index.js` (mount `/api/events/:eventId` planning router
after the event router), `services/event.service.js` (export `loadOwnedEvent`
so the ownership middleware reuses it), `package.json` (0.4.0).

**Frontend:** `routes/AppRoutes.jsx` (added the `events/:id/planning/*` nested
route tree; removed the six Phase-3 global "coming soon" organiser routes and
the now-unused `comingSoon`/`PlaceholderPage` import), `layouts/OrganiserLayout.jsx`
(sidebar is now just Dashboard / My Events / Create Event — the planning areas
are per-event tabs, not global nav), `pages/organiser/OrganiserEventDetails.jsx`
(replaced the seven static "Coming Soon" cards with a prominent **Open Planning
Workspace** button), `package.json` (0.4.0).

**Root:** `README.md` (Phase 4 section, readiness formula, roadmap).

**Deleted:** none. **Not touched:** the `Event` model, all auth/event code,
the Admin module, the frontend auth store, the AI service (`git diff` empty).

## 3. Database models created

Five collections, **each with an `event` ObjectId reference** — the `Event`
document stays focused; no planning fields were added to it.

| Collection | Fields | Enums |
|---|---|---|
| `eventtasks` | event, title, description, assignedTo, priority, status, dueDate, timestamps | priority `LOW/MEDIUM/HIGH/CRITICAL`; status `TODO/IN_PROGRESS/COMPLETED` |
| `eventschedules` | event, title, description, startTime, endTime, location, type, timestamps | type `SESSION/REGISTRATION/CEREMONY/BREAK/MEAL/WORKSHOP/OTHER` |
| `eventresources` | event, name, description, category, quantity, unit, status, estimatedUnitCost, notes, timestamps; **virtual** `estimatedTotalCost = quantity × estimatedUnitCost` | category `EQUIPMENT/FURNITURE/TECHNICAL/STATIONERY/FOOD/TRANSPORT/DECORATION/OTHER`; status `REQUIRED/ORDERED/AVAILABLE/NOT_AVAILABLE` |
| `eventbudgetitems` | event, category, description, estimatedAmount, actualAmount (default `null`), status, notes, timestamps | category `VENUE/EQUIPMENT/FOOD/TRANSPORTATION/MARKETING/DECORATION/SPEAKERS/CERTIFICATES/MISCELLANEOUS`; status `PLANNED/APPROVED/PAID` |
| `eventteammembers` | event, name, email, role, responsibility, status, timestamps | status `INVITED/CONFIRMED/ACTIVE/COMPLETED` |

**Indexes** (verified live): `{event:1}` on all; plus `{event:1,status:1}` on
tasks/resources/budget/team, `{event:1,dueDate:1}` on tasks, `{event:1,startTime:1}`
on schedule.

## 4. Task management implementation

- Model + `planning.service` CRUD via a shared `makeCrud` factory (editable-field
  whitelist per model — `event` is never writable from a request).
- `POST /api/events/:eventId/tasks` auto-sets `event` from the URL (already
  ownership-checked); `title` required; `priority`/`status`/`dueDate` validated
  against the enums.
- **Overdue** is computed, never stored: `dueDate < now AND status !== COMPLETED`.
  A completed task is never overdue.
- List supports `?status=&priority=&search=<title>&sort=dueDate|priority|created&page=&limit=`
  (limit capped at 100). Priority sort orders CRITICAL → LOW.
- UI: table (title / priority badge / status badge / due — highlighted red when
  overdue / assignee), an **inline status dropdown** per row for quick
  `TODO → IN_PROGRESS → COMPLETED`, plus a modal add/edit form and delete
  confirmation. Status + priority filters and a title search.

## 5. Schedule implementation

- `startTime`/`endTime` required and validated (`end ≥ start`) on create **and**
  on edit (the merged item is revalidated). `title` required.
- `GET /schedule` returns items **ordered chronologically** and, per item, a
  `conflictsWith: [ids]` array plus a top-level `conflictCount`.
- **Conflict detection**: two items conflict when their `[start, end)` intervals
  overlap. It is a **warning**, not a save-block — the UI shows a banner
  ("Schedule conflict detected — N overlapping pairs") and an "Overlaps N" note
  on the affected rows.
- UI: time-range column, type badge, location, conflict indicator; add/edit modal;
  delete confirmation.

## 6. Resource implementation

- Validation: `name` required, `quantity ≥ 1`, `estimatedUnitCost ≥ 0`, category
  and status against enums.
- `estimatedTotalCost` is a **Mongoose virtual** (`quantity × estimatedUnitCost`)
  — computed, not stored, so it can't drift.
- List supports `?status=&category=&search=<name>`.
- UI: name / category / quantity+unit / status badge / est. cost / notes; status
  and category filters, name search; add/edit modal; delete confirmation.

## 7. Budget implementation

- Validation: `category` required + in enum, `estimatedAmount ≥ 0`,
  `actualAmount ≥ 0`, status in enum. `actualAmount` defaults to **`null`** and
  the UI renders that as "not entered" (never invented as 0).
- `GET /budget` returns the items **plus** `totals: { estimatedTotal, actualTotal,
  variance }` where `variance = estimatedTotal − actualTotal` — all computed from
  the rows, nothing hardcoded.
- UI: a three-card summary (Total estimated / Total actual / Variance, coloured
  by sign) above the table (category / description / estimated / actual / status
  badge); status + category filters; add/edit modal; delete confirmation.

## 8. Team implementation

- Contact record only — **no User account is created** for a team member
  (§38). Validation: `name` required, `email` valid if present, status in enum.
- Every member has a `responsibility` free-text field (§39).
- List supports `?status=`.
- UI: name / email / role / responsibility / status badge; status filter;
  add/edit modal; remove confirmation; honest empty state.

## 9. Readiness calculation

Deterministic and documented in `backend/src/services/planning.service.js`
(`READINESS_WEIGHTS`, `readinessStatus`, `getReadiness`):

```
component score (0–100):
  tasks     = round(completed / total * 100)                      (0 if no tasks)
  schedule  = 100 if ≥1 item and no conflict; 60 if items + a conflict; 0 if none
  resources = round(AVAILABLE / total * 100)                       (0 if none)
  budget    = round((APPROVED + PAID) / total * 100)               (0 if none)
  team      = round((CONFIRMED + ACTIVE + COMPLETED) / total * 100)(0 if none)

weights: tasks 30 · schedule 20 · resources 20 · budget 15 · team 15   (Σ = 100)
overall  = round( Σ (score × weight) / 100 )

status:  0–39 NOT_READY · 40–69 PARTIALLY_READY · 70–89 MOSTLY_READY · 90–100 READY
```

The response returns `overallScore`, `status`, `weights`, `components` (the five
0–100 scores), `detail` (per area `{ done, total, score }` — so the UI shows
"7/10 · 70%", not just a single number), and `needsAttention`. The Readiness page
also prints the weighting sentence. The UI states plainly that this is a planning
indicator, not a guarantee of success.

## 10. Planning overview

`GET /api/events/:eventId/planning/overview` returns, all from real data:

```
tasks:    { total, completed, pending, overdue }
schedule: { total, conflicts }
resources:{ total, available }
budget:   { estimated, actual, variance }
team:     { total, confirmed }
progress: { taskCompletion }          // completed/total*100, dynamic — never stored
readiness:{ overallScore, status }    // summary
needsAttention: [...]
upcomingDeadlines: [...]
```

The Overview page renders it as summary cards + a task-completion bar + a
readiness summary + a budget mini-table + the Needs Attention and Upcoming
Deadlines panels + quick links to each area.

## 11. Needs Attention implementation

Built entirely from live planning data (`buildNeedsAttention` in the service):

| Trigger | Message |
|---|---|
| tasks past due & not completed | "N overdue task(s)" |
| tasks `CRITICAL` & not completed | "N critical task(s) pending" |
| resources `NOT_AVAILABLE` | "N resource(s) not available" |
| overlapping schedule items | "N schedule conflict(s)" |
| budget items still `PLANNED` | "Budget has N item(s) awaiting approval" |
| team members still `INVITED` | "N team member(s) not confirmed" |

When the list is empty the UI shows **"Everything is on track."** — no fabricated
items.

## 12. Upcoming Deadlines implementation

`getUpcomingDeadlines`: tasks with `status !== COMPLETED` and `dueDate >= start of
today`, sorted soonest-first, limit 5. Returned as `{ id, title, dueDate, priority }`.
The panel shows a relative label ("Today" / "Tomorrow" / "In N days") with the
full timestamp on hover.

## 13. Backend APIs

All under `/api/events/:eventId`, all requiring **authenticated ORGANISER who
owns `:eventId`** (one middleware; USER and ADMIN → 403):

| Resource | Endpoints |
|---|---|
| Tasks | `GET /tasks` · `POST /tasks` · `PATCH /tasks/:taskId` · `DELETE /tasks/:taskId` |
| Schedule | `GET /schedule` · `POST /schedule` · `PATCH /schedule/:scheduleId` · `DELETE /schedule/:scheduleId` |
| Resources | `GET /resources` · `POST /resources` · `PATCH /resources/:resourceId` · `DELETE /resources/:resourceId` |
| Budget | `GET /budget` · `POST /budget` · `PATCH /budget/:budgetId` · `DELETE /budget/:budgetId` |
| Team | `GET /team` · `POST /team` · `PATCH /team/:memberId` · `DELETE /team/:memberId` |
| Derived | `GET /planning/overview` · `GET /planning/readiness` |

Response envelope: `{ success, data, message? }` / `{ success:false, message, errors? }`.

## 14. Frontend routes

```
/organiser/events/:id/planning            → PlanningWorkspaceLayout (event header + tab bar)
  (index)                                 → PlanningOverview
  /tasks /schedule /resources /budget /team → the five CrudSection pages
  /readiness                              → PlanningReadiness
  *                                       → NotFoundPage (inside the workspace shell)
```

All under the existing `RoleProtectedRoute roles={['ORGANISER']}` +
`OrganiserLayout`. The workspace is reached from the event details page's
**Open Planning Workspace** button, and offers a **← Event overview** link back.

## 15. Ownership / security implementation

- `requireEventOwnership` runs after `authenticate` + `requireRole('ORGANISER')`.
  It calls the shared `loadOwnedEvent(eventId, req.user.id)` (400 malformed id /
  404 missing or soft-deleted / **403 not the owner**) and attaches `req.event`.
- Every service query is **additionally scoped by `event: eventId`**, so a
  mismatched `:eventId`/`:itemId` pair (e.g. an item id from another event) is a
  404, not a leak.
- The `event` field is on every model's editable whitelist's *exclusion* list —
  it can never be set or moved from a request body.
- **Admin has no planning access this phase** (§52): `requireRole('ORGANISER')`
  returns 403 for ADMIN on every planning route. USER → 403. Unauthenticated → 401.
- No password/hash ever appears in a planning payload (checked in the harness by
  scanning every response for the string "password").
- Search input is regex-escaped; pagination `limit` capped at 100.

## 16. Cross-organiser security test results

Two organisers (A owns Event A, B owns Event B). From **Organiser B**, against
**Event A**, for *every* planning area (tasks, schedule, resources, budget, team)
and the derived views — GET list, POST, PATCH `:id`, DELETE `:id`:

**19 / 19 attempts → 403.** Event A's seeded task was confirmed byte-identical in
the DB afterwards (no write leaked through). Frontend: Organiser B opening Event
A's `/organiser/events/:id/planning` URL directly shows an access error, **not**
the workspace.

## 17. Cross-event security test results

| Attempt | Result |
|---|---|
| Malformed `:eventId` | **400** |
| Well-formed but unknown `:eventId` | **404** |
| Valid item id from Event A used under Event B's path (B owns B) | **404** — the query is event-scoped, so the item is invisible |
| Known task/resource/budget/team id + wrong event in the path | rejected (403 at the event, or 404 at the item) |

IDs cannot bypass ownership: the event is checked first, then every item lookup
is `{ _id, event }`.

## 18. Task test results

Create ✅ · read (list + pagination) ✅ · update ✅ · delete ✅ (→ PATCH after
delete = 404) · status `TODO → IN_PROGRESS → COMPLETED` ✅ · priority change ✅ ·
search by title ✅ · filter by status ✅ · filter by priority ✅ · sort by priority
(CRITICAL first, descending) ✅ · overdue detection (past due + not completed →
`overdue:true`; completed → `overdue:false`) ✅ · completion % via overview
(0/5/10 → 0/50/100) ✅ · validation: empty title / invalid priority / invalid
status / invalid dueDate → 400 + field error ✅ · `?limit=100000` capped to 100 ✅.
Frontend: create via modal, inline status → Completed clears the overdue flag,
priority filter narrows correctly — all ✅.

## 19. Schedule test results

Create ✅ · read (chronological order verified) ✅ · update ✅ · delete ✅ ·
end-before-start → 400 ✅ · invalid time → 400 ✅ · empty title → 400 ✅ ·
**conflict detection**: two overlapping items → both flagged, `conflictCount ≥ 1`
✅ · conflict **clears** after deleting one side ✅. Frontend: three items ordered
by time, conflict banner appears/disappears, end-before-start message shown in the
form — all ✅.

## 20. Resource test results

Create ✅ · read ✅ · update ✅ · delete ✅ · status update (`REQUIRED → AVAILABLE`)
✅ · search by name ✅ · filter by status ✅ · filter by category ✅ · quantity `< 1`
→ 400 ✅ · negative `estimatedUnitCost` → 400 ✅ · empty name → 400 ✅ · invalid
status → 400 ✅ · `estimatedTotalCost` virtual = `quantity × estimatedUnitCost`
(3 × 100 = 300) ✅ (backend + UI).

## 21. Budget test results

Create ✅ · read ✅ · update ✅ · delete ✅ · **estimated total** (10000 + 5000 +
2000 = 17000) ✅ · **actual total** (9000 + 0 + 500 = 9500) ✅ · **variance**
(17000 − 9500 = 7500) ✅ · negative estimated → 400 ✅ · negative actual → 400 ✅ ·
missing category → 400 ✅ · invalid category → 400 ✅ · `actualAmount` stays `null`
until entered (shown as "not entered") ✅ (backend + UI three-card summary).

## 22. Team test results

Add ✅ · read ✅ · update (status + responsibility) ✅ · delete ✅ · responsibility
field stored/displayed ✅ · status update (`INVITED → CONFIRMED`) ✅ · empty state
(empty array, honest message) ✅ · validation: empty name / invalid email /
invalid status → 400 ✅.

## 23. Readiness calculation test

Seeded known data: tasks 7/10 complete → 70; schedule 2 items, no conflict → 100;
resources 8/10 available → 80; budget 4/5 approved → 80; team 4/5 confirmed → 80.

| Check | Result |
|---|---|
| component `tasks` = 70 | ✅ |
| component `schedule` = 100 | ✅ |
| component `resources` = 80 | ✅ |
| component `budget` = 80 | ✅ |
| component `team` = 80 | ✅ |
| overall = **weighted** value, computed independently in the test: `round((70·30 + 100·20 + 80·20 + 80·15 + 80·15)/100) = 81` — API returned **81** | ✅ (not hardcoded) |
| status band for 81 = `MOSTLY_READY` | ✅ |
| `detail` shows per-area `done/total` (7/10, 8/…, …) | ✅ |
| `weights` present and sum to 100 | ✅ |

**Needs Attention (§80):** created an overdue task + a critical pending task + a
`NOT_AVAILABLE` resource + an `INVITED` team member + a `PLANNED` budget item →
all five categories appeared. Resolved each → the list became **empty**. The
overall readiness score **changed** when planning data changed (verified before/
after in the frontend E2E).

## 24. Responsive UI test results

Automated (`getBoundingClientRect`) across desktop 1440 / laptop 1024 /
tablet-landscape 834 / tablet-portrait 768 / mobile 375 on all 7 planning routes
— **70 / 70 checks passed**: no horizontal overflow at any width; sidebar
on-canvas ≥ 768px, off-canvas + hamburger < 768px; tables scroll inside their own
`overflow-x-auto` container; the modal form scrolls within itself on short
viewports.

## 25. Regression test results

| Suite | Result |
|---|---|
| Phase 1 backend auth harness (register/login/logout/me/JWT/cookie/RBAC probes) | **51/51** ✅ |
| Phase 2 Admin frontend E2E (dashboard, users, organisers, self-deactivation, RBAC, mobile) | **47/47** ✅ |
| Phase 2 Admin responsive | **40/40** ✅ |
| Phase 3 Event frontend E2E (create/edit/status/delete, ownership, admin cancel, full flow) | **51/51** ✅ |
| Phase 3 event API spot-check (create→DRAFT, my, edit, status, stats, soft-delete→404) | **6/6** ✅ |
| Phase 0/1 page regression (public pages, Axios/Zustand wiring, session persistence, USER page) | **13/13** ✅ |

| Check | Result |
|---|---|
| Frontend `:5173` | ✅ 200 |
| Backend `/api/health` | ✅ 200, DB `connected` |
| MongoDB | ✅ `MongoDB connected: database "event_management_system"` |
| AI service `/health` | ✅ 200 — **source untouched** (`git diff` empty) |
| `event_management` **not** used | ✅ — no config/connection change; old DB still 2 users (drift predates Phase 4) |
| Tailwind / Axios / Zustand / React Router | ✅ (exercised throughout every E2E) |
| Login / logout / `/api/auth/me` / JWT-cookie / RBAC | ✅ |
| Frontend production build | ✅ 159 modules, no errors/warnings |

Three stale test-script assertions were **updated (not app-fixed)**: two Phase-3
E2E checks looked for the seven "Coming Soon" planning cards on the event details
page, which Phase 4 deliberately replaced with the "Open Planning Workspace"
button; and one Phase-2 dashboard assertion assumed 0 events (now depends on test
order). After the updates every regression suite is green.

**Automated totals this phase: 457/457 passed** — 135 backend planning · 44
frontend planning E2E · 70 planning responsive · 51 Phase-1 auth · 47 Phase-2
admin E2E · 40 Phase-2 responsive · 51 Phase-3 event E2E · 6 Phase-3 spot-check ·
13 page regression.

## 26. Frontend build result

```
vite v6.4.3 building for production...
✓ 159 modules transformed.
dist/index.html                   0.50 kB │ gzip:   0.33 kB
dist/assets/index-DVDpiLNz.css   24.79 kB │ gzip:   5.53 kB
dist/assets/index-CT5y8gzR.js   386.46 kB │ gzip: 115.56 kB
✓ built in ~1s
```

No errors or warnings.

## 27. Warnings

- One backend bug found and fixed during testing: the task list's `?sort=priority`
  path used a Mongo `aggregate` whose `$match` was passed a string `event` id
  (aggregate does not auto-cast to ObjectId), so it returned nothing. Replaced
  with an in-memory sort over the matching tasks; harness re-run → 135/135.
- Two E2E-harness selector bugs (an ambiguous "Add" button, and clicking a
  confirm dialog by text) were fixed in the test scripts — not app bugs.
- Removing the six Phase-3 "coming soon" organiser sidebar links/routes touched
  Phase-3 UI; the Phase-3 E2E (51 checks) was re-run green to confirm nothing
  else regressed.

## 28. Remaining issues

- **None blocking.** Every applicable checklist item passes.
- Admin still has **no** planning management (by design, §52) — admins can view
  events but not their planning data. If a future phase wants read-only admin
  visibility into planning, the middleware is the single place to relax.
- The old `event_management` database still exists with the 2 users it had at the
  end of Phase 2/3 (drift predates this phase). Phase 4 never connected to it —
  every code path and test-script constant is pinned to `event_management_system`.
- The Phase 1 `/api/{admin,organiser,user}/test` probes remain.
- Repo still has **no commits** (`git init` only). `backend/.env` stays git-ignored.
- Abstract PDF unchanged (329574 bytes, timestamp intact).

---

## Final acceptance checklist

**Planning** — workspace ✅ · overview ✅ · progress ✅ · Needs Attention ✅ ·
Upcoming Deadlines ✅

**Tasks** — create ✅ · view ✅ · edit ✅ · delete ✅ · status ✅ · priority ✅ ·
search ✅ · filter ✅ · deadline/overdue detection ✅ · progress calculation ✅

**Schedule** — create ✅ · view ✅ · edit ✅ · delete ✅ · chronological order ✅ ·
validation ✅ · conflict warning ✅

**Resources** — create ✅ · view ✅ · edit ✅ · delete ✅ · search ✅ · filter ✅ ·
status ✅ · validation ✅

**Budget** — create ✅ · view ✅ · edit ✅ · delete ✅ · estimated total ✅ · actual
total ✅ · variance ✅ · validation ✅

**Team** — add ✅ · view ✅ · edit ✅ · delete ✅ · responsibility ✅ · status ✅

**Readiness** — dynamic score ✅ · component scores ✅ · status shown ✅ ·
needs-attention explanation ✅ · score changes with data ✅

**Security** — USER blocked ✅ · ORGANISER owns their planning ✅ · cannot access
another organiser's ✅ · cross-event rejected ✅ · IDs cannot bypass ownership ✅ ·
Admin APIs still protected ✅

**UI** — desktop ✅ · laptop ✅ · tablet ✅ · mobile ✅ · loading ✅ · error ✅ ·
empty ✅ · confirmation dialogs ✅

**Database** — `event_management_system` active ✅ · no `event_management` ✅ ·
planning models created ✅ · Event relationships correct ✅

**Regression** — Phase 0 ✅ · Phase 1 ✅ · Phase 1.5 ✅ · Phase 2 ✅ · Phase 3 ✅ ·
AI service ✅ · frontend build ✅

**Phase 4 is complete. AI planning, participant registration, QR attendance,
feedback and certificates have not been started.**
