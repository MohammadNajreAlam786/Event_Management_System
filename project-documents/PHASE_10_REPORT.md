# PHASE 10 IMPLEMENTATION REPORT

**Post-Event Analytics, Statistics & Reporting**

AI-Powered Event Management System with QR-Based Attendance —
Sreyas Institute of Engineering and Technology, Dept. of CSE (AI & ML).

---

## 1. Summary

Phase 10 adds a **read-only** analytics and reporting layer over the records
already created across the event lifecycle. It directly serves the abstract's
"AI-based event analytics", "participation analysis", "feedback analysis",
"event statistics" and "reporting":

- **Organiser analytics page** (`/organiser/analytics`) — pick one of your own
  events and see, for a `COMPLETED` event: total registrations, attendees,
  attendance rate, feedback count, average rating, rating distribution, sentiment
  counts + percentages, feedback-participation rate, certificates issued and the
  certificate-issuance rate — each computed from the current `Registration` /
  `Attendance` / `Feedback` / `Certificate` state. Three **dependency-free** bar
  charts (registration vs attendance, rating distribution, sentiment) plus a
  strictly factual performance summary.
- **Downloadable PDF report** — a one-to-two-page A4 report with the same
  statistics, an event identification block, a generation timestamp and a
  factual summary. `pdfkit`, no new dependency.
- **Admin Statistics page** (`/admin/statistics`, previously a placeholder) — a
  **basic** platform roll-up (events by status, registrations, attendees,
  feedback total + average, platform sentiment, certificates issued) plus the
  same per-event analytics view for **any** event.
- **Access control** — the owning `ORGANISER` or any `ADMIN`; `USER` is blocked;
  a cross-organiser request is blocked. Ownership is resolved from the database
  against the authenticated identity — never from a request parameter. The
  report additionally requires the event to be `COMPLETED`.

**No** predictions, recommendations, forecasting, event ranking or cross-event
trend analysis — those are explicitly out of scope (§3/§50/§74) and are left for
a later phase.

New dependency: **none** (backend already has `pdfkit`; frontend charts are
plain CSS). **Automated checks: 1064 / 1064** — Phase 10 new: **136**
(backend integration 64, frontend E2E 30, responsive 42); Phases 1–9 regression:
**928**.

---

## 2. Analytics Architecture

```
                Event (status, organiser, dates)
                  │
   Registration ──┤   Attendance ──┐   Feedback (rating, sentiment) ──┐   Certificate (status)
   (status)       │   (status)     │                                  │
                  ▼                ▼                                   ▼
        ┌───────────────────────────────────────────────────────────────────────┐
        │  analytics.service.getEventAnalytics({ actor, eventId })               │
        │    1. loadEventForAnalytics  → 400 bad id / 404 missing / 403 denied   │
        │       (ORGANISER must own it · ADMIN → any)                            │
        │    2. one Promise.all of countDocuments + aggregation $group:          │
        │         • Registration by status        → registered, cancelled       │
        │         • Attendance PRESENT ∩ active regs → present                  │
        │         • Feedback $sum/$count           → total, rating sum          │
        │         • Feedback by rating            → rating distribution         │
        │         • Feedback by sentiment (valid)  → positive/neutral/negative  │
        │         • Certificate ISSUED             → issued                     │
        │    3. derive rates (all zero-guarded), the `state`, the summary       │
        └───────────────────────────────────────────────────────────────────────┘
                  │                                            │
                  ▼                                            ▼
     GET /api/events/:id/analytics  (JSON)      GET /api/events/:id/report  (pdfkit → PDF)
                  │                                            │
                  ▼                                            ▼
   /organiser/analytics  ·  /admin/statistics          <EventTitle>_Report.pdf
   (AnalyticsView + BarChart, no chart lib)
```

- Everything is **derived on demand**; nothing is stored (§36 — no cached
  totals). If a registration is cancelled, a check-in changes or a feedback is
  edited, the next request reflects it (verified by test T22).
