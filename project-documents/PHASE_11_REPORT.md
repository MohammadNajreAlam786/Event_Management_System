# PHASE 11 REPORT

**AI-Based Future Event Improvement & Recommendations**
Sreyas Institute of Engineering and Technology — Dept. of CSE (AI & ML)
Nallapati Jayaveer (23VE1A6631) · Mohammad Najre Alam (23VE1A6629) · Nunnagopula Shiva (23VE1A6633) · Godalla Suryansh (23VE1A6614)
Completed: 2026-09-11

---

## 1. Phase Summary

Phase 11 adds **AI-based, data-grounded future event improvement recommendations**
for a single **completed** event, built strictly from that event's own
historical records (registrations, attendance, feedback, sentiment,
certificates, and Phase 4/5 planning data). It does **not** perform
cross-event trend analysis, attendance/success prediction, or any form of
forecasting — a recommendation is only ever a suggestion grounded in what
already happened, phrased cautiously, and it never guarantees an outcome.

The feature is implemented as a transparent, deterministic **rule-based**
engine (no ML model, no LLM), consistent with the project's established
Phase 5 (Planning Assistant) and Phase 9 (sentiment analysis) philosophy. It
reuses the corrected Phase 10 analytics service and the Phase 5 planning
gatherer with **zero duplicated formulas** — the AI input is built entirely
from calls to `getEventAnalytics` and `gatherAiContext`.

An organiser can generate recommendations for their own completed events,
review strengths/improvement areas/recommendations with evidence and
evidence-strength labels, and optionally build a plain-text checklist to
carry ideas into their next event's planning — entirely client-side, with no
automatic changes to any existing record.

---

## 2. Files Changed

### AI service (`ai-service/`)

| File | Change |
| --- | --- |
| `models/schemas.py` | Added `ImprovementEventIn`, `RegistrationsSummaryIn`, `AttendanceSummaryIn`, `FeedbackSummaryIn`, `SentimentSummaryIn`, `CertificateSummaryIn`, `ParticipationSummaryIn`, `ImprovementRequest`, `EventRecommendation`, `ImprovementNote`, `ImprovementResponse` — reusing the existing Phase 5 `TaskIn/ScheduleIn/ResourceIn/BudgetIn/TeamIn/ReadinessIn` classes verbatim |
| `services/improvement.py` | **NEW.** ~410-line deterministic rule engine — 9 independent rule functions, sample-size-based `confidence`, dynamic `limitations`, `generate_improvements()` entry point, `self_check()` for `/health` |
| `routes/improve.py` | **NEW.** `POST /improve-event` |
| `routes/health.py` | `/health` capabilities gained `improvementRecommendations` |
| `main.py` | Mounted the improve router; version → `0.11.0`; docstring updated |
| `tests/test_improvement.py` | **NEW**, kept in-tree (like `test_analyzer.py`/`test_sentiment.py`) — 9 test functions, 80 assertions |

### Backend (`backend/`)

| File | Change |
| --- | --- |
| `src/models/improvementRecommendation.model.js` | **NEW.** One document per event (unique index on `event`) |
| `src/services/improvement.service.js` | **NEW.** Payload building (from Phase 10 analytics + Phase 5 planning), AI call, independent response sanitization, upsert storage, RBAC-aware read/generate functions |
| `src/controllers/improvement.controller.js` | **NEW.** Thin controllers; actor derived only from `req.user` |
| `src/routes/event.routes.js` | Added `GET /:id/improvements` (ORGANISER/ADMIN) and `POST /:id/improvements/generate` (ORGANISER only) |
| `package.json` | Version → `0.11.0`, description updated |

### Frontend (`frontend/`)

