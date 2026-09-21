# PHASE 9 IMPLEMENTATION REPORT

**Feedback Collection & AI Sentiment Analysis**

AI-Powered Event Management System with QR-Based Attendance —
Sreyas Institute of Engineering and Technology, Dept. of CSE (AI & ML).

---

## 1. Summary

Phase 9 adds the post-event feedback loop the abstract calls for
("feedback analysis", "sentiment analysis performed on participant feedback to
identify satisfaction levels and highlight areas requiring improvement"):

- **Participant feedback** — a 1–5 star rating (1 = Very Poor … 5 = Excellent)
  plus an optional comment (5–1000 chars when supplied). Available **only** to a
  participant who **registered**, was marked **PRESENT** at QR check-in, and
  whose event is **COMPLETED**. One feedback per participant per event, enforced
  by a unique database index. Participants may edit their own feedback.
- **AI sentiment analysis** — every comment is classified
  **POSITIVE / NEUTRAL / NEGATIVE** with a model confidence score by a new
  endpoint on the existing FastAPI AI service (`POST /sentiment/analyze`). The
  engine is **VADER** — a published, offline, lexicon-and-rule sentiment model,
  loaded once at service start. Editing a comment re-runs the analysis.
- **Organiser feedback view** — `/organiser/events/:id/feedback` shows every
  response for an event the organiser owns, with participant name, rating,
  comment, sentiment badge, and a **basic** summary (responses, positive /
  neutral / negative counts, average rating). This is not the analytics
  dashboard planned for a later phase.
- **Notification** — `FEEDBACK_AVAILABLE` is created (reusing the Phase 8
  `Notification` model) when an event becomes `COMPLETED`, for each participant
  who attended.

New dependency: **`vaderSentiment`** in the AI service only (a ~125 KB pure-Python
wheel; pulls `requests` transitively). No transformer, no `torch`, no model
download. The backend and frontend gain **no** new dependency.

**Automated checks: 980 / 980** — Phase 9 new: **175** (AI `test_sentiment.py`
34, backend integration `__phase9_tests.mjs` 52, frontend E2E 34, responsive 55);
Phases 1–8 regression: **805**.

Nothing in Authentication, RBAC, Event management, Pre-event planning, the AI
Planning Assistant, Registration, QR attendance or Certificates was changed
beyond additive wiring (feedback routes on the event router; a
`FEEDBACK_AVAILABLE` side effect on the COMPLETED transition).

---

## 2. Feedback Workflow

```
USER
 │  registers for an event (Phase 6)
 ▼
Attends the event → organiser scans QR → Attendance { status: PRESENT }  (Phase 7)
 ▼
Organiser (or admin) sets the event status to COMPLETED
 │        └─► FEEDBACK_AVAILABLE notification to every REGISTERED + PRESENT participant
 ▼
USER opens /user/feedback  (or the notification / a My Events shortcut)
 ▼
Feedback form  ── rating 1–5  +  optional comment
 ▼
POST /api/events/:id/feedback
 │   backend re-checks: event COMPLETED · registration REGISTERED · attendance PRESENT · no existing feedback
 │   backend validates: rating is an integer 1–5 · comment trimmed, 5–1000 chars if present
 ▼
AI sentiment analysis  ──►  POST http://127.0.0.1:8000/sentiment/analyze  { text }
 │                          ◄──  { sentiment, score, compound, breakdown, method, model }
 │   (runs BEFORE save; if the AI service is down → sentimentStatus: FAILED, feedback still saved)
 ▼
Feedback stored  { rating, comment, sentiment, sentimentScore, sentimentStatus, … }
 ▼
ORGANISER opens /organiser/events/:id/feedback
 ▼
Sees ratings · comments · sentiment badges · basic summary (avg rating, +/0/- counts)

Edit path:  USER edits feedback → PATCH /api/events/:id/feedback/:feedbackId
            → if the comment changed, sentiment is recomputed for the new text
            → a rating-only edit leaves the sentiment untouched
```

---

## 3. Feedback Architecture

### Model — `backend/src/models/feedback.model.js`

| Field | Type | Notes |
| --- | --- | --- |
| `event` | ObjectId → Event | required, indexed |
| `user` | ObjectId → User | required |
| `registration` | ObjectId → Registration | required — the Phase 6 record |
| `attendance` | ObjectId → Attendance | required — the Phase 7 PRESENT record |
| `rating` | Number | required, integer, `min 1`, `max 5` |
| `comment` | String | trimmed, `maxlength 1000`, default `''` |
| `sentiment` | String enum | `POSITIVE` \| `NEUTRAL` \| `NEGATIVE` \| `null` |
| `sentimentScore` | Number | `0–1` model confidence, or `null` |
| `sentimentStatus` | String enum | `PENDING` \| `ANALYZED` \| `FAILED` \| `SKIPPED` |
| `sentimentModel` | String | e.g. `vader-3.3.2+event-lexicon-v1` |
| `sentimentAnalyzedAt` | Date | set only on `ANALYZED` |
| `createdAt` / `updatedAt` | Date | Mongoose timestamps (`submittedAt` in API views = `createdAt`) |

The feedback references the **actual** `Registration` and `Attendance` records
it was created against — the link to real participation is explicit, not implied
(§4, §51).

### Relationships

`User 1─* Feedback *─1 Event` · `Feedback 1─1 Registration` · `Feedback 1─1
Attendance`. Reuses the existing Phase 3/6/7 models — no duplicate `User` /
`Event` / `Registration` / `Attendance`.

### Eligibility (`feedback.service.js :: resolveEligibility`)

All of these must hold, checked in order, each with its own message:

1. event exists, not soft-deleted, not `DRAFT` → else `404`;
2. `event.status === 'COMPLETED'` (`CANCELLED` → "was cancelled";
   `UPCOMING`/`ONGOING`/`PLANNED` → "opens once the event is completed") → else `403`;
3. a `Registration` exists for `(user, event)` → else `403`;
4. `registration.status === 'REGISTERED'` (a later cancellation makes the
   participant ineligible for **new** feedback) → else `403`;
5. an `Attendance` for that registration exists with `status === 'PRESENT'` → else `403`.

### Validation

- **Rating** — coerced from string, then `Number.isInteger` **and** `1 ≤ n ≤ 5`.
  `0`, `6`, `-1`, `3.5`, `"abc"`, `null` → `400`. Enforced in the service and
  again by the schema (`min`/`max`/integer validator).
- **Comment** — must be a string; trimmed; **empty is allowed** (rating-only
  feedback); when non-empty it must be `5–1000` characters. `> 1000` → `400`;
  `1–4` chars → `400` ("…at least 5 characters, or left empty").
- Non-string / object `comment` or `rating` → `400`, never stored.

### Ownership

- `getMyFeedbackForEvent` and `submitFeedback` are keyed by the **authenticated**
  `req.user.id` — a body/param user id is never read.
- `updateFeedback` loads the feedback by id and rejects unless
  `String(feedback.user) === req.user.id` (`403`), and unless the feedback
  belongs to the `:id` event (`400`).
- The organiser list calls `loadOwnedEvent(eventId, organiserId)` — `400` bad id
  / `404` missing / `403` not owner — the same guard used everywhere else.

### Duplicate prevention

Unique compound index `{ user: 1, event: 1 }`. A second `submitFeedback`
resolves to `409` both from an explicit pre-check and from catching `E11000`.

---

## 4. AI Sentiment Architecture

### Service & endpoint

`ai-service` (FastAPI, already present). New route
`POST /sentiment/analyze` (`ai-service/routes/sentiment.py`), new engine
`ai-service/services/sentiment.py`. `main.py` version → `0.9.0`.

Request:

```json
{ "text": "The sessions were genuinely useful and well paced." }
```

Response:

```json
{
  "sentiment": "POSITIVE",
  "score": 0.6249,
  "compound": 0.6249,
  "breakdown": { "positive": 0.31, "neutral": 0.69, "negative": 0.0 },
  "method": "vader",
  "model": "vader-3.3.2+event-lexicon-v1"
}
```

### Model used

**VADER** — *Valence Aware Dictionary and sEntiment Reasoner*, Hutto & Gilbert
(2014), via the `vaderSentiment` package. It is a **published, validated**
lexicon-and-rule model (it handles negation, intensifiers, contrastive "but",
punctuation and capitalisation emphasis) — deliberately **not** a bare keyword
count, and **not** a fabricated label (§22, §29). Chosen over a transformer
because:

- it runs **fully offline** — the lexicon ships with the package (no model
  download, no API key, no network at inference time);
- it is tiny — a ~125 KB pure-Python wheel, no `torch` / `transformers`
  (§24 "do not unnecessarily add a large dependency");
- it is **deterministic** (reproducible for a demo) and fast enough to call per
  request.

A small **event-feedback lexicon extension** (`_DOMAIN_LEXICON`, ~30 terms:
`informative`, `engaging`, `insightful`, `disorganised`, `overcrowded`,
`late`, `rushed`, …) is merged on top so terms the stock lexicon scores weakly
are read the way an organiser would. The `SentimentIntensityAnalyzer` is
constructed **once at import** (`_ANALYZER`) and reused for every request
(§63) — verified by test.

### Sentiment categories

`POSITIVE`, `NEUTRAL`, `NEGATIVE` only (§22). Classification bands on VADER's
`compound` score:

| compound | class |
| --- | --- |
| `≥ 0.35` | POSITIVE |
| `≤ -0.35` | NEGATIVE |
| between | NEUTRAL |

The neutral band is widened from VADER's stock `±0.05` so lukewarm feedback
("it was okay, nothing special") stays NEUTRAL instead of being over-reported.

### Confidence score

`score = round(abs(compound), 4)` — the strength of the sentiment signal, `0`
(no signal) … `1` (maximal). It is the model's own score and is **documented as
a model confidence, not a calibrated probability** (§27). Stored on the feedback
as `sentimentScore` (also `min 0, max 1` on the schema).

### Failure handling (§28, §65)

Sentiment is analysed **synchronously, before the feedback is persisted** — the
simplest robust design (no background jobs, no lingering `PENDING` rows, the
stored sentiment always matches the stored comment — §50).

`backend/src/services/sentiment.service.js :: analyzeComment` **never throws**:

| situation | result |
| --- | --- |
| empty / whitespace comment | `{ status: 'SKIPPED', sentiment: null }` — no call made |
| AI service refused / timed out / non-JSON / unexpected shape | `{ status: 'FAILED', sentiment: null }`, logged |
| success | `{ status: 'ANALYZED', sentiment, score, compound, model }` |

`submitFeedback` stores whatever comes back and **always saves the feedback**.
A `FAILED` row shows "Analysis unavailable" in the organiser view; the feedback
(rating + comment) is intact. No sentiment is ever fabricated (§29).

### Re-analysis on edit (§31, §50)

`updateFeedback` re-runs `analyzeComment` **only when the trimmed comment
actually changed**. Clearing the comment → `SKIPPED` + `sentiment: null`. A
rating-only edit leaves `sentiment` / `sentimentScore` / `sentimentAnalyzedAt`
untouched (verified).

### AI service health

`GET /health` now reports
`"capabilities": { "planningAnalysis": true, "sentimentAnalysis": <self-check> }`.
The self-check classifies one known-positive string; if the model ever failed to
load it would report `false` without taking the service — or the Planning
Assistant — down (§64).

---

## 5. Notification Integration

- **Type:** `FEEDBACK_AVAILABLE` — added to `NOTIFICATION_TYPES` **and**
  `ONCE_PER_EVENT_TYPES` in the existing `backend/src/models/notification.model.js`.
  No new notification model or system (§45).
- **When:** in `event.service.js`, when `updateEventStatusByOwner` **or**
  `updateEventStatusByAdmin` transitions an event **into** `COMPLETED`
  (`previousStatus !== COMPLETED`). Never on `UPCOMING` / `ONGOING`, never for
  `CANCELLED` (§44, §52).
- **Recipients:** `notifyFeedbackAvailable` sends only to users who have a
  `REGISTERED` registration **and** a `PRESENT` attendance for that event
  (§42) — a registered-but-absent participant gets nothing.
- **Message:** *"Feedback is now open for "<Event Title>"."*
- **De-duplication (§43):** both a **safe existence check**
  (`Notification.find({ event, type: 'FEEDBACK_AVAILABLE' })` → skip recipients
  already notified) **and** the partial unique index
  `{ recipient, event, type }`. Re-completing an event (COMPLETED → ONGOING →
  COMPLETED) produces **no** second notification (verified).
- **Side-effect discipline:** the call site is
  `notifyFeedbackAvailable(...).catch(() => {})` and the function swallows and
  logs its own errors — a notification failure never blocks the status change.
- **UI:** the participant notification centre renders a `Feedback` type chip and
  a **"Give feedback"** link to `/user/feedback` for `FEEDBACK_AVAILABLE`.

---

## 6. API

All endpoints authenticate via the existing HTTP-only cookie and enforce role +
ownership + eligibility in the service; none trusts `req.body.userId` /
`organiserId` (§46).

### Feedback (mounted on the event router — `backend/src/routes/event.routes.js`)

| Method & path | Role | Behaviour |
| --- | --- | --- |
| `GET /api/events/:id/feedback/mine` | USER | `{ event, eligible, reason, feedback }` — eligibility + the caller's feedback (or `null`). Drives the form. |
| `POST /api/events/:id/feedback` | USER (eligible) | Body `{ rating, comment? }`. `201` + `{ feedback, event }` and message *"Feedback submitted successfully."* Re-checks eligibility (`403`), duplicate (`409`), validation (`400`). Runs sentiment analysis before saving. |
| `PATCH /api/events/:id/feedback/:feedbackId` | USER (owner) | Body `{ rating?, comment? }`. `200` + `{ feedback }`. Ownership (`403`), event match (`400`), validation (`400`). Re-runs sentiment iff the comment changed. |
| `GET /api/events/:id/feedback` | ORGANISER (owns event) | `{ event, summary, feedback[] }`. `loadOwnedEvent` → `400`/`404`/`403`. |

### Sentiment (AI service — `ai-service/routes/sentiment.py`)

| Method & path | Behaviour |
| --- | --- |
| `POST /sentiment/analyze` | Body `{ text }`. `200` + `{ sentiment, score, compound, breakdown, method, model }`. Empty-after-trim / `> 5000` chars / non-string / missing `text` / non-JSON → `422` with a plain message (no internals). Consumed by the backend only. |
| `GET /health` | Now includes `capabilities.sentimentAnalysis`. |

No existing endpoint changed shape. `GET /registrations/mine` is unchanged
(the feedback hub derives eligible events from its existing `event.status` +
`attendance.status` fields).

---

## 7. Security

| Control | How | Result |
| --- | --- | --- |
| **Authentication** | every feedback route is behind `authenticate`; the AI service is server-to-server only | unauthenticated `GET`/`POST` feedback → `401` (verified) |
| **RBAC** | `requireRole(USER)` on submit/edit/mine; `requireRole(ORGANISER)` on the list | ORGANISER → `/feedback/mine` `403`; USER → `/feedback` (list) `403` (verified) |
| **Feedback ownership** | `updateFeedback` compares `feedback.user` to the authenticated id; `getMyFeedbackForEvent` is keyed by the authenticated id | user B cannot read or edit user A's feedback (`403` / `null`) (verified) |
| **Event ownership** | organiser list uses `loadOwnedEvent` | organiser B reading organiser A's event feedback → `403` (verified) |
| **Eligibility** | registered + PRESENT + COMPLETED, re-checked server-side on every submit | non-attendee / unregistered / pre-completion / cancelled-event / cancelled-registration → `403` (verified) |
| **Input validation** | integer-1..5 rating; trimmed 5–1000 comment; type checks | `0`/`6`/`-1`/`3.5`/`"abc"`/`null` rating → `400`; `> 1000` comment → `400` (verified) |
| **Content safety (XSS)** | comments are stored **verbatim** as a string and rendered by React as escaped text (`{f.comment}` in JSX, `whitespace-pre-wrap`) — no `dangerouslySetInnerHTML` anywhere | a `<script>` / `<img onerror>` comment is shown as literal text and does not execute (verified in-browser: `window.__xss` stays undefined) |
| **No secret leakage** | AI service receives only the comment text; organiser view returns participant **name** only | no email / userId / password / token / planning data in any feedback response (verified — response body contains no `@…` address) |
| **Admin** | no feedback route grants ADMIN access; admin gains no new read/write power over feedback | unchanged RBAC |
| **AI isolation** | `analyzeComment` catches every failure mode and returns `FAILED`; a dead AI service does not 500 the submit, and cannot crash the backend / registration / attendance / certificates | verified (submit with AI down still `201`, `sentimentStatus: FAILED`) |

---

## 8. UI

### Participant

- **`/user/feedback`** (sidebar item **Feedback**) — a hub listing every event
  the participant attended (`COMPLETED` + attendance `PRESENT`). Each row shows
  the event, and either the submitted rating + sentiment badge + "View / edit",
  or "Not submitted yet" + "Give feedback". Empty state: *"No events are
  currently available for feedback."* (§36).
- **`/user/feedback/:eventId`** —
  - **eligible, no feedback yet:** the form — a 1–5 `StarRating` (accessible
    `radiogroup`, arrow-key + click, live label "Very Poor … Excellent"), an
    optional comment `textarea` with a `n/1000` counter, **Submit feedback**.
    Client-side guards: rating required; a 1–4-char comment is rejected before
    the request.
  - **after submit:** *"Feedback submitted successfully."* plus the analysed
    **sentiment badge** (e.g. *Positive · 91%*), then the feedback read-only
    (Your rating / Your comment / AI sentiment) with an **Edit feedback** action
    (§34).
  - **editing:** the same form pre-filled, **Save changes** / **Cancel**.
  - **not eligible:** an amber panel with the reason and **no rating control**
    (the form is withheld — §33).
- **`/user/my-events`** — a completed + present row gains a **Feedback** link to
  `/user/feedback/:eventId` (next to the Phase 8 Certificate link).
- **`/user/notifications`** — a `FEEDBACK_AVAILABLE` item shows a `Feedback` chip
  and a **"Give feedback"** link.

### Organiser

- **`/organiser/events/:id/feedback`** (linked from event details, between
  *Certificates* and *Edit*; sidebar/header title "Feedback"):
  - summary cards — **Responses**, **Positive**, **Neutral**, **Negative**,
    **Avg rating** (`x / 5`) (§40) — reusing the existing `StatCard`;
  - an amber note if any comment could not be analysed;
  - one card per response: participant **name**, `StarRating` (read-only),
    the comment (as escaped text, `whitespace-pre-wrap`), a `SentimentBadge`
    (Positive / Neutral / Negative + confidence %, or "Analysis unavailable" /
    "No comment"), and the submitted date (`· edited` when edited);
  - empty state distinguishing "not completed yet" from "no feedback yet".
  - **No** time-series, comparison, correlation or recommendation UI (§41).

Screenshots captured and visually inspected (`scratchpad/p9-shots/`, 1440×900 +
390×844): feedback form (filled), feedback submitted (positive badge), feedback
hub (submitted), organiser feedback (positive), feedback edited → negative,
organiser feedback (negative), all mobile variants. Layout, spacing, colour and
typography match the existing design system.

---

## 9. AI Testing

Actual outputs from the **running** AI service (`POST /sentiment/analyze`) — not
fabricated (§29, §57):

| Input text | sentiment | score | compound |
| --- | --- | --- | --- |
| `Excellent event. The sessions were very informative.` | **POSITIVE** | 0.7902 | +0.7902 |
| `The event was okay, but nothing special.` | **NEUTRAL** | 0.3479 | −0.3479 |
| `The event was poorly organized and the sessions started very late.` | **NEGATIVE** | 0.6901 | −0.6901 |
| `Absolutely loved it - best organised workshop I have attended, learned so much!` | **POSITIVE** | 0.8653 | +0.8653 |
| `It ran as scheduled and covered the listed topics.` | **NEUTRAL** | 0.0 | 0.0 |
| `Waste of time. Disorganised, overcrowded and the speaker was boring.` | **NEGATIVE** | 0.8934 | −0.8934 |

The three worked examples from the Phase 9 brief (§23) classify exactly as
stated (POSITIVE / NEUTRAL / NEGATIVE) — and the examples were **not** hard-coded
into the classifier.

Invalid input (actual HTTP status observed):

| Input | Status |
| --- | --- |
| `{ "text": "   " }` (whitespace only) | `422` |
| `{ "text": "" }` | `422` |
| `{}` (missing `text`) | `422` |
| `{ "text": "xxxx… (6000 chars)" }` | `422` |
| `{ "text": 123 }` (not a string) | `422` |
| `not json` | `422` |
| AI service unreachable | backend `analyzeComment` → `{ status: 'FAILED' }`, **no throw** |

**`ai-service/tests/test_sentiment.py`** (in-tree, run against the real engine) —
**34 / 34 passed**: 9 positive assertions, 3 neutral, 3 negative, shape /
breakdown-sums-to-1 / compound-range, empty (3 forms), oversized (+ message),
non-string (5 types), determinism, singleton analyser + merged domain lexicon +
`self_check`.

**`ai-service/tests/test_analyzer.py`** (Phase 5 planning analyzer, regression) —
**26 / 26 passed** — unchanged.

---

## 10. Functional Testing

**`backend/__phase9_tests.mjs`** — integration tests against the real
`event_management_system` DB + the running backend (HTTP) + the running AI
service (real sentiment). Self-cleaning (`@phase9.local` fixtures removed).

**Result: 52 / 52 passed.** Coverage of the §56 required matrix:

| # | Required test | Result |
| --- | --- | --- |
| 1 | Eligible participant submits feedback | ✅ `201`, rating stored, sentiment `POSITIVE`, status `ANALYZED`, registration + attendance refs correct |
| 2 | Non-attendee (registered, not PRESENT) submits | ✅ `403` |
| 3 | Unregistered user submits | ✅ `403` |
| 4 | Feedback before completion (`UPCOMING`) | ✅ `403` |
| 5 | Feedback for a `CANCELLED` event | ✅ `403` |
| 6 | Duplicate feedback | ✅ `409` |
| 7 | Invalid rating — `0`, `6`, `-1`, `3.5`, `"abc"`, `null` | ✅ each `400` |
| 8 | Oversized comment (`> 1000`) / too-short (`< 5`) | ✅ `400` / `400` |
| 9 | Unauthenticated feedback access (`GET` + `POST`, HTTP) | ✅ `401` / `401` |
| 10 | Cross-user access — B edits A's feedback / `getMine` leaks A's feedback | ✅ `403` / returns `null` |
| 11 | Organiser reads own event feedback (rows + summary; name, not email) | ✅ |
| 12 | Organiser reads another organiser's event feedback | ✅ `403` (service + HTTP) |
| 13 | Sentiment analysis — score in `0–1`, model recorded | ✅ |
| 14 | Negative sentiment | ✅ `NEGATIVE` |
| 15 | Neutral sentiment | ✅ `NEUTRAL` |
| 16 | Positive sentiment | ✅ `POSITIVE` |
| 17 | AI failure — `analyzeComment` returns `FAILED` (no throw); feedback still saved `FAILED`, no fabricated sentiment | ✅ |
| 18 | Feedback edit (rating + comment) by owner | ✅ |
| 19 | Sentiment recomputed after a comment edit (`POSITIVE → NEGATIVE`); a rating-only edit leaves sentiment untouched | ✅ |
| 20 | `FEEDBACK_AVAILABLE` sent to an attended participant; **not** to a registered-but-absent one | ✅ |
| 21 | Duplicate `FEEDBACK_AVAILABLE` prevented on re-completion | ✅ (existence check + partial index) |

Extra checks that also passed: attended-then-cancelled registration → `403` for
new feedback; rating-only feedback → `SKIPPED` + `sentiment: null`; blank comment
→ `SKIPPED` with no AI call; `<script>` / `<img onerror>` comment stored verbatim;
unique `{user,event}` index + `{event,createdAt}` + `{event,sentiment}` present;
HTTP route wiring — `GET /feedback/mine` USER `200` / ORG `403`, `GET /feedback`
ORG `200` / USER `403` / cross-ORG `403`; organiser HTTP body contains no
`@…` address.

**`scratchpad/phase9-frontend-e2e.mjs`** (headless Chrome / CDP) —
**34 / 34 passed, 0 console errors** (§58, §60): sidebar has *Feedback*;
`FEEDBACK_AVAILABLE` notification shown for the attended event only, with a
"Give feedback" link; hub lists the attended event (not the registered-only
one), "Not submitted yet"; form has 5 star controls; submitting without a rating
is blocked client-side; submit → "Feedback submitted successfully." + *Positive*
badge + read-only view + Edit; hub then shows the rating + sentiment;
edit → rating "Poor" + sentiment recomputed to *Negative*; a completed event the
user didn't attend → form withheld, **no** star control; My Events shows a
*Feedback* link; organiser event details has a *Feedback* link; organiser
feedback page shows the 5 summary cards, participant name, the comment, a
*Negative* badge, `x / 5` average; a USER visiting `/organiser/.../feedback` is
redirected off `/organiser`; a `<script>`/`<img onerror>` comment does not
execute and is shown as literal text.

---

## 11. Responsive Testing

**`scratchpad/phase9-responsive-check.mjs`** (headless Chrome / CDP) —
**55 / 55 passed** across the six required viewports
(**1920×1080, 1366×768, 1024×768, 768×1024, 390×844, 375×667** — §55):

| Surface | Checks per viewport | Result |
| --- | --- | --- |
| `/user/feedback` (hub) | no page horizontal overflow · sidebar visible ≥ md / off-canvas on mobile · content + controls fit | ✅ all 6 |
| `/user/feedback/:eventId` (form / submitted view) | same three · plus: rating stars fit the viewport at 375 px | ✅ all 6 (+ star-fit) |
| `/organiser/events/:id/feedback` | same three · plus: the 5 summary cards fit, the feedback list + comment fit | ✅ all 6 |

No element extends past the viewport; the feedback list and summary cards wrap /
stack rather than causing a body scroll; the star control and comment field fit
the narrowest screen.

---

## 12. Security Testing

Executed as part of `__phase9_tests.mjs` (§66) — all passed:

- USER authentication required — `401` unauthenticated (GET + POST).
- USER feedback ownership — B cannot view/edit A's feedback (`403` / `null`).
- ORGANISER event ownership — cross-organiser feedback read `403` (service + HTTP).
- ADMIN RBAC unchanged — no feedback route admits ADMIN; no new admin power.
- Cross-user access blocked; cross-organiser access blocked.
- Input validation — rating (`0`/`6`/`-1`/`3.5`/non-numeric) `400`; comment
  length `400`; non-string rejected.
- Safe comment rendering — markup stored verbatim, rendered as escaped text,
  never executed (`window.__xss` undefined after viewing a hostile comment).
- No secret leakage — AI payload is the comment only; organiser response carries
  participant **name** only (no email / id / token / planning data).
- No arbitrary data access — every read is scoped by authenticated id or
  `loadOwnedEvent`.

---

## 13. Regression Testing

Full Chrome-driven regression for **Phases 1–9** — fresh headless Chrome (fresh
profile) + a clean DB (also wiping `feedbacks`) between suites
(`scratchpad/p9-run-regression.sh`), plus the two in-tree AI suites and the
Phase 9 backend suite:

| Suite | Result |
| --- | --- |
| `phase1-backend-tests.mjs` | ✅ 51 / 51 |
| `phase1-frontend-e2e` | ✅ 23 / 23 |
| `phase2-frontend-e2e` | ✅ 47 / 47 |
| `phase2-regression-check` | ✅ 13 / 13 |
| `phase2-responsive-check` | ✅ 40 / 40 |
| `phase3-frontend-e2e` | ✅ 51 / 51 |
| `phase3-responsive-check` | ✅ 50 / 50 |
| `phase4-frontend-e2e` | ✅ 44 / 44 |
| `phase4-responsive-check` | ✅ 70 / 70 |
| `ai-service/tests/test_analyzer.py` (Phase 5) | ✅ 26 / 26 |
| `phase5-frontend-e2e` | ✅ 27 / 27 |
| `phase5-responsive-check` | ✅ 37 / 37 |
| `phase6-frontend-e2e` | ✅ 34 / 34 |
| `phase6-responsive-check` | ✅ 90 / 90 |
| `phase7-frontend-e2e` | ✅ 32 / 32 |
| `phase7-responsive-check` | ✅ 66 / 66 |
| `phase8-frontend-e2e` | ✅ 32 / 32 |
| `phase8-responsive-check` | ✅ 72 / 72 |
| **Phases 1–8 regression total** | **✅ 805 / 805** |

Previous-phase automated suites remain green; no Phase 1–8 functionality was
changed by Phase 9 (feedback routes are additive on the event router; the only
touch to existing services is the `FEEDBACK_AVAILABLE` side effect on the
`COMPLETED` transition and one new import in `notification.service.js`).

**Batched-runner note.** In the single back-to-back run of all 18 Chrome suites
(`p9-run-regression.sh`), four older suites reported timing flake under sustained
load — `phase1-frontend-e2e` (17/23), `phase4-responsive-check` (65/70),
`phase8-responsive-check` (70/72) and `phase9-responsive-check` (harness error in
`login()`). Every one of them was **re-run standalone against a clean DB and
passed in full** (23/23, 70/70, 72/72, 55/55). The failure signature in every
case is "DOM not ready when probed" (`document.querySelector('aside')` /
`form button[type=submit]` returning `null`, page still on the pre-navigation
path) — the fixed `sleep()` budgets in the oldest harnesses are too short when
one dev backend + Vite + AI service serve 18 suites in a row. Phase 9 changes
nothing in authentication, the planning workspace or the notification-page
layout. The Phase 9 **functional** E2E (`phase9-frontend-e2e`, 34/34) passed
inside the same batched run.

---

## 14. Build

| Check | Result |
| --- | --- |
| **Frontend production build** (`npm run build`) | ✅ **269 modules, 0 errors**. Main bundle `375.18 kB` (gzip 110.6 kB), CSS `29.86 kB`. The one chunk-size warning is the **pre-existing** Phase 7 `html5-qrcode` lazy chunk (`500.26 kB`) — Phase 9 adds **no** frontend dependency and does not touch the scanner. |
| **Backend startup** (`npm run dev`) | ✅ connects to `event_management_system`, listening on `:5000`, no errors. `feedbacks` collection + its 3 indexes created on first use. |
| **MongoDB** | ✅ `mongodb://127.0.0.1:27017/event_management_system` connected; `GET /api/health` → `database: "connected"`. |
| **AI service startup** (`uvicorn main:app`) | ✅ `v0.9.0`; `GET /health` → `capabilities: { planningAnalysis: true, sentimentAnalysis: true }`; VADER analyser loads once at import. |
| **Sentiment endpoint** | ✅ `POST /sentiment/analyze` returns a valid classification; `422` on empty / oversized / malformed. |
| **Certificate system (Phase 8)** | ✅ untouched — Phase 8 E2E + responsive suites pass in regression. |
| **Notification system (Phase 8)** | ✅ untouched apart from the additive `FEEDBACK_AVAILABLE` type; Phase 8 suites pass. |
| **Dependency added** | `vaderSentiment>=3.3,<4.0` in `ai-service/requirements.txt` (pulls `requests`). Backend / frontend: none. |

---

## 15. Files Changed

### AI service — new

| File | Purpose |
| --- | --- |
| `ai-service/services/sentiment.py` | VADER engine — singleton analyser + event-lexicon extension, `analyze_text`, `self_check`, classification bands, input guards. |
| `ai-service/routes/sentiment.py` | `POST /sentiment/analyze` route; `SentimentError → 422`. |
| `ai-service/tests/test_sentiment.py` | In-tree AI test (34 checks) — kept for demo reproducibility, like `test_analyzer.py`. |

### AI service — modified

| File | Why |
| --- | --- |
| `ai-service/models/schemas.py` | `SentimentRequest` (text, `min_length=1`, `max_length=5000`) + `SentimentResponse` + `SentimentBreakdown`. Docstring updated. |
| `ai-service/routes/health.py` | `/health` now reports `capabilities.{planningAnalysis, sentimentAnalysis}` via `self_check`. |
| `ai-service/main.py` | include the sentiment router; version `0.5.0 → 0.9.0`; docstring/description updated. |
| `ai-service/requirements.txt` | `+ vaderSentiment>=3.3,<4.0` (with a comment on why it is small/offline). |

### Backend — new

| File | Purpose |
| --- | --- |
| `backend/src/models/feedback.model.js` | `Feedback` model — refs (event/user/registration/attendance), rating (int 1–5), comment (≤1000), sentiment fields; unique `{user,event}`, `{event,createdAt}`, `{event,sentiment}`. |
| `backend/src/services/sentiment.service.js` | `analyzeComment` — calls the AI service, **never throws**, returns `ANALYZED` / `FAILED` / `SKIPPED`. |
| `backend/src/services/feedback.service.js` | eligibility resolution, submit / update / list-for-organiser, validation, sentiment orchestration, view mappers, basic summary. |
| `backend/src/controllers/feedback.controller.js` | `getMine`, `submit` (`201`), `update`, `listForEvent`. |

### Backend — modified

| File | Why |
| --- | --- |
| `backend/src/models/notification.model.js` | `FEEDBACK_AVAILABLE` added to `NOTIFICATION_TYPES` **and** `ONCE_PER_EVENT_TYPES`. |
| `backend/src/services/notification.service.js` | `+ import Attendance`; new `notifyFeedbackAvailable` producer (registered ∩ present, safe existence-check dedup). |
| `backend/src/services/event.service.js` | `+ import notifyFeedbackAvailable`, `COMPLETED` const; fire `FEEDBACK_AVAILABLE` on the `→ COMPLETED` transition in `updateEventStatusByOwner` **and** `updateEventStatusByAdmin`. |
| `backend/src/routes/event.routes.js` | `+ import feedbackController`; 4 feedback routes (`GET /:id/feedback/mine`, `POST /:id/feedback`, `PATCH /:id/feedback/:feedbackId` — USER; `GET /:id/feedback` — ORGANISER). Literal `/feedback/mine` before the `:feedbackId` param route. |
| `backend/package.json` | version `0.8.0 → 0.9.0`; description → Phase 9. |

### Frontend — new

| File | Purpose |
| --- | --- |
| `frontend/src/services/feedbackService.js` | `getMine` / `submit` / `update` / `listForEvent`. |
| `frontend/src/components/feedback/StarRating.jsx` | accessible 1–5 star `radiogroup` + read-only mode. |
| `frontend/src/components/feedback/SentimentBadge.jsx` | pill — Positive / Neutral / Negative (+ %) / "Analysis unavailable" / "No comment". |
| `frontend/src/pages/user/UserFeedback.jsx` | `/user/feedback` — the participant feedback hub. |
| `frontend/src/pages/user/FeedbackForm.jsx` | `/user/feedback/:eventId` — the form / read-only view / edit / not-eligible states. |
| `frontend/src/pages/organiser/OrganiserEventFeedback.jsx` | `/organiser/events/:id/feedback` — summary cards + feedback list. |

### Frontend — modified

| File | Why |
| --- | --- |
| `frontend/src/routes/AppRoutes.jsx` | routes: `/user/feedback`, `/user/feedback/:eventId`, `/organiser/events/:id/feedback`. |
| `frontend/src/layouts/UserLayout.jsx` | `Feedback` nav item; `titleFor` → "Feedback" / "Give Feedback". |
| `frontend/src/layouts/OrganiserLayout.jsx` | `titleFor` → "Feedback" for `/organiser/events/:id/feedback`. |
| `frontend/src/pages/organiser/OrganiserEventDetails.jsx` | a **Feedback** link between *Certificates* and *Edit*. |
| `frontend/src/pages/user/MyEvents.jsx` | a **Feedback** link on completed + present rows. |
| `frontend/src/pages/user/UserNotifications.jsx` | `FEEDBACK_AVAILABLE` type label + a "Give feedback" link. |
| `frontend/package.json` | version `0.8.0 → 0.9.0`; description → Phase 9. |

### Docs

| File | Why |
| --- | --- |
| `README.md` | status line; new **"Feedback & sentiment analysis (Phase 9)"** section; roadmap. |
| `project-documents/PHASE_9_REPORT.md` | this report. |

### Not committed (test harnesses in the session scratchpad)

`phase9-frontend-e2e.mjs`, `phase9-responsive-check.mjs`, `p9-shots.mjs`,
`p9-run-regression.sh`; `backend/__phase9_tests.mjs` (temporary — deleted after
the final run). The in-tree `ai-service/tests/test_sentiment.py` **is** part of
the tree (demo-reproducible, like the Phase 5 analyzer test).

---

## 16. Known Issues

1. **VADER is lexicon-based, not a neural model.** It is accurate on clear
   feedback but can miss implicit negativity with no lexicon anchor
   (e.g. *"the timing could have been better"* leans positive because of
   *"better"*). This is an honest limit of the chosen offline model, documented
   rather than hidden; the small domain lexicon mitigates the most common event
   terms. A transformer upgrade is possible later (it would need a model
   download / GPU and is out of scope for §24).
2. **Sentiment confidence is the model's `|compound|`, not a calibrated
   probability.** Labelled and stored as a *model confidence score* only (§27).
3. **Synchronous analysis adds the AI round-trip to the submit latency**
   (typically < 100 ms locally; capped by `AI_TIMEOUT_MS`). Chosen over async
   for simplicity and for guaranteed comment/sentiment consistency (§28, §50).
   If the AI service is slow the submit waits up to the timeout, then saves with
   `FAILED`.
4. **`FAILED` sentiment is not automatically retried.** The feedback is saved and
   the organiser view shows "Analysis unavailable"; re-analysis would require the
   participant to edit and re-save. A background re-analysis job was not built
   (no job infrastructure in the project; out of scope).
5. **Existing `event_management_system` deployments** carry the Phase-8
   `{recipient,event,type}` partial index whose filter predates
   `FEEDBACK_AVAILABLE`. This was reconciled on the dev DB
   (`dropIndex` + `syncIndexes`), and `notifyFeedbackAvailable` also does a
   **safe existence check** so de-duplication is correct regardless of the index
   state. A fresh DB builds the index with the current filter.
6. **`SKIPPED` sentiment status** was added (rating-only feedback) alongside the
   `PENDING`/`ANALYZED`/`FAILED` set from §30 — it carries real information
   ("no comment to analyse") rather than being a workflow state.
7. **No feedback deletion** (§12) — deliberately not implemented. Editing is the
   only mutation. An attended-then-cancelled participant keeps any feedback they
   already submitted but cannot create new feedback.
8. **`npm audit`** — the 3 pre-existing moderate `qs` → `body-parser` →
   `express` advisories (Express 4 transitive) are unrelated to Phase 9 and were
   not touched.
9. **No git commits** — the repository still has none; `git diff` is cumulative
   across Phase 4-visual → Phase 9. `backend/.env` and `ai-service/.venv` are
   git-ignored. Phase 9 files are staged.