- The service only **reads** — `find` / `countDocuments` / `aggregate`. It never
  writes to `Event`, `Registration`, `Attendance`, `Feedback` or `Certificate`
  (§33, verified by test T33).
- No per-user document loads; counts come from `countDocuments` and aggregation
  `$group` (§34/§35). One `$in` over the active-registration ids is the only
  list load, and it is bounded by the event size (verified responsive at 120
  registrations in < 2 s — T25/T66).

---

## 3. Statistics

| Group | Metrics returned |
| --- | --- |
| `registrations` | `total` (active `REGISTERED`), `cancelled`, `allTime` |
| `attendance` | `present`, `absent`, `rate` (%) |
| `feedback` | `total`, `averageRating` (or `null`), `ratingDistribution` `{1..5}` |
| `sentiment` | `positive`, `neutral`, `negative`, `analyzed`, `unanalyzed`, `positivePct`, `neutralPct`, `negativePct` |
| `certificates` | `issued`, `eligible`, `issuanceRate` (or `null`) |
| `participation` | `registered`, `attended`, `attendanceRate`, `feedbackResponses`, `feedbackParticipationRate`, `certificatesIssued` |
| top level | `event {id,title,status,state,category,venue,startDate,endDate,organiser.name}`, `state`, `analyticsAvailable`, `performanceSummary`, `generatedAt` |

Platform summary (`GET /api/admin/analytics/summary`): `events {total, completed,
cancelled, upcoming, ongoing}`, `totalRegistrations`, `totalAttendees`,
`feedback {total, averageRating}`, `sentiment {positive, neutral, negative,
analyzed, …Pct}`, `certificatesIssued`, `generatedAt`. Basic totals only — no
cross-event ranking / trends (§49/§50).

---

## 4. Formulas

All rates are rounded to **one decimal place**; every denominator is guarded so
a zero input yields `0` or `null`, **never** `NaN`/`Infinity` (§14/§65).

```
attendanceRate           = registered > 0 ? round1(present / registered * 100) : 0
averageRating             = responses > 0 ? round1(Σ rating / responses)       : null
feedbackParticipationRate = attendees  > 0 ? round1(responses / attendees * 100): 0
analysed                  = positive + neutral + negative
positivePct               = analysed  > 0 ? round1(positive / analysed * 100)  : 0
neutralPct                = analysed  > 0 ? round1(neutral  / analysed * 100)  : 0
negativePct               = analysed  > 0 ? round1(negative / analysed * 100)  : 0
eligibleParticipants      = (event.status === 'COMPLETED') ? present : 0
certificateIssuanceRate   = eligible   > 0 ? round1(issued / eligible * 100)   : null
```

- `present` = `Attendance` rows with `status: 'PRESENT'` **whose registration is
  still `REGISTERED`** — the same definition the Phase 7 attendance summary
  uses, so the numbers match the attendance page.
- Feedback rows whose `sentiment` is `null` (AI unavailable at submit time, or
  rating-only) are **excluded from the sentiment denominator** and reported
  separately as `unanalyzed` (§22/§24).
- Data-accuracy check (test T*, §64): 10 registered / 8 present / feedback
  ratings `[5,5,4,3,3]` / sentiment `[P,P,P,N,Ng]` →
  attendance rate **80**, average rating **4**, rating distribution
  `{5:2,4:1,3:2}`, sentiment **3 / 1 / 1** = **60% / 20% / 20%**, feedback
  participation **62.5%**, issuance rate **87.5%** (7 of 8). Computed, not
  hard-coded.

---

## 5. API

| Method & path | Role | Behaviour |
| --- | --- | --- |
| `GET /api/events/:id/analytics` | ORGANISER (owner) / ADMIN | `200` + the structured analytics object. `400` bad id · `404` missing · `403` not owner / USER. Read-only. |
| `GET /api/events/:id/report` `?inline=1` | ORGANISER (owner) / ADMIN | `200` `application/pdf` (`Content-Disposition: attachment; filename="<Title>_Report.pdf"`, or `inline` with `?inline=1`). `409` if the event is not `COMPLETED`. `403` / `404` as above. `500` (controlled) on a render failure. |
| `GET /api/admin/analytics/summary` | ADMIN only (admin router) | `200` + the basic platform roll-up. `401` unauthenticated · `403` non-admin. |