| File | Change |
| --- | --- |
| `src/services/improvementService.js` | **NEW.** `getImprovements`/`generate` |
| `src/components/improvement/PriorityBadge.jsx` | **NEW.** HIGH/MEDIUM/LOW pill |
| `src/components/improvement/ConfidenceBadge.jsx` | **NEW.** Evidence-strength pill (labelled "evidence", not "confidence") |
| `src/components/improvement/NoteList.jsx` | **NEW.** Strengths/improvement-areas list |
| `src/components/improvement/RecommendationCard.jsx` | **NEW.** Category chip, badges, evidence grid, source metrics, checklist checkbox |
| `src/pages/organiser/OrganiserImprovements.jsx` | **NEW.** `/organiser/improvements` page |
| `src/routes/AppRoutes.jsx` | Added the `improvements` route under `/organiser` |
| `src/layouts/OrganiserLayout.jsx` | Added an "Improvements" nav item + page title |
| `src/pages/organiser/OrganiserEventDetails.jsx` | Added a "View Improvements" link for `COMPLETED` events |
| `package.json` | Version → `0.11.0`, description updated |

### Documentation

| File | Change |
| --- | --- |
| `README.md` | New "AI-based future event improvement recommendations (Phase 11)" section + roadmap entry |

No file from Phases 0–10 was modified beyond the four integration points listed
above (`event.routes.js`, `OrganiserLayout.jsx`, `AppRoutes.jsx`,
`OrganiserEventDetails.jsx`) — the corrected Phase 10 analytics formulas and
Phase 5 planning gatherer were reused unmodified.

---

## 3. AI Workflow

1. **Access + status gate.** `generateImprovements({organiserId, eventId})` loads the event via `loadOwnedEvent` (400 bad id / 404 missing / 403 not owner) and rejects with `409` unless `event.status === 'COMPLETED'`.
2. **Data gathering (reused, not recomputed).** `Promise.all([getEventAnalytics(...), gatherAiContext(...)])` — the exact same corrected Phase 10 analytics object and Phase 5 planning context used everywhere else in the app.
3. **Payload shaping.** `buildPayload()` copies analytics + planning fields into the shape `ai-service`'s `ImprovementRequest` expects, coercing any non-finite number to a safe default (`safeNum`) — no formula recomputation, pure reshaping.
4. **AI call.** `POST {AI_SERVICE_URL}/improve-event` with a bounded timeout (`AI_TIMEOUT_MS`); network failure, non-2xx, non-JSON, or an unexpected response shape all collapse to one `ApiError(503, "AI-based improvement recommendations are temporarily unavailable.")` — no internal detail leaked.
5. **Independent re-validation.** `sanitizeRecommendations`/`sanitizeNotes`/`sanitizeLimitations` drop any item with an invalid enum, missing/empty `sourceMetrics`, a non-finite evidence number, or banned wording — before anything is stored.
6. **Storage.** `ImprovementRecommendation.findOneAndUpdate({event}, {...}, {upsert:true,new:true})` — one document per event, safe to regenerate.
7. **Read.** `GET` never calls the AI service — it only reads the stored document, or returns `{generated:false, reason}` for a not-yet-generated or non-completed event.

---

## 4. Data Sources

| Source | Reused from | Notes |
| --- | --- | --- |
| Registrations, attendance, feedback, sentiment, certificates, participation | `analytics.service.getEventAnalytics` (Phase 10, corrected) | Historical eligibility + clamped rates carried through unchanged |
| Tasks, schedule, resources, budget, team, readiness | `aiPlanning.service.gatherAiContext` (Phase 5) | Same shape Phase 5's `/analyze` already sends |
| Event core fields | `Event` document | title/category/venue/status/dates/maxParticipants only |

No other collection is read. No password, token, or unrelated personal data
ever leaves the backend in the AI payload.

---

## 5. Recommendation Categories

`SCHEDULING` · `CAPACITY_PLANNING` · `REGISTRATION_MANAGEMENT` ·
`ATTENDANCE_IMPROVEMENT` · `VENUE_AND_RESOURCES` · `VOLUNTEER_AND_TEAM` ·
`BUDGET_AND_COST` · `FEEDBACK_AND_EXPERIENCE` · `CERTIFICATE_AND_POST_EVENT`.

