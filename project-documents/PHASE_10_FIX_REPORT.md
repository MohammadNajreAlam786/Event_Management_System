# PHASE 10 FIX REPORT

**Analytics, Reporting & Data-Consistency Stabilization**

AI-Powered Event Management System with QR-Based Attendance —
Sreyas Institute of Engineering and Technology, Dept. of CSE (AI & ML).

This is a targeted fix pass on the known issues identified after Phase 10. **No
new features. Not Phase 11.** (No AI recommendations, predictions, forecasting or
future-event planning were added.)

---

## 1. Fix Summary

| # | Issue | Status | What was done |
| --- | --- | --- | --- |
| 1 | **Certificate issuance rate could exceed 100 %** when a participant attended → a certificate was issued → the registration was later cancelled (old denominator `eligible = present-among-active` shrank while `issued` did not). | **Fixed** | `certificates.eligible` is now a **historical** count — distinct users who were ever `PRESENT` for the event, regardless of later cancellation. `certificates.issuanceRate = issuedForEligible / eligible × 100`, **clamped to ≤ 100** (`0` when nobody is eligible). By construction `issuedForEligible ⊆ eligible`, so the rate can never exceed 100. |
| 1b | Same class of bug in **`feedbackParticipationRate`** (a respondent who submitted feedback then cancelled could push it over 100 %). | **Fixed** | Same historical denominator (`attendedParticipants`) + clamp. |
| 2 | `analyticsAvailable` was only a UI hint; the API behaviour for pending/cancelled events was implicit. | **Fixed** | Added an explicit **`analyticsStatus`** field (`AVAILABLE` \| `PARTIAL` \| `NOT_AVAILABLE`) alongside `analyticsAvailable`. The report gate and the frontend both consume it; the frontend no longer re-derives availability from the event status. Registration data is still always returned. |
| 3 | Admin `totalAttendees` was a flat `PRESENT` row count (double-counts a person across events; includes attend-then-cancel). | **Fixed** | Now an aggregation: `PRESENT` check-ins whose registration is still `REGISTERED`, `$group`ed by user, counted → **distinct valid attendees**. |
| 4 | Read-only guarantee. | **Verified** (no change needed) | The service already only reads. A test now asserts every collection count is unchanged after `analytics` + `report` + `summary`, and greps the service/PDF source for write calls. |
| 5 | Ownership / RBAC hardening. | **Verified + tested** | `actorOf(req)` reads only `req.user.{id,role}`; a doc comment was added. Tests confirm `?organiserId=`, `?userId=`, `?ownerId=`, `?organiser=`, `?owner=` bypass attempts all still `403`. |
| 6 | Frontend analytics presentation for non-completed events. | **Fixed** | `AnalyticsView` now branches on `analyticsStatus` + `event.status`: added an **ONGOING → PARTIAL** view ("in progress" notice + current registrations + "Checked in so far"), reworded the `NOT_AVAILABLE` message, kept the `CANCELLED` view. No redesign, no new cards. |
| 7 | PDF report must use the same corrected calculations. | **Verified + reworded** | `getEventReportData` already builds **one** analytics object via `getEventAnalytics` and hands it to `buildEventReportPdf` — the corrected `eligible` / `issuanceRate` / `feedbackParticipationRate` flow straight through with no duplicated formula. Wording tweaks only ("N (everyone who attended)", "% of those who attended"). |
| 8 | Centralize analytics calculations. | **Verified** (already centralized) | All business math lives in `analytics.service.js`. The frontend and the PDF only display values; the admin page uses the same service. Audit + note in the report. |
| 9 | Bar-chart safety. | **Fixed** | `BarChart.jsx` now coerces non-finite / negative values and maxes to `0`, clamps bar widths to `[0, 100] %`, and renders a graceful message for an empty dataset. The PDF `bar()` helper got the same guard. No library added. |
| 10 | Regression safety. | **Verified** | Full Phase 1–10 regression re-run — see §7. |

---

## 2. Files Changed

### Backend