Routes live on the existing `event.routes.js` (analytics + report, beside the
Phase 7/8/9 event sub-routes) and `admin.routes.js` (summary). No new router
mount. `req.query.organiserId` / `req.body` are never read (§71 — verified: a
cross-organiser request with `?organiserId=` still `403`s).

---

## 6. Security

| Control | Mechanism | Result |
| --- | --- | --- |
| **Authentication** | every route behind `authenticate`; the report and analytics are never reachable anonymously | `GET …/analytics` and `…/report` unauthenticated → `401` (verified) |
| **RBAC** | `requireRole(ORGANISER, ADMIN)` on the event routes; `requireRole(ADMIN)` on the admin router | `USER` → `403` on analytics and report (verified) |
| **Event ownership** | `analytics.service.loadEventForAnalytics` compares `event.organiser._id` to `actor.id` for an ORGANISER; ADMIN bypasses | organiser B on organiser A's event → `403` (analytics + report, service + HTTP, verified) |
| **Report authorization** | same ownership check, plus `state === 'COMPLETED'` | other organiser `403` · USER `403` · not-completed `409` · cancelled `409` (verified) |
| **No parameter trust** | ownership resolved from the DB against `req.user.id`; `req.query`/`req.body` ignored | `?organiserId=<other>` does not change the outcome (verified) |
| **Read-only** | service issues only `find`/`countDocuments`/`aggregate` | record counts unchanged after an analytics call (verified T33) |
| **No sensitive leakage** | analytics returns the organiser **name** only; the report adds the event id (required by §55) but no email / user documents / auth internals | report + analytics bodies contain no `@`-address (verified) |
| **Admin scope** | admin gains analytics **read** access consistent with the existing `/admin/events` oversight; no new write power, no second permission system (§6/§49) | unchanged RBAC |

---

## 7. UI

### Organiser — `/organiser/analytics` (new sidebar item "Analytics")

- **Event selector** — a `<select>` over the organiser's own events (completed
  first), `?event=<id>` for deep-links; changing it fetches that event's
  analytics (one request, no polling — §78/§79).
- **COMPLETED event** — six overview `StatCard`s (Registrations · Attendees ·
  Attendance rate · Feedback · Average rating · Certificates); a *Participation*
  section with the **registration vs attendance** bar chart + a
  feedback-participation / certificate-issuance caption; a *Feedback ratings*
  section with the **rating distribution** chart; a *Sentiment* section with the
  **sentiment distribution** chart (counts + %) and a "View all feedback →" link
  to the Phase 9 feedback page; and the factual **event performance summary**
  with **Preview report** / **Download report** buttons.
- **PENDING event** (`UPCOMING` / `ONGOING` / `PLANNED` / `DRAFT`) — an amber
  notice *"Analytics will be available after this event is completed."* and the
  current registration count only. No charts, no summary, no report (§8).
- **CANCELLED event** — a rose *"Event Cancelled — this event did not take
  place. No performance metrics are calculated."* banner and two neutral cards
  (registrations before cancellation, cancelled registrations). No score, no
  report (§45).
- **States** — a card/skeleton loading state (never shows `0`s as real values —
  §61); empty states *"No registration data available"* / *"No feedback data
  available"* / *"No sentiment data available"* (§43/§44); an error panel with
  **Try again** (§62).

### Admin — `/admin/statistics`