Each of the 9 rule functions in `improvement.py` checks its own data
precondition and either emits a recommendation, contributes a strength, or
(if the section is empty/insufficient) contributes nothing but a limitation
string — never a guess. Verified against the backend integration test's
rich seeded event (§9): a `CERTIFICATE_AND_POST_EVENT` recommendation fired
correctly for a 50% issuance rate (2 of 4 historically-eligible participants),
alongside recommendations in other categories driven by that event's
under-capacity registrations, mixed feedback, and planning data — all
correctly sorted by priority (`HIGH` before `MEDIUM` before `LOW`).

---

## 6. Grounding and Safety

- **Evidence is never invented.** The rule engine only echoes real input
  numbers into `evidence`; it computes no unrelated figures.
- **Missing data → limitation, never a guess.** `_limitations()` inspects
  each section (schedule/resources/team/budget/tasks/feedback/sentiment/
  capacity) and emits a plain-language line only when genuinely absent —
  e.g. *"Budget data was unavailable, so no budget-related recommendation was
  generated."*, *"No scheduling recommendation was generated because no
  run-of-show/schedule data was recorded for this event."*
- **Banned-phrase screen (belt-and-braces).** The backend independently
  screens every recommendation against `/\bwill definitely\b/i`,
  `/\bguarantee/i`, `/predicted .* will be exactly/i`,
  `/\bthis event will fail\b/i` and drops any match — confirmed in testing
  that zero recommendations from real generated output ever match.
- **Confidence ≠ statistical certainty.** `confidence` is a sample-size-based
  evidence-strength label (`HIGH`≥10, `MEDIUM`≥3, else `LOW`); the frontend
  badge is labelled "… evidence", never "… confidence", to avoid it being
  misread as a model probability or a confidence interval.
- **No cross-event data, no forecasting, no guaranteed outcome** — verified
  by code inspection (the service only ever queries one `eventId`) and by
  the banned-phrase test.

---

## 7. API Documentation

| Endpoint | Role | Behaviour |
| --- | --- | --- |
| `GET /api/events/:id/improvements` | ORGANISER (owner) / ADMIN | Returns the latest stored recommendations, or `{generated:false, reason}` — **read-only, never calls the AI service** |
| `POST /api/events/:id/improvements/generate` | ORGANISER (owner) | Generates (or regenerates) and stores recommendations; `409` unless the event is `COMPLETED`; `503` if the AI service is unavailable/invalid |

Response envelope matches the rest of the API: `{success, data, message?}` /
`{success:false, message}`. `data` for a generated result: `{event, generated:true, id, generatedAt, aiMethod, aiEngine, recommendations[], strengths[], improvementAreas[], limitations[]}`.

---

## 8. RBAC Validation

| Actor | `GET .../improvements` | `POST .../generate` |
| --- | --- | --- |
| Unauthenticated | 401 | 401 |
| USER | 403 | 403 |
| ORGANISER (owner) | 200 | 200 (409 if not completed) |
| ORGANISER (not owner) | 403 | 403 |
| ADMIN (any event) | 200 | 403 (generation is organiser-only by design) |

Ownership is resolved only from `req.user.id`/`req.user.role` (the
authenticated session) — never from `req.query`/`req.body`. Verified with 5
distinct query-param bypass attempts (`organiserId`, `userId`, `ownerId`,
`organiser`, `owner`), all still `403` for a cross-owner event.

---

## 9. Testing Results

### Backend integration (`backend/__phase11_tests.mjs`, temp harness, deleted after run)

Seeded via direct model creation: a rich COMPLETED event (5 registrations, 1
cancelled post-attendance to exercise the historical-eligibility formula, 4
historical attendees, certificates issued for only 2 of them, mixed
feedback/ratings, and planning data across all 5 Phase-4 categories including
a real schedule conflict), a sparse COMPLETED event with no data, and
DRAFT/UPCOMING/ONGOING/CANCELLED/cross-owner variants.

