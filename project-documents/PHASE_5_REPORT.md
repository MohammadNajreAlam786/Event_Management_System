# Phase 5 — AI-Assisted Pre-Event Planning — Implementation Report

**Project:** AI-Powered Event Planning & Management System
**Phase:** 5 — AI Planning Assistant (analyse planning data → prioritised recommendations & risks + readiness explanation)
**Date:** 2026-09-06
**Database:** `event_management_system` (unchanged schema; `event_management` never touched)
**Services:** Frontend `:5173` · Backend `:5000` · FastAPI AI service `:8000` · MongoDB `:27017`

Not in this phase (deliberately): participant registration, QR generation/attendance, certificates, feedback/sentiment, post-event analytics, notifications beyond what exists.

---

## 1. Summary

An **AI Planning Assistant** was added as an eighth tab in the organiser's planning workspace
(`/organiser/events/:id/planning/ai`). One action — **Analyze Event Plan** — sends the event's
current Phase 4 planning data to the backend, which forwards it to the FastAPI service, which
runs a **deterministic rule-based analysis** and returns a structured result: a data-filled
summary, a plain-language explanation of the **existing** readiness score, a **prioritised** list
of recommendations, and a list of risks with mitigations.

It is strictly an **assistant**: every output is informational. It never creates, edits or
deletes tasks, schedule items, resources, budget lines, team members or event details. If the
AI service is down the endpoint returns a clean 503 and **the rest of the planning workspace
keeps working**.

Phase 4 modules (Tasks, Schedule, Resources, Budget, Team, Readiness, Overview) are unchanged.
The readiness score is the **existing Phase 4 calculation**, passed through for the AI to
explain — it is never recomputed.

---

## 2. Architecture

```
Browser  (React + Vite, :5173)
  │   Axios, HTTP-only auth cookie
  │   POST /api/events/:eventId/ai/analyze          (body: {} )
  ▼
Express backend  (:5000)
  │   middleware: authenticate → requireRole(ORGANISER) → requireEventOwnership
  │   aiPlanning.service.gatherAiContext():
  │     - event, tasks, schedule (+conflict counts), resources, budget, team
  │     - readiness  = getReadiness()   ← the Phase 4 score, NOT recomputed
  │   fetch  POST  http://127.0.0.1:8000/analyze
  │     (server-to-server JSON — planning data only; NO DB credentials,
  │      NO auth tokens, NO user records)
  ▼
FastAPI AI service  (:8000)
  │   routes/analyze.py  →  services/analyzer.analyze()
  │   deterministic rule-based engine over the planning data
  ▼
  structured JSON  →  backend validates shape + adds { readiness, basedOn, generatedAt }
                   →  browser renders Summary / Recommendations / Risks cards
```

The frontend never contacts MongoDB or the AI service directly. The backend is the only API
layer and the only caller of the AI service. This matches the architecture carried through
every previous phase.

---

## 3. AI Functionality

| Output | What it does | Backed by |
| --- | --- | --- |
| **summary** | One or two sentences on the overall posture, filled with real counts ("1 of 3 tasks complete, with 1 overdue; the schedule has 3 items (2 overlapping); …"). Never generic. | task/schedule/resource/budget/team counts |
| **readinessAssessment** | Explains the **existing** readiness %: which areas are strong (component ≥ 70), which are pulling it down (< 50), and states explicitly that the assistant only explains the Phase 4 score. | `readiness.overallScore`, `readiness.components`, `readiness.weights` |
| **recommendations[]** | `category` (TASK/SCHEDULE/RESOURCE/BUDGET/TEAM/GENERAL), `priority`, `title`, `description`, `reason` ("Why"), `suggestedAction`. **Informational only** — shown as a "Suggested action", never applied. | see §15–18 |
| **risks[]** | `category`, `severity`, `title`, `description`, `mitigation`. | overdue tasks, schedule overlaps, `NOT_AVAILABLE` resources, actuals over estimate, missing team |
| **priority** | The single highest severity across all recommendations + risks — "what should I fix first?". | max of all finding levels |