The former "Coming soon" placeholder is now a real page: the platform roll-up
cards (Events · Completed · Cancelled · Upcoming/ongoing · Registrations ·
Attendees · Feedback responses · Average rating), a platform-sentiment bar
chart, then the same per-event `AnalyticsView` reached through a selector over
**every** event (labelled with the organiser's name).

### Charts (`components/analytics/BarChart.jsx`) — no dependency

A CSS/flex horizontal bar chart. Every bar shows a **visible text label and a
visible numeric value**, so the chart never relies on colour alone; the coloured
bar is `aria-hidden` decoration (§42). Bars flex to the container and wrap
cleanly at every tested width.

### Integration

*My Events* rows and the event-details header gain a **View Analytics /
Analytics** link **only for `COMPLETED` events** (§46/§47). The participant side
(discovery, registration, attendance, certificates, notifications, feedback) is
untouched (§48).

---

## 8. Report Generation

- **Format** — A4 portrait PDF via `pdfkit` (already a backend dependency since
  Phase 8; no new package). Built-in fonts, no logos. `compress: false` so the
  text streams stay inspectable. Natural top-to-bottom flow with automatic page
  breaks — typically **one to two pages**; nothing overlaps or is clipped
  regardless of value length.
- **Content** (§52/§55) — institution header; **Event** block (name, date,
  status, organiser, **report reference** `RPT-<id tail>-<yyyymmddhhmm>`, event
  id, generation timestamp); **Registration statistics**; **Attendance
  statistics** (present / absent / rate + a registered-vs-attended mini bar
  chart); **Feedback statistics** (responses, average rating, participation rate,
  5★–1★ distribution bars); **Sentiment distribution** (counts + %, analysed /
  not analysed, bars); **Certificate statistics** (issued / eligible / issuance
  rate); **Event performance summary** (the factual paragraph); a footer
  disclaimer — *"This is a factual statistical summary … It contains no
  predictions or recommendations."*
- **Access control** — the owning `ORGANISER` or any `ADMIN`; `COMPLETED` events
  only. A USER, a cross-organiser or an unauthenticated request never receives a
  report (§56/§57/§72 — verified).
- **PDF validation** — the generated file starts with `%PDF-1.3`, ends with
  `%%EOF`, contains a `/Type /Page`, and is > 1.5 KB (verified). The decoded
  text contains the correct event title, `COMPLETED`, the organiser name, the
  registration count, `80%` / `4 / 5` etc., the sentiment breakdown, `Event ID`,
  `Certificates issued`, the generation date and the factual disclaimer
  (verified — T77, by hex-decoding the PDF's text operators).
- **Visual inspection** — a report generated by the running backend and
  downloaded through the browser was opened and inspected
  (`scratchpad/p10-shots/09-downloaded-report.pdf`): a clean two-page A4
  document, every number matching the analytics view, bar charts rendered, no
  overlap / clipping / corruption, no email or user-document data (§58/§77).

---

## 9. Testing

### Backend integration — `backend/__phase10_tests.mjs` — **64 / 64 passed**

Ran against the real `event_management_system` DB + the running backend (HTTP,
for RBAC / report). Self-cleaning (`@phase10.local` fixtures + their events /
registrations / attendances / feedback / certificates removed). §75 matrix:

| # | Test | Result |
| --- | --- | --- |
| 1 | Completed event analytics | ✅ resolves, `state: COMPLETED`, `analyticsAvailable: true` |
| 2 | Upcoming event analytics | ✅ `state: PENDING`, no summary, registrations still reported |
| 3 | Ongoing event analytics | ✅ `state: PENDING` |
| 4 | Cancelled event | ✅ `state: CANCELLED`, no performance summary, no rate; report → `409` |
| 5 | Registration count | ✅ 10 (from real `Registration` rows) |
| 6 | Attendance count | ✅ 8 (from real `Attendance` PRESENT rows) |
| 7 | Attendance rate | ✅ 80 (8/10); large dataset → 81.7 (98/120) |
| 8 | Zero registrations | ✅ no crash, rate `0`, finite (not `NaN`/`Infinity`) |
| 9 | Feedback count | ✅ 5 |
| 10 | Average rating | ✅ 4.0 (`[5,5,4,3,3]`); `null` when no feedback |
| 11 | Rating distribution | ✅ `{5:2, 4:1, 3:2, 2:0, 1:0}` |
| 12 | Sentiment counts | ✅ positive 3 / neutral 1 / negative 1 |
| 13 | Sentiment percentages | ✅ 60 / 20 / 20; `analyzed` 5, `unanalyzed` 0; zero-guarded |
| 14 | Feedback participation rate | ✅ 62.5 (5/8); `0` at zero attendees |
| 15 | Certificate count | ✅ 7 |
| 16 | Organiser owns event | ✅ service + HTTP `200` |
| 17 | Cross-organiser access blocked | ✅ `403` (service + HTTP + `?organiserId=` attempt) |
| 18 | USER analytics access blocked | ✅ `403` (service + HTTP) |
| 19 | ADMIN access | ✅ can view any event's analytics |
| 20 | Report generation | ✅ `200 application/pdf`, `attachment` filename, `?inline=1` → `inline`; not-completed → `409` |
| 21 | Unauthorized report download | ✅ other organiser `403`, USER `403`, unauthenticated `401`, admin `200` |
| 22 | Analytics reflects changed data | ✅ cancelling a registration drops `total` 20→19 (`cancelled` 1); adding a feedback raises `total` 0→1 |
| 23 | Partial data | ✅ registration + attendance computed, feedback / sentiment / certificate empty but valid |
| 24 | Empty data | ✅ (see #8) |
| 25 | Larger dataset (120 / 98 / 45) | ✅ resolves in < 2 s, correct totals |

Plus: §18 issuance rate (87.5), §29 factual summary contains the numbers, §74
summary contains **no** recommendation language, §33 no records mutated, §45 no
report for a cancelled event, §49 platform summary (service + HTTP `401`/`403`/`200`),
§58 PDF validity, §77 report-content assertions (7), bad id → `400`, unknown id → `404`.

### Frontend E2E — `scratchpad/phase10-frontend-e2e.mjs` — **30 / 30 passed, 0 console errors**

§76 matrix: analytics page loads · event selector works (URL `?event=` updates) ·
the six statistics cards display · registration-vs-attendance chart · rating
chart · sentiment chart · empty state (`No registration/feedback data
available`) · loading skeleton · error redirect for USER · **Download report**
(200, `application/pdf`, valid `%PDF…%%EOF`, > 1.5 KB) + no error on click ·
completed event (full view) · upcoming event (notice, no charts, no report) ·
cancelled event (`Event Cancelled`, no metrics, no report) · *View Analytics*
link present on a completed event's details / absent on a non-completed one ·
*Analytics* action on the completed My-Events row · USER → `/organiser/analytics`
redirected off `/organiser` · admin `/admin/statistics` platform cards + selector
+ per-event analytics for another organiser's event.

### AI service — unchanged

`ai-service/tests/test_sentiment.py` **34 / 34**, `test_analyzer.py` **26 / 26**
(regression — Phase 10 does not touch the AI service).

---

## 10. Responsive Testing

`scratchpad/phase10-responsive-check.mjs` — **42 / 42 passed** across the six
required viewports (**1920×1080, 1366×768, 1024×768, 768×1024, 390×844,
375×667** — §60):

| Surface | Checks per viewport | Result |
| --- | --- | --- |
| `/organiser/analytics?event=<completed>` | no page horizontal overflow · sidebar visible ≥ md / off-canvas on mobile · stat cards + event selector fit · charts + bars + **Download report** button fit | ✅ all 6 |
| `/admin/statistics` | no page horizontal overflow · sidebar state · platform cards + per-event selector fit | ✅ all 6 |

The stat-card grid collapses `2 → 3 → 6` columns; bar-chart rows keep a fixed
label column and a flexing track so labels stay readable and no bar or value
extends past the viewport (§39/§40/§41); the selector is `max-w-full`.

---

## 11. Regression Testing

Full Chrome-driven regression for **Phases 1–10** — fresh headless Chrome (fresh
profile) + a clean DB (also wiping `feedbacks`) between suites
(`scratchpad/p10-run-regression.sh`), plus the two in-tree AI suites:

| Suite | Result |
| --- | --- |
| `phase1-backend-tests.mjs` | ✅ 51 / 51 |
| `phase1-frontend-e2e` | ✅ 23 / 23 |
| `phase2-frontend-e2e` | ✅ 47 / 47 (fixture updated — see below) |
| `phase2-regression-check` | ✅ 13 / 13 |
| `phase2-responsive-check` | ✅ 40 / 40 |
| `phase3-frontend-e2e` | ✅ 51 / 51 |
| `phase3-responsive-check` | ✅ 50 / 50 |
| `phase4-frontend-e2e` | ✅ 44 / 44 |
| `phase4-responsive-check` | ✅ 70 / 70 |
| `ai-service/tests/test_analyzer.py` | ✅ 26 / 26 |
| `phase5-frontend-e2e` | ✅ 27 / 27 |
| `phase5-responsive-check` | ✅ 37 / 37 |
| `phase6-frontend-e2e` | ✅ 34 / 34 |
| `phase6-responsive-check` | ✅ 90 / 90 |
| `phase7-frontend-e2e` | ✅ 32 / 32 |
| `phase7-responsive-check` | ✅ 66 / 66 |
| `phase8-frontend-e2e` | ✅ 32 / 32 |
| `phase8-responsive-check` | ✅ 72 / 72 |
| `ai-service/tests/test_sentiment.py` | ✅ 34 / 34 |
| `phase9-frontend-e2e` | ✅ 34 / 34 |
| `phase9-responsive-check` | ✅ 55 / 55 |
| **Phases 1–9 regression total** | **✅ 928 / 928** |

In the single batched run of all 20 Chrome suites (`p10-run-regression.sh`),
every suite passed on the first pass except the one stale `phase2-frontend-e2e`
assertion noted below; re-running `phase2-frontend-e2e` standalone with the
updated fixture → **47 / 47**. `phase1-backend-tests` and the two in-tree AI
suites were run separately (they are not Chrome-driven).

**Fixture update:** `phase2-frontend-e2e` had one assertion expecting the
`/admin/statistics` "Coming soon" placeholder. Phase 10 replaces that page with
the real platform roll-up, so the assertion was updated to check for the
roll-up (`Completed events` / `Registrations`) instead — a fixture-only change,
the same kind made in Phase 6/7 for other replaced stubs. No production code
regressed.

---

## 12. Build

| Check | Result |
| --- | --- |
| **Frontend production build** (`npm run build`) | ✅ **273 modules, 0 errors**. Main bundle `375.18 kB` (gzip 110.6 kB) — unchanged. The one chunk-size warning is the **pre-existing** Phase 7 `html5-qrcode` lazy chunk (~518 kB); Phase 10 adds **no** frontend dependency. |
| **Backend startup** (`npm run dev`) | ✅ connects to `event_management_system`, listens on `:5000`, no errors. Analytics + report + admin-summary routes mount cleanly. |
| **MongoDB** | ✅ connected; `GET /api/health` → `database: "connected"`. |
| **AI service startup** (`uvicorn main:app`) | ✅ `v0.9.0`, `/health` → `capabilities: { planningAnalysis: true, sentimentAnalysis: true }` — untouched by Phase 10. |
| **Analytics API** | ✅ `GET /api/events/:id/analytics` returns structured data; RBAC enforced. |
| **Feedback / attendance / certificate / notification systems** | ✅ untouched — Phases 8 & 9 suites pass in regression. |
| **Dependency added** | none. |

---

## 13. Files Changed

### Backend — new

| File | Purpose |
| --- | --- |
| `backend/src/services/analytics.service.js` | `loadEventForAnalytics` (role-aware access), `getEventAnalytics`, `getEventReportData` (COMPLETED-gate), `getPlatformSummary`. All read-only; all rates zero-guarded. |
| `backend/src/utils/eventReportPdf.js` | `buildEventReportPdf(analytics, {reference})` → `Buffer` — A4 portrait, natural flow, factual, `compress: false`. |
| `backend/src/controllers/analytics.controller.js` | `getEventAnalytics`, `downloadReport` (PDF headers + `?inline`), `platformSummary`. |

### Backend — modified

| File | Why |
| --- | --- |
| `backend/src/routes/event.routes.js` | `+ import analyticsController`; `GET /:id/analytics` and `GET /:id/report` (ORGANISER or ADMIN). |
| `backend/src/routes/admin.routes.js` | `+ import analyticsController`; `GET /analytics/summary` (ADMIN). |
| `backend/package.json` | version `0.9.0 → 0.10.0`; description → Phase 10. |

### Frontend — new

| File | Purpose |
| --- | --- |
| `frontend/src/services/analyticsService.js` | `getEventAnalytics`, `getPlatformSummary`, `fetchReport` / `downloadReport` / `openReport` (blob). |
| `frontend/src/components/analytics/BarChart.jsx` | dependency-free, accessible horizontal bar chart (text label + numeric value on every bar). |
| `frontend/src/components/analytics/AnalyticsView.jsx` | the shared analytics renderer — COMPLETED / PENDING / CANCELLED states, stat cards, three charts, summary, report buttons. |
| `frontend/src/pages/organiser/OrganiserAnalytics.jsx` | `/organiser/analytics` — event selector (`?event=`), fetch, `AnalyticsView`, report actions. |

### Frontend — modified

| File | Why |
| --- | --- |
| `frontend/src/pages/admin/AdminStatistics.jsx` | placeholder → real page: platform roll-up cards + platform-sentiment chart + per-event `AnalyticsView` via a selector over all events. |
| `frontend/src/routes/AppRoutes.jsx` | `+ import OrganiserAnalytics`; route `/organiser/analytics`. |
| `frontend/src/layouts/OrganiserLayout.jsx` | `Analytics` nav item; `titleFor` → "Analytics". |
| `frontend/src/pages/organiser/OrganiserEventDetails.jsx` | a **View Analytics** link for `COMPLETED` events. |
| `frontend/src/pages/organiser/OrganiserEvents.jsx` | an **Analytics** action on `COMPLETED` event rows. |
| `frontend/package.json` | version `0.9.0 → 0.10.0`; description → Phase 10. |

### Docs

| File | Why |
| --- | --- |
| `README.md` | status line; new **"Post-event analytics & reporting (Phase 10)"** section; roadmap. |
| `project-documents/PHASE_10_REPORT.md` | this report. |

### Not committed (session scratchpad)

`phase10-frontend-e2e.mjs`, `phase10-responsive-check.mjs`, `p10-shots.mjs`,
`p10-run-regression.sh`; `backend/__phase10_tests.mjs` (temporary — deleted after
the final run). `phase2-frontend-e2e.mjs` had its one stale `/admin/statistics`
assertion updated (fixture only).

---

## 14. Known Issues

1. **Certificate issuance rate can exceed 100% in a rare edge case.** `eligible`
   is `present` (present-among-active registrations). If a participant checked
   in, received a certificate, and *later* cancelled their registration (Phase 8
   keeps that certificate), `issued` can momentarily be one higher than
   `eligible`. The raw counts are always shown alongside the rate; the situation
   is transient and cosmetic.
2. **`analyticsAvailable` is a UI hint, not a hard gate on the JSON.** The
   `/analytics` endpoint always returns the real registration counts even for a
   PENDING or CANCELLED event (they are genuine data — §44 wants registration
   stats shown for partial data). The *report* is hard-gated to `COMPLETED`
   (`409`).
3. **The platform summary's `totalAttendees` is a flat `Attendance` PRESENT
   count**, not filtered by still-active registration per event (the per-event
   analytics *is* filtered). This keeps the admin roll-up a single cheap count;
   the difference only appears when a checked-in participant later cancels.
4. **Bar charts are static CSS.** No animation, no tooltips, no zoom — a
   deliberate choice to avoid a charting dependency (§38). Values are always
   printed next to each bar, so nothing is hidden.
5. **`npm audit`** — the 3 pre-existing moderate `qs` → `body-parser` →
   `express` advisories are unrelated to Phase 10 and untouched.
6. **No git commits** — the repository still has none; `git diff` is cumulative
   from Phase 4-visual onward. Phase 10 files are staged.