| File | Why |
| --- | --- |
| `backend/src/services/analytics.service.js` | The core fix. Added `analyticsStatusFor()` + `ratePct()` (clamp helper); `round1()` now guards non-finite input. `getEventAnalytics` now loads the event's `PRESENT` attendance rows and `ISSUED` certificate rows (lean, single-field) to compute a **historical** `presentUserIds` set → `certificates.eligible` (historical), `issuedForEligible`, a clamped `certificates.issuanceRate` (`0` not `null` when eligible is 0), a clamped `participation.feedbackParticipationRate`, and a new `participation.attendedParticipants`. Response now carries `analyticsStatus`. `getEventReportData` gates on `analyticsStatus !== 'AVAILABLE'`. `getPlatformSummary` `totalAttendees` → aggregation over valid, de-duplicated attendees. |
| `backend/src/utils/eventReportPdf.js` | No formula change (consumes the analytics object). `bar()` helper clamps `frac` and rejects non-finite / negative input (Issue 9). Certificate + feedback-participation rows reworded to match the analytics page. |
| `backend/src/controllers/analytics.controller.js` | Doc comment on `actorOf` making the "session identity only, never query params" rule explicit (Issue 5). No behaviour change. |
| `backend/package.json` | version `0.10.0 → 0.10.1`. |

### Frontend

| File | Why |
| --- | --- |
| `frontend/src/components/analytics/BarChart.jsx` | Issue 9 hardening — `safe()` coercion, width clamp `[0,100]`, empty-dataset message. Still dependency-free, same visual design. |
| `frontend/src/components/analytics/AnalyticsView.jsx` | Issue 6 — branch on `analyticsStatus`; new `PARTIAL` (ONGOING) view; reworded `NOT_AVAILABLE` message; caption reworded to "of the N who attended" + `?? 0` guards. |
| `frontend/src/pages/organiser/OrganiserAnalytics.jsx` | Report buttons gated on `analytics.analyticsAvailable` (was `analytics.state === 'COMPLETED'`). |
| `frontend/src/pages/admin/AdminStatistics.jsx` | Same report-button gating change. |
| `frontend/package.json` | version `0.10.0 → 0.10.1`. |

### Docs

| File | Why |
| --- | --- |
| `README.md` | Post-event analytics section: `analyticsStatus` table, corrected formulas (historical eligibility, clamps), admin `totalAttendees` definition, "report consumes the same analytics object" note. |
| `project-documents/PHASE_10_FIX_REPORT.md` | This report. |

### Not committed (session scratchpad)

`p10fix-shots.mjs`, `p10fix-reshot.mjs`; `backend/__phase10fix_tests.mjs` (temporary — 72 checks, run then deleted). `phase10-frontend-e2e.mjs` gained a `T10b` ONGOING/PARTIAL block and its `T12` upcoming assertion was reworded to match the new message.

---

## 3. Analytics Formula Changes

`round1(n) = Number.isFinite(n) ? Math.round(n*10)/10 : 0`
`pct(part, whole) = whole > 0 ? round1(part/whole*100) : 0`   *(0 when denom 0 — never NaN/Infinity)*
**`ratePct(part, whole) = Math.max(0, Math.min(100, pct(part, whole)))`**   *(new — clamped ≤ 100)*