**Prioritisation.** Recommendations and risks are each sorted `CRITICAL → HIGH → MEDIUM → LOW`.
`CRITICAL` is reserved for evidence-backed cases only (an overdue *critical-priority* task; a
`NOT_AVAILABLE` *technical* resource with the event within 7 days; recorded actuals exceeding
the estimate by ≥ 20 % with `PAID` lines). A well-prepared event (no risks, nothing above LOW)
gets a short, reassuring response instead of a pile of nitpicks.

**Risk detection** explains what already exists rather than inventing new problems — e.g. if the
schedule already flags an overlap, the risk describes that overlap; it does not fabricate a
second conflict.

**Missing-preparation detection is data-gated, not a fixed checklist.** A task type is only
recommended when other data implies the need: "add a technical-setup task" fires only when the
schedule has sessions/workshops/ceremonies *or* a technical resource exists; "assign someone to
registration" fires only when the schedule has a `REGISTRATION` item and no team member's
role/responsibility mentions it; etc.

---

## 4. Data Used

The backend gathers exactly this and nothing else (bounded to 200 items per list):

| Area | Fields sent |
| --- | --- |
| **Event** | title, description, startDate, endDate, venue, status |
| **Tasks** | title, description, priority, status, dueDate, assignedTo, `overdue` (computed) |
| **Schedule** | title, startTime, endTime, location, type, `conflictCount` (from the Phase 4 conflict check) |
| **Resources** | name, category, quantity, unit, status, estimatedUnitCost, estimatedTotalCost |
| **Budget** | category, description, estimatedAmount, actualAmount, status |
| **Team** | name, role, responsibility, status |
| **Readiness** | overallScore, status, components (0–100 per area), weights — **the existing Phase 4 result** |

No passwords, tokens, connection strings, `_id`s or `User` records are sent.

---