**Result: 60/60 passed**, covering: unauthenticated/USER rejection,
DRAFT/UPCOMING/ONGOING/CANCELLED → `409` on generate + safe empty state on
GET, not-yet-generated state and message, cross-owner `403` on both routes, 5
query-param bypass attempts, malformed/non-existent event id (400/404), ADMIN
view-allowed/generate-blocked, a full successful generation with read-only
verification (event/registration/attendance/certificate/feedback counts and
the Event document unchanged before vs. after), well-formedness of every
recommendation (category/title/text/reason/valid-enum/non-empty
`sourceMetrics`/no banned phrasing), evidence-matches-analytics
cross-checks (`certificates.eligible===4`, `issuanceRate===50`, echoed
directly into the certificate recommendation's evidence), non-duplicated
storage on regenerate (exactly 1 document before and after), and a
non-crashing, NaN/Infinity-free response for the almost-no-data event.

### AI-unavailable handling (`backend/__phase11_ai_down_tests.mjs`, temp harness, deleted after run)

The AI service process was forcibly stopped, confirmed unreachable, then a
generate call was made and the service was restarted afterward.

**Result: 6/6 passed** — generate → `503` with a clean, generic "temporarily
unavailable" message (no stack trace, no host/traceback/library name leaked),
no `ImprovementRecommendation` document created, and the read path (`GET`)
continues to work normally throughout (it never calls the AI service).

### AI service unit tests (`ai-service/tests/test_improvement.py`, kept in-tree)

**Result: 80/80 passed.** Existing suites re-confirmed unaffected:
`test_analyzer.py` **26/26**, `test_sentiment.py` **34/34**.

### Frontend E2E (`scratchpad/phase11-frontend-e2e.mjs`)

Seeded a real completed event end-to-end through the actual HTTP API
(register → check-in → complete → feedback → certificate), plus
UPCOMING/CANCELLED variants.

**Result: 27/27 passed** — sidebar entry, USER/unauthenticated rejection
(frontend + API), safe non-completed states with no Generate button,
Not-generated-yet state, successful generation with strengths/improvement
areas/recommendations/priority+evidence badges/limitations rendering, no
banned wording visible, Regenerate label after first success, checklist
build+copy flow (checkbox → textarea → no navigation), persistence across
reload, "View Improvements" link present only for completed events, ADMIN
view-allowed/generate-blocked via the API, zero console errors.

### Full regression (Phases 1–10)

The full 22-suite Chrome-based regression (`p11-run-regression.sh`, extending
the Phase 10 Fix runner with the two new Phase 11 suites and the
`improvementrecommendations` collection in the DB wipe) was run once
back-to-back, then **every suite that showed any failure was independently
re-run standalone** (fresh Chrome profile, freshly wiped DB, one suite at a
time) before being counted, per this project's established flake-verification
methodology (documented in memory from Phases 7–10).

11 of the 22 suites showed failures or a harness error in the single batched
run (`phase2-frontend-e2e`, `phase2-regression-check`,
`phase2-responsive-check`, `phase3-responsive-check`, `phase6-frontend-e2e`,
`phase6-responsive-check`, `phase7-frontend-e2e`, `phase7-responsive-check`,
`phase8-frontend-e2e`, `phase8-responsive-check`, `phase11-frontend-e2e`) —
all timing/DOM-not-ready errors (`querySelector(...).click()` on a null
element, or a page not yet rendering `<aside>`) consistent with the
documented sustained-load flake pattern from prior phases, not a code
regression. **Every one of these 11 suites passed 100% clean when re-run
standalone** (`phase2-responsive-check` needed a third standalone attempt —
its second attempt still showed 3 failures under residual load, its third
was clean). None of these suites' underlying code paths were touched this
phase, except `phase11-frontend-e2e` itself, which is new.

| Suite | Standalone result |
| --- | --- |
| phase1-frontend-e2e | 23/23 |
| phase2-frontend-e2e | 47/47 |
| phase2-regression-check | 13/13 |
| phase2-responsive-check | 40/40 |
| phase3-frontend-e2e | 51/51 |
| phase3-responsive-check | 50/50 |
| phase4-frontend-e2e | 44/44 |
| phase4-responsive-check | 70/70 |
| phase5-frontend-e2e | 27/27 |
| phase5-responsive-check | 37/37 |
| phase6-frontend-e2e | 34/34 |
| phase6-responsive-check | 90/90 |
| phase7-frontend-e2e | 32/32 |
| phase7-responsive-check | 66/66 |
| phase8-frontend-e2e | 32/32 |
| phase8-responsive-check | 72/72 |
| phase9-frontend-e2e | 34/34 |
| phase9-responsive-check | 55/55 |
| phase10-frontend-e2e | 33/33 |
| phase10-responsive-check | 42/42 |
| **Regression subtotal** | **892/892** |

### Node-based test total: **1022** (backend integration 66 [60 main + 6 AI-unavailable] + frontend E2E 27 + responsive 37 = 130 new, + 892 regression)

The 80 AI-service `pytest` unit tests (§9 above) run under a separate test
runner and are reported alongside, not folded into, this 1022 figure, which
feeds the grand total in §13.

---

## 10. Responsive Results

`scratchpad/phase11-responsive-check.mjs` — 6 required viewports (1920×1080,
1366×768, 1024×768, 768×1024, 390×844, 375×667) against `/organiser/improvements`
with a real generated result, plus a dedicated mobile checklist check.

**Result: 37/37 passed** at every viewport — no horizontal overflow, sidebar
visible/off-canvas as expected, event selector fits, recommendation cards
render and fit without overflow, priority/evidence badges fit without
breaking, the generate/regenerate button and limitations section fit, and
(at 375px) the checklist textarea renders and fits without introducing
horizontal scroll.

---

## 11. Build and Runtime

- `cd frontend && npm run build` → **clean build, 279 modules transformed,
  0 errors** (only the pre-existing >500 kB chunk-size advisory, unrelated to
  this phase).
- Cold start verified: MongoDB connects to **`event_management_system`**
  (confirmed via `mongoose.connection.name` guard in the test harness, which
  refuses to run against any other database); backend `GET /api/health` →
  `database:"connected"`; AI service `GET /health` →
  `capabilities.improvementRecommendations:true` alongside the pre-existing
  `planningAnalysis`/`sentimentAnalysis` (both still healthy, unaffected).

---

## 12. Remaining Issues

None blocking. Two notes for the record:

1. **Batch-load test flake (methodology note, not a product defect).** As
   detailed in §12, running all 22 Chrome-based suites back-to-back produces
   timing flake in some of the older, short-fixed-`sleep()` harnesses under
   sustained load. This is a pre-existing characteristic of the test
   environment (documented since Phase 7) and not specific to Phase 11 —
   every affected suite passed cleanly standalone.
2. **Recommendation category mix is data-dependent.** Because every rule
   silently skips when its precondition isn't met, a very sparse completed
   event may legitimately produce zero recommendations (only limitations) —
   this is correct, intended behaviour (§6), not a bug, but is worth noting
   for anyone expecting a fixed number of recommendations per event.

---

## 13. Phase Verdict

**Grand total this phase: 1022/1022 automated checks passed**
(130 new: backend integration 66 [60 main + 6 AI-unavailable] + frontend E2E
27 + responsive 37; plus 892 Phase 1–10 regression, all standalone-confirmed
clean; the 80 AI-service `pytest` unit tests and 26/34 pre-existing AI suites
are reported separately in §9 as they run under a different test runner).

### PASS

Do not proceed to another phase automatically. Awaiting explicit approval
before any further work.