| Metric | Before | After |
| --- | --- | --- |
| `attendance.present` | PRESENT check-ins with a still-`REGISTERED` registration | **unchanged** |
| `attendance.rate` | `pct(present, registered)` | **unchanged** (both sides exclude cancelled → already ≤ 100) |
| `participation.attendedParticipants` | *(did not exist)* | **new** — `new Set(presentRows.map(r => r.user)).size` = distinct people ever PRESENT (historical) |
| `certificates.eligible` | `state === 'COMPLETED' ? attendance.present : 0` | `analyticsAvailable ? attendedParticipants : 0` — **historical**, does not shrink on cancellation |
| `certificates.issued` | `Certificate.countDocuments({event, status:'ISSUED'})` | `issuedCertRows.length` — **unchanged meaning** (total) |
| `certificates.issuanceRate` | `eligible > 0 ? pct(issued, eligible) : null` — **could exceed 100** | `eligible > 0 ? ratePct(issuedForEligible, eligible) : 0` — **≤ 100, never null**. `issuedForEligible` = distinct eligible users holding an ISSUED cert |
| `participation.feedbackParticipationRate` | `pct(feedbackTotal, attendance.present)` — **could exceed 100** | `attendedParticipants > 0 ? ratePct(feedbackTotal, attendedParticipants) : 0` — **≤ 100** |
| `sentiment.*Pct` | `pct(x, analysed)` | **unchanged** (`x ⊆ analysed` → already ≤ 100) |
| admin `totalAttendees` | `Attendance.countDocuments({status:'PRESENT'})` | aggregation: `PRESENT` ∩ registration `status === 'REGISTERED'`, `$group {_id:'$user'}`, `$count` → **distinct valid attendees** |

**Why historical eligibility.** A participant who attended, was issued a
certificate, and then cancelled their registration is still, historically, an
attendee. The live registration count and `attendance.present` correctly drop to
reflect the cancellation, but the *certificate-issuance* and
*feedback-participation* rates use the historical attendee count as their
denominator, so `issued ≤ eligible` and `feedbackTotal ≤ attendedParticipants`
always hold and neither rate can exceed 100 %.

---

## 4. Certificate Edge Case — Demonstrated

**Scenario A (the ">100 %" case):** 5 participants register → all 5 attend
(QR check-in) → 5 certificates issued → **3 of them cancel their registration**.

| Field | Old code | **Fixed code** |
| --- | --- | --- |
| `registrations.total` (active) | 2 | 2 |
| `registrations.cancelled` | 3 | 3 |
| `attendance.present` (among active) | 2 | 2 |
| `attendance.rate` | 100 % | 100 % |
| `participation.attendedParticipants` | — | **5** |
| `certificates.issued` | 5 | 5 |
| `certificates.eligible` | **2** | **5** |
| **`certificates.issuanceRate`** | **`5 / 2 × 100 = 250 %`** ❌ | **`5 / 5 × 100 = 100 %`** ✅ |
| `participation.feedbackParticipationRate` (5 feedback) | `5 / 2 × 100 = 250 %` ❌ | `5 / 5 × 100 = 100 %` ✅ |

**Scenario B (single participant, verified live):** register → attend → certificate
issued → feedback submitted → registration flipped to `CANCELLED`. Analytics API
returned:

```json
"registrations": { "total": 0, "cancelled": 1, "allTime": 1 },
"attendance":    { "present": 0, "absent": 0, "rate": 0 },
"certificates":  { "issued": 1, "eligible": 1, "issuanceRate": 100 },
"participation":  { "attendedParticipants": 1, "feedbackParticipationRate": 100 }
```