## 5. API

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/events/:eventId/ai/analyze` | authenticated **ORGANISER who owns `:eventId`** | Analyse the event's planning data; returns the structured result |

Mounted on the existing Phase 4 planning router, so it inherits exactly the same guard chain
(`authenticate` → `requireRole(ORGANISER)` → `requireEventOwnership`). No new security code.

**Response** (`{ success: true, data: … }`):

```jsonc
{
  "method": "rule-based",
  "engine": "heuristic-planning-analyzer",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL",
  "summary": "…",
  "readinessAssessment": "…",
  "recommendations": [ { "category","priority","title","description","reason","suggestedAction" } ],
  "risks":           [ { "category","severity","title","description","mitigation" } ],
  "readiness": { "overallScore": 0, "status": "…" },
  "basedOn":   { "tasks": 0, "schedule": 0, "resources": 0, "budget": 0, "team": 0 },
  "generatedAt": "ISO-8601"
}
```

The analysis is generated **on demand** and is **not stored** in MongoDB. No new collections.
After any planning change the organiser re-runs **Analyze Again**; the UI carries the line
*"Analysis based on your planning data at &lt;time&gt;."*

---

## 6. AI Service

- **Framework:** the existing FastAPI + Uvicorn service (`ai-service/`) — reused, not replaced.
  Version bumped `0.1.0 → 0.5.0`. `GET /health` preserved unchanged.
- **New endpoint:** `POST /analyze` (`ai-service/routes/analyze.py`), request/response validated
  by Pydantic v2 models (`ai-service/models/schemas.py`).
- **Model / logic:** `ai-service/services/analyzer.py` — a **deterministic rule-based engine**.
  It is **not** a machine-learning model and **not** an LLM; no model is downloaded; the only
  dependencies are FastAPI, Uvicorn and Pydantic (all already present). This is a transparent
  choice: no model or API key is available in the environment, and Phase 5 §36–§37 permit a
  documented rule-based analysis provided it is not misrepresented — so **every response carries
  `"method": "rule-based"`**, the UI shows *"Rule-based analysis of your planning data"*, and
  this document says so plainly. The single seam for a future LLM narrative layer is
  `analyzer._narrative()` (swap its body for a model call; the structured findings from the
  rules stay).
- **Input:** the JSON payload in §4. **Output:** the structure in §5. Deterministic — the same
  input always produces the same output (verified).
- **Error handling:** malformed input → FastAPI 422. The analyzer itself never raises on empty
  or partial data (every reducer handles empty lists).
- **Fallback behaviour (backend side):** if the AI service is unreachable, times out
  (`AI_TIMEOUT_MS`, default 20 s), returns a non-2xx, or returns an unexpected shape, the
  backend responds **503** with `{"message": "AI planning assistance is temporarily
  unavailable."}` and nothing else — no stack, no Python detail, no internal URL. It does **not**
  fabricate recommendations. `errorHandler.js` was adjusted so operational errors (`ApiError`)
  never attach a stack, even at 5xx.

---

## 7. Security

All results are from the automated backend security suite (27–33, 47, 48).

| Test | Expected | Result |
| --- | --- | --- |
| Organiser A analysing **their own** event | 200 + structured result | **PASS** |
| Organiser B analysing Organiser A's event | 403 | **PASS** |
| `USER` analysing an organiser event | 403 | **PASS** |
| `ADMIN` analysing an organiser event (no organiser-planning access this phase) | 403 | **PASS** |
| No auth cookie | 401 | **PASS** |
| Malformed event id (`/events/not-an-id/ai/analyze`) | 400 | **PASS** |
| Unknown / non-existent event id | 404 | **PASS** |
| 403 / 404 response bodies inspected for leaks | no stack, no `mongo…`, no `.py`, no internal host/port | **PASS** |
| AI service unavailable → response body | 503, friendly message, **no** `stack` field, no Python/traceback | **PASS** |
| AI service unavailable → planning still works | `GET /tasks`, `GET /planning/readiness` still 200 | **PASS** |
| Readiness in the AI response vs `GET /planning/readiness` | identical (not recomputed) | **PASS** |
| `readinessAssessment` cites the actual score | yes | **PASS** |
| No DB credentials / tokens sent to the AI service | payload contains only planning fields (§4) | **by construction** |

Frontend: `/organiser/events/:id/planning/ai` is under the existing
`RoleProtectedRoute roles={['ORGANISER']}`; a `USER` hitting it is redirected to `/user`
(verified in E2E). Frontend guards are UX only — the backend enforces the same rules.

---

## 8. UI

Design reuses the project's existing language — same typography, cards, borders, spacing,
buttons, and the existing status/priority badges (`PlanningBadge`, already `whitespace-nowrap`).
No gradients, glow, decorative AI graphics or excessive animation (a single small spinner ring
while analysing). Priority/severity is shown as a **text** badge ("Critical", "High", …), not
colour alone.

| Viewport | Result |
| --- | --- |
| **Desktop 1920×1080** | Content capped at 1400 px (Phase-4 shell), 3 cards stacked, summary's inner grid 2-up. Screenshot inspected. |
| **Laptop 1366×768** | Well-proportioned; sidebar on-canvas. |
| **Tablet 1024×768 & 768×1024** | Cards stack; sidebar on-canvas (md = 768). |
| **Mobile 390×844 & 375×667** | Everything 1-up; badges wrap onto their own line above each finding title without breaking the pill; sidebar is the drawer; sub-nav (now 8 tabs) scrolls horizontally and auto-scrolls the active tab into view. |
| **No page-level horizontal overflow** at any of the six viewports | verified programmatically (`scrollWidth ≤ clientWidth`) with analysis results shown |

| State | Behaviour |
| --- | --- |
| **Empty (before first run)** | Dashed card: *"No analysis yet … Analyze your event plan to receive AI-assisted recommendations."* + **Analyze Event Plan** button. No fake recommendations. |
| **Loading** | Spinner + *"Analyzing your planning data…"* + *"The review covers Tasks · Schedule · Resources · Budget · Team · Readiness."* — framed as coverage, not fabricated separate AI calls. The button is disabled while running (no duplicate requests). |
| **Error** | Rose panel: *"AI planning assistance is temporarily unavailable."* + *"The rest of the planning workspace is unaffected…"* + **Try Again**. No stack / internals. |
| **Result** | **AI planning summary** card (summary, overall priority badge, current readiness + status, "Analysed: N tasks · …", "Rule-based analysis · &lt;time&gt;", Readiness assessment) → **AI recommendations** (ordered, each with priority + category + title + description + Why + Suggested action) → **Potential risks** (severity + category + title + description + Mitigation; card border tinted amber/rose by severity) → footer with the freshness note + **Analyze Again**. |

**Accessibility:** each card has a heading; buttons carry text labels; the spinner is
`aria-hidden`; focus outlines are the project defaults (unchanged); severity is text + colour,
never colour only.

---

## 9. Testing — actual results

### AI analyzer scenarios — `ai-service/tests/test_analyzer.py` (`python tests/test_analyzer.py`)

`==== 26 passed, 0 failed ====`

| # | Scenario | Key assertions (all passed) |
| --- | --- | --- |
| 1 | **Well-prepared event** | overall priority `LOW`; **0** risks; **≤ 2** recommendations; readiness assessment cites the score |
| 2 | **Incomplete tasks** (overdue critical) | a `TASK` risk, severity `CRITICAL`; a task recommendation about the open critical work; overall `CRITICAL` |
| 3 | **Resource gaps** (unconfirmed technical) | a `RESOURCE` recommendation; technical-not-confirmed is `HIGH` |
| 4 | **Schedule conflict** | a `SCHEDULE` risk that *explains the overlap* (does not invent one) |
| 5 | **Budget concern** (actuals over estimate) | a `BUDGET` risk recognising the overspend |
| 6 | **Team gap** (registration slot, nobody assigned) | a `TEAM` recommendation naming the registration coverage gap |
| 7 | **Empty planning data** | no crash; ≥ 3 missing-preparation recommendations across ≥ 3 areas; summary says "not started"; **no fabricated CRITICAL** findings |
| 8 | **AI service unavailable** | covered by the backend suite below (Test 8 is a backend concern) |
|  + | Response shape / determinism | every recommendation has all 6 fields, every risk all 5; `method: "rule-based"`; same input → identical output |

### Backend integration + security — 37 checks

`==== 37 passed, 0 failed ====`

Covers: the happy path (structured fields, `method`, `basedOn`, `generatedAt`, priority sorting,
data-derived findings — overdue-critical → TASK risk, `NOT_AVAILABLE` → RESOURCE risk, overlap
→ SCHEDULE risk, overall `CRITICAL`, summary cites the real title); readiness echoes
`GET /planning/readiness` exactly; re-analyse after a planning change reflects the new counts;
the full §7 security matrix; the AI-down path (a second backend instance pointed at a dead
port → 503, friendly message, no leak, planning endpoints still 200); DB cleanup.

### Frontend E2E — `phase5-frontend-e2e.mjs` (headless Chrome / CDP)

`==== 27 passed, 0 failed ====`

Login → seed event + planning data via API → "AI Assistant" tab present → intro copy + event
context + current-readiness + empty state + button → click **Analyze Event Plan** → summary /
recommendations / risks / readiness-assessment / overall-priority all render → readiness %
matches the Phase 4 score → a recommendation ("Suggested action:") and a risk ("Mitigation:")
render → a priority badge shows → `method` disclosed as rule-based → **Analyze Again** present →
**no** "Create task"/mutation button → re-run works → `USER` is redirected away from the AI
page → **0 console errors**.

### Frontend responsive — `phase5-responsive-check.mjs`

`==== 37 passed, 0 failed ====` — the AI page analysed and inspected at **1920, 1366, 1024,
768, 390, 375**: analysis renders, no page horizontal overflow, sidebar visible/off-canvas per
breakpoint, priority badges present and non-wrapping, recommendation/risk cards fit the
viewport; plus the workspace error state at 375 has no overflow.

---

## 10. Regression — actual results

Re-run after Phase 5, unchanged behaviour:

| Suite | Result |
| --- | --- |
| Phase 1 — backend auth + RBAC | **51 / 51** |
| Phase 2 — Admin E2E | **47 / 47** |
| Phase 2 — Admin responsive | **40 / 40** |
| Phase 3 — Event E2E | **51 / 51** |
| Phase 3 — responsive | **50 / 50** |
| Phase 4 — planning E2E (incl. cross-owner / cross-event) | **44 / 44** |
| Phase 4 — planning responsive | **70 / 70** |
| **Regression total** | **353 / 353** |
| **+ Phase 5 (analyzer 26 · backend 37 · E2E 27 · responsive 37)** | **127 / 127** |
| **Grand total** | **480 / 480** |

No previously passing test regressed.

---

## 11. Build

| Check | Result |
| --- | --- |
| **Frontend production build** (`npm run build`) | ✓ **165 modules** transformed, **0 errors, 0 warnings**. `dist/assets/index-*.js` 396.66 kB (gzip 117.61) · `index-*.css` 26.18 kB. (159 → 165: the AI service module, the AI page, and 4 small AI components.) |
| **Backend startup** (`npm start`) | ✓ `MongoDB connected: database "event_management_system"` → `Backend API listening on http://localhost:5000`. `node --check` passes on every file in `backend/src`. |
| **AI service startup** (`python main.py`) | ✓ `Application startup complete.` → `Uvicorn running on http://127.0.0.1:8000`. `GET /health` → 200. `POST /analyze` → 200. OpenAPI paths: `/`, `/analyze`, `/health`. |
| Ports | Frontend 5173 · Backend 5000 · AI 8000 · Mongo 27017 — all as expected |

---

## 12. Files Changed

Phase-5-specific. (Other files in `git diff` — `CrudSection.jsx`, `PlanningBadge.jsx`,
`AdminLayout.jsx`, `PlanningWorkspaceLayout.jsx`, `OrganiserDashboard.jsx`, `PlanningBudget.jsx`,
`PlanningResources.jsx` — are from the earlier **Phase 4 Visual Testing** task, not this phase.)

### New

| File | Why |
| --- | --- |
| `ai-service/models/schemas.py` | Pydantic request/response models for `/analyze` |
| `ai-service/services/analyzer.py` | The rule-based analysis engine (section rules + narrative + prioritisation) |
| `ai-service/routes/analyze.py` | `POST /analyze` route wiring |
| `ai-service/tests/test_analyzer.py` | Scenario tests for the analyzer (kept in-tree so the AI is reproducibly demonstrable per §53) |
| `backend/src/services/aiPlanning.service.js` | `gatherAiContext()` (reuses `getReadiness` + the planning models) + `requestAnalysis()` (fetch to the AI service, timeout, shape validation, 503 mapping) + `analyzeEventPlan()` |
| `backend/src/controllers/aiPlanning.controller.js` | Thin `asyncHandler` for `POST /ai/analyze` |
| `frontend/src/services/aiPlanningService.js` | `analyze(eventId)` — one Axios call, 45 s timeout |
| `frontend/src/pages/organiser/planning/PlanningAiAssistant.jsx` | The AI Assistant page: event context, idle/loading/error/result states, run + re-run |
| `frontend/src/components/planning/AiSummaryCard.jsx` | Summary + readiness explanation + overall priority |
| `frontend/src/components/planning/AiRecommendations.jsx` | Ordered recommendation list (informational; no action buttons) |
| `frontend/src/components/planning/AiRisks.jsx` | Risk list with severity-tinted borders + mitigations |
| `frontend/src/components/planning/AiCategoryTag.jsx` | Neutral pill for a finding's area |

### Modified

| File | Change | Why |
| --- | --- | --- |
| `ai-service/main.py` | include the analyze router; version `0.5.0`; docstring | wire up `/analyze`; state the engine is rule-based |
| `ai-service/requirements.txt` | pin `pydantic>=2.7,<3.0`; comment that no ML framework is used | explicitness; no heavy deps |
| `backend/src/config/env.js` | add `ai.serviceUrl` (default `http://127.0.0.1:8000`) + `ai.timeoutMs` (default 20000) | AI service location + timeout, overridable via env |
| `backend/.env.example` | add `AI_SERVICE_URL`, `AI_TIMEOUT_MS` | document the new vars (`backend/.env` set to match locally; not committed) |
| `backend/src/routes/planning.routes.js` | add `router.post('/ai/analyze', aiPlanning.analyze)` | the endpoint, behind the existing planning guard chain |
| `backend/src/middleware/errorHandler.js` | don't attach `stack` when `err.isOperational` | so the 503 (and any `ApiError`) never leaks a stack, per §27 |
| `backend/package.json` | version `0.5.0`; description → "Phase 5" | — |
| `frontend/package.json` | version `0.5.0` | — |
| `frontend/src/components/planning/PlanningSubNav.jsx` | add `{ to: 'ai', label: 'AI Assistant' }` | the 8th workspace tab (existing overflow-scroll + active-scroll-into-view already handle the extra tab) |
| `frontend/src/routes/AppRoutes.jsx` | add `<Route path="ai" element={<PlanningAiAssistant/>} />` | route the page inside the planning workspace |
| `frontend/src/layouts/OrganiserLayout.jsx` | `titleFor()` maps the `ai` segment → "AI Assistant" | header title reads "AI Assistant" instead of "Ai" |
| `README.md` | new "AI Planning Assistant (Phase 5)" section; `AI_SERVICE_URL`/`AI_TIMEOUT_MS` in the env block; status + roadmap updated | document the feature, its rule-based nature, the endpoint, and the fallback behaviour |

---

## 13. Known Issues

1. **The analysis engine is rule-based, not an ML model or LLM.** This is deliberate and
   disclosed everywhere (`method: "rule-based"` in every response, a note in the UI, this
   report, the README). No model or API key is available in the target environment, and §35–§37
   permit a documented rule-based analysis. The seam for a future LLM narrative layer is
   `analyzer._narrative()` — the structured findings from the rules would remain.
2. **`express.json()` strict mode.** A request to `/ai/analyze` sent with
   `Content-Type: application/json` **and a literal `null` body** returns **400** with a parser
   message (`Unexpected token 'n'…`). It is a 4xx (client error), leaks nothing internal, and
   the frontend sends `{}`; a `curl` with no body works. Not "fixed" — changing the global body
   parser is riskier than the one-line frontend choice already made.
3. **Test-file placement.** `ai-service/tests/test_analyzer.py` is kept **in the repository**
   (unlike previous phases' throwaway `__phaseN_tests` harnesses) so a reviewer can run the AI
   rules against real scenarios during a demo (§53). The backend integration harness and the
   frontend E2E / responsive scripts remain session scratch files, as in prior phases; their
   scenarios and results are recorded above.
4. **Uvicorn `--reload` orphan (dev only).** `python main.py` runs Uvicorn with `reload=True`;
   on Windows its file-watcher subprocess can briefly outlive Ctrl-C and hold port 8000.
   Running `python -m uvicorn main:app` (no reload) avoids it. Not a code issue.
5. **No commits.** As throughout this project, nothing has been committed; `git diff --stat`
   shows the cumulative uncommitted changes from the credential-update, Phase-4-visual and
   Phase-5 tasks together. `backend/.env` remains git-ignored.

---

## Final Acceptance Criteria

- [x] AI Planning Assistant exists · [x] integrated into the Planning Workspace (8th tab)
- [x] Organiser can analyse an event · [x] analysis uses actual event data
- [x] Existing readiness score is reused · [x] AI does **not** replace the readiness calculation
- [x] Recommendations structured · [x] Risks structured · [x] Recommendations prioritised
- [x] Missing preparations identified · [x] Task / Schedule / Resource / Budget / Team analysed
- [x] AI does **not** silently modify planning data
- [x] AI failure does **not** break planning · [x] Loading state · [x] Error state · [x] Retry
- [x] Authentication · [x] RBAC · [x] Event ownership enforced (backend, not just frontend)
- [x] USER cannot access organiser AI planning · [x] no sensitive information leaked
- [x] Desktop / Tablet / Mobile UI work · [x] no page-level horizontal overflow
- [x] Existing Phase 4 functionality intact · [x] existing regression tests pass (353/353)
- [x] Frontend build passes · [x] Backend starts · [x] AI service starts

**Phase 5 complete. Participant registration, QR attendance, certificates, feedback, sentiment
analysis, post-event analytics and advanced notifications have not been started.**