`issuanceRate` is **100**, not `250` / `null` / `NaN`. The generated PDF report
shows the identical values ("Eligible participants: 1 (everyone who attended)",
"Issuance rate: 100%", "Feedback participation rate: 100% of those who
attended"). The analytics page and the report were both opened and visually
inspected (`scratchpad/p10fix-shots/`).

Verified not to break: certificate generation, certificate verification (public
`GET /api/certificates/verify/:code` still returns the cert), attendance,
registration, cancellation, analytics, and the PDF report (all covered by the
fix test suite + the full regression).

---

## 5. RBAC Validation

Executed against the running backend (real login cookies). Analytics
(`GET /api/events/:id/analytics`) and report (`GET /api/events/:id/report`):

| Caller | Result |
| --- | --- |
| **Organiser — own event** | `200` (analytics), `200 application/pdf attachment` (report, COMPLETED) |
| **Organiser — another organiser's event** | `403` (analytics + report, service + HTTP) |
| **Organiser — `?organiserId=<victim>` / `?userId=` / `?ownerId=` / `?organiser=` / `?owner=`** | `403` (query params never consulted) |
| **USER** | `403` (analytics + report) |
| **Unauthenticated** | `401` (analytics + report) |
| **ADMIN — any event** | `200` (analytics + report) |
| **Admin platform summary** (`GET /api/admin/analytics/summary`) | ADMIN `200` · ORGANISER `403` · unauthenticated `401` |

---

## 6. PDF Validation

The report is generated from the **same analytics object** returned by
`getEventAnalytics` (no duplicated formulas). The fix test decodes the generated
PDF's text operators and asserts, against the live analytics API response for the
same event, that these match byte-for-byte:

- ✅ event name, status (`COMPLETED`), organiser, event id, generated date
- ✅ registration count, cancelled count
- ✅ attendance rate (`a.attendance.rate %`)
- ✅ average rating (`a.feedback.averageRating / 5`)
- ✅ rating distribution (5★–1★ counts)
- ✅ sentiment counts + percentages (`Positive: n (p%)` …)
- ✅ certificate eligibility (`a.certificates.eligible (everyone who attended)`)
- ✅ certificates issued (`a.certificates.issued`)
- ✅ certificate issuance rate (`a.certificates.issuanceRate %`, clamped ≤ 100)
- ✅ feedback participation rate (`a.participation.feedbackParticipationRate % of those who attended`, clamped ≤ 100)
- ✅ the report is a valid PDF (`%PDF-1.3` … `%%EOF`, a `/Type /Page`, > 1.5 KB)

Report generation is read-only (asserted). The report is refused (`409`) for
`UPCOMING`, `ONGOING`, `CANCELLED` and `DRAFT` events, and (`403`/`401`) for a
non-owner / USER / unauthenticated caller.

---

## 7. Test Results

**All numbers below are from actual executed runs.**

### Fix-specific suite — `backend/__phase10fix_tests.mjs`

**72 / 72 passed, 0 failed.** (Real `event_management_system` DB + running
backend for HTTP/RBAC; self-cleaning `@p10fix.local` fixtures.) Covers the 32
required test points:

| # | Point | Result |
| --- | --- | --- |
| 1 | Certificate issuance rate cannot exceed 100 % (incl. the 5-attend / 5-cert / 3-cancel and all-cancelled cases) | ✅ = 100 %, never > 100, never NaN |
| 2 | attend → certificate → cancellation stays historically correct | ✅ eligible 5, issued 5, rate 100 %, registrations 2 active / 3 cancelled, present 2 |
| 3 | Zero eligible participants | ✅ eligible 0, issuanceRate `0` (a number) |
| 4 | Zero feedback | ✅ averageRating `null`, pcts `0` |
| 5 | Zero attendance | ✅ present 0, rate 0, participation rate 0 |
| 6 | No duplicate attendance | ✅ 2nd insert on same registration → `E11000`; analytics counts once |
| 7 | Cancelled registration not counted as attendance | ✅ present drops 8 → 6; historical `attendedParticipants` stays 8; registrations 8 active / 2 cancelled |
| 8 | Admin attendee statistics consistent | ✅ distinct valid attendees over fixtures = hand count; multi-event attendee counted once; attend-then-cancel excluded; RBAC 401/403/200 |
| 9 | Upcoming event analytics state | ✅ `analyticsStatus: NOT_AVAILABLE`, `analyticsAvailable: false`, no summary, registrations kept |
| 10 | Ongoing event analytics state | ✅ `analyticsStatus: PARTIAL`, `analyticsAvailable: false`, current facts returned, no summary |
| 11 | Cancelled event analytics state | ✅ `analyticsStatus: NOT_AVAILABLE`, `state: CANCELLED`, cancelled-specific summary (no "attendance rate"), registrations kept |
| 12 | Completed event analytics state | ✅ `analyticsStatus: AVAILABLE`, full sections + summary |
| 13 | Organiser → own event | ✅ `200` (service + HTTP) |
| 14 | Organiser → another organiser's event | ✅ `403` (analytics + report, service + HTTP) |
| 15 | Organiser query-parameter ownership bypass (`organiserId`/`userId`/`ownerId`/`organiser`/`owner`) | ✅ all `403` |
| 16 | USER → analytics / report / admin summary | ✅ `403` |
| 17 | Unauthenticated → analytics / report / admin summary | ✅ `401` |
| 18 | Analytics endpoints remain read-only | ✅ collection counts unchanged after analytics + report + summary; source has no write calls |
| 19 | PDF values match analytics API | ✅ every value cross-checked (see §6) |
| 20 | PDF cannot be generated for unsupported states | ✅ `409` for UPCOMING / ONGOING / CANCELLED / DRAFT; `200` for COMPLETED |
| 21 | Empty analytics datasets | ✅ all sections present, rating-distribution keys 0, no NaN |
| 22 | Invalid percentage / chart values | ✅ every rate is a finite number in `[0, 100]` |
| 23 | Existing certificate functionality | ✅ verification endpoint still returns the cert |
| 24 | Existing notification functionality | ✅ regression suite (Phase 8) green |
| 25 | Existing feedback / sentiment functionality | ✅ records intact; regression suite (Phase 9) green |
| 26 | Existing QR attendance functionality | ✅ records intact; regression suite (Phase 7) green |
| 27 | Existing registration functionality | ✅ 2 active + 3 cancelled rows intact; regression suite (Phase 6) green |
| 28 | Existing pre-event planning functionality | ✅ regression suite (Phase 4 + 5) green |
| 29 | Frontend build succeeds | ✅ 273 modules, 0 errors |
| 30 | Backend starts successfully | ✅ connects, listens on :5000 |
| 31 | AI service still starts successfully | ✅ `v0.9.0`, `/health` OK, `/analyze` + `/sentiment/analyze` OK |
| 32 | MongoDB connects to `event_management_system` | ✅ asserted `mongoose.connection.name` |

### Phase 10 E2E — `scratchpad/phase10-frontend-e2e.mjs`

**33 / 33 passed, 0 console errors.** (30 original + 3 new `T10b` ONGOING/PARTIAL
checks; `T12` upcoming assertion reworded for the new message.)

### Phase 10 responsive — `scratchpad/phase10-responsive-check.mjs`

**42 / 42 passed** (six viewports).

### Regression — Phases 1–9

**928 / 928 passed.**

| Suite | Result |
| --- | --- |
| `phase1-backend-tests` | ✅ 51 / 51 |
| `phase1-frontend-e2e` | ✅ 23 / 23 |
| `phase2-frontend-e2e` | ✅ 47 / 47 |
| `phase2-regression-check` · `phase2-responsive-check` | ✅ 13 / 13 · 40 / 40 |
| `phase3-frontend-e2e` · `phase3-responsive-check` | ✅ 51 / 51 · 50 / 50 |
| `phase4-frontend-e2e` · `phase4-responsive-check` | ✅ 44 / 44 · 70 / 70 |
| `ai-service/tests/test_analyzer.py` | ✅ 26 / 26 |
| `phase5-frontend-e2e` · `phase5-responsive-check` | ✅ 27 / 27 · 37 / 37 |
| `phase6-frontend-e2e` · `phase6-responsive-check` | ✅ 34 / 34 · 90 / 90 |
| `phase7-frontend-e2e` · `phase7-responsive-check` | ✅ 32 / 32 · 66 / 66 |
| `phase8-frontend-e2e` · `phase8-responsive-check` | ✅ 32 / 32 · 72 / 72 |
| `ai-service/tests/test_sentiment.py` | ✅ 34 / 34 |
| `phase9-frontend-e2e` · `phase9-responsive-check` | ✅ 34 / 34 · 55 / 55 |

In the single batched 22-suite run, `phase5-frontend-e2e` reported 9 / 27
(the entire "AI Assistant" page section) — a timing flake under sustained load
(20 back-to-back Chrome suites hitting one dev backend + Vite + AI service). It
was **re-run standalone against a clean DB and passed 27 / 27**. Phase 10 fix
changes nothing in the AI service, `aiPlanning.*`, the planning routes, or any
Phase 5 code; the `/analyze` endpoint was confirmed responding correctly.

### Totals

- **Fix-specific: 72 / 72**
- **Phase 10 suites (E2E + responsive): 75 / 75**
- **Regression (Phases 1–9): 928 / 928**
- **Grand total: 1075 / 1075**

---

## 8. Build & Runtime

| Check | Result |
| --- | --- |
| **Frontend production build** (`npm run build`) | ✅ **273 modules, 0 errors**. Main bundle 375 kB — unchanged. The one chunk-size warning is the pre-existing Phase 7 `html5-qrcode` lazy chunk. No dependency added. |
| **Backend startup** (`node src/server.js`) | ✅ connects to `event_management_system` on `localhost:27017`, listening on `:5000`, no errors. |
| **MongoDB connection** | ✅ `mongodb://127.0.0.1:27017/event_management_system` — `GET /api/health` → `database: "connected"`. The old `event_management` DB was never touched (still 2 users). |
| **AI service health** (`uvicorn main:app`) | ✅ `v0.9.0`; `GET /health` → `capabilities: { planningAnalysis: true, sentimentAnalysis: true }`; `POST /analyze` and `POST /sentiment/analyze` both respond correctly. |
| **Analytics API** | ✅ `GET /api/events/:id/analytics` returns the corrected structured payload (`analyticsStatus`, historical eligibility, clamped rates). |
| **PDF report generation** | ✅ valid 1–2 page PDF; values match the analytics API; gated to `AVAILABLE` events. |

---

## 9. Responsive Testing

`scratchpad/phase10-responsive-check.mjs` — **42 / 42 passed** across all six
required sizes:

| Viewport | Organiser `/organiser/analytics` | Admin `/admin/statistics` |
| --- | --- | --- |
| 1920 × 1080 | ✅ no overflow · sidebar visible · cards + selector fit · charts + bars + report button fit | ✅ no overflow · sidebar visible · summary cards + selector fit |
| 1366 × 768 | ✅ | ✅ |
| 1024 × 768 | ✅ | ✅ |
| 768 × 1024 | ✅ | ✅ |
| 390 × 844 | ✅ sidebar off-canvas | ✅ sidebar off-canvas |
| 375 × 667 | ✅ | ✅ |

The new ONGOING (PARTIAL) and reworded NOT_AVAILABLE states were visually
inspected at 1440 × 900 and 390 × 844 (`scratchpad/p10fix-shots/`): the notice
banner and the one/two stat cards fit and stack cleanly; no horizontal overflow;
buttons accessible. No UI redesign.

---

## 10. Remaining Issues

1. **The attend-then-cancel scenario is not fully reproducible through the
   participant API** (Phase 6 blocks cancelling a registration once the event is
   `COMPLETED`, which it must be for a certificate to have been issued). It can
   still arise from a mid-`ONGOING` cancellation, an admin action, a data
   migration, or a manual edit — so the analytics code is now robust to that data
   state regardless of how it is reached (verified by direct-DB test and a live
   single-participant reproduction).
2. **Cosmetic:** in that same rare edge case, the "Attendees" stat card
   (present-among-active) can read lower than the "N who attended" figure in the
   participation caption / certificate section (historical). This is correct — one
   person attended and then cancelled — and every number involved is now
   individually valid with all rates ≤ 100 %.
3. **`npm audit`** — the 3 pre-existing moderate `qs` → `body-parser` → `express`
   advisories are unrelated to this pass and untouched.
4. **No git commits** — the repository still has none; `git diff` is cumulative
   from Phase 4-visual onward. The fix files are staged.

---

## 11. Phase Verdict

**PASS**

All ten known issues are fixed or verified; the fix-specific suite is 72 / 72;
the full Phase 1–10 regression is green (928 / 928 for Phases 1–9, plus the
Phase 10 suites at 75 / 75; the lone batched `phase5-frontend-e2e` flake passed
27 / 27 standalone). Frontend build, backend startup, MongoDB and the AI service
are all healthy; analytics and the report are read-only; RBAC is enforced on
every path.
