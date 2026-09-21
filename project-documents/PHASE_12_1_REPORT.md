# PHASE 12.1 REPORT

**Home and Login Page Visual Redesign**
Sreyas Institute of Engineering and Technology — Dept. of CSE (AI & ML)
Nallapati Jayaveer (23VE1A6631) · Mohammad Najre Alam (23VE1A6629) · Nunnagopula Shiva (23VE1A6633) · Godalla Suryansh (23VE1A6614)
Completed: 2026-09-14

---

## 1. Home Page Changes

`frontend/src/pages/HomePage.jsx` was rebuilt from a plain text page into a
professional SaaS-style landing page:

- **Navbar** — a new sticky, self-contained navbar (logo, Home/Features/How It
  Works links, Log in / Get Started actions, a collapsible mobile menu).
  `Get Started` → `/register`, `Log in` → `/login`; if the visitor is already
  authenticated, both collapse into a single "Go to your area" action that
  respects the existing `roleHomePath(user.role)` logic (unchanged).
- **Hero** — two-column on desktop (eyebrow, heading, supporting text, a
  primary "Start Planning" → `/register` and secondary "Explore Features"
  anchor-scroll button) with a hand-built, clearly-labelled `SAMPLE PREVIEW`
  dashboard mockup on the right (readiness bar, registration/attendance
  tiles, a violet AI-suggestion snippet, a QR check-in chip) — built entirely
  from existing Tailwind/`Icon` primitives, no new image or external asset.
- **Features** — 6 cards (Pre-event Planning, Smart Registration, QR-Based
  Attendance, Certificates, Feedback and Analytics, AI-Based Improvements)
  under `id="features"`, each with an icon, title, and two-line description.
- **Workflow** — `id="how-it-works"`, "From preparation to improvement", a
  numbered 6-step grid (Plan → Prepare → Conduct → Track → Evaluate →
  Improve), each with an icon and a one-line description that never
  truncates.
- **Roles** — "Built for every event participant", 3 cards (Admin/Organiser/
  Participant) reusing the exact violet/indigo/emerald tone mapping already
  established for role badges in `DashboardHeader`.
- **Final CTA** — a solid indigo band ("Make your next event easier to
  organise.") with "Create an Account" → `/register` and "Log in" →
  `/login` (collapsing to "Go to your area" when authenticated).
- **Footer** — brand mark, a short description, Home/Login/Register links,
  an academic-project label, and the existing `<BackendStatus/>` widget
  tucked unobtrusively into the corner (kept exactly as-is — a Phase 2
  regression check greps for its literal "Backend connection: online" text).

## 2. Login Page Changes

`frontend/src/pages/LoginPage.jsx` was rebuilt as a focused two-panel
authentication page:

- **Its own compact header** — logo, a "Home" link, a non-link "Login"
  current-page indicator, and a "Register" button. No second "Log in" button
  is shown, since the page itself is the login page.
- **Left panel** (desktop only) — "Welcome back to EventFlow", supporting
  text, and the three specified benefit bullets (readiness workflow, QR
  attendance, AI-based improvements).
- **Right panel** — the sign-in card: "Sign in" heading, supporting text,
  Email field, Password field with the existing show/hide toggle, the Log in
  button, and a Register link. **All existing logic is untouched**: same
  `#email`/`#password` ids, same `useAuthStore` calls, same validation,
  loading, and error-message behaviour.
- Content is anchored near the top with fixed padding rather than
  vertically centered in the full viewport height — the original draft used
  `flex items-center justify-center`, which produced large, unbalanced empty
  gaps above and below the form on tall screens (exactly what the brief
  warned against); this was caught by a screenshot review and fixed.

## 3. Components Reused or Created

**Reused, unmodified:** `Icon.jsx` (all icons used already existed — no new
icon was added), `BackendStatus.jsx`, `useAuthStore`, `useAppStore`,
`roles.js` (`roleHomePath`/`roleLabel`), the `--shadow-card`/
`--shadow-card-hover` CSS tokens, and the violet/indigo/emerald role-tone
convention from Phase 12's `DashboardHeader`.

**Created:** two small page-local components (not extracted to shared files,
since each is specific to its page's distinct header requirements) —
`HomeNavbar` + `ProductPreview` + `BrandMark` inside `HomePage.jsx`, and
`LoginHeader` inside `LoginPage.jsx`.

**Modified:** `RootLayout.jsx` gained one conditional — for `pathname === '/'`
or `'/login'` it now renders a bare `<Outlet/>` instead of its generic
header/`<main>`/footer, so Home and Login can build their own full-width
page. **Every other public route (`/register`, `/verify`, `/verify/:code`,
404) keeps the exact same generic header/footer/`max-w-5xl` wrapper as
before, completely unchanged** — this was the deliberate way to redesign
only Home and Login without touching any other page that shares the layout.
`index.css` gained one additive rule, `html { scroll-behavior: smooth; }`,
for the hero's anchor-scroll link (zero layout impact).

## 4. Responsive Results

A new `scratchpad/phase12_1-responsive-check.mjs` swept Home and Login at the
exact 7 widths specified — 320, 375, 425, 768, 1024, 1280, 1440 — checking
horizontal overflow, clipped nav/button/heading elements, and content
presence.

**First pass found one real defect:** at 320px the Login header's
"Register" link was clipped off-screen (logo + Home + Login + Register all
competing for one row). **Fixed** by hiding the "Home"/"Login" text pair
below the `sm` breakpoint — the logo still links home, so Home stays
reachable — leaving only the logo and the Register button on narrow screens,
consistent with the brief's explicit "stack or collapse navigation when
needed" allowance.

**Result after the fix: 42/42 passed**, 0 failed, at all 7 widths on both
pages. Hero columns stack correctly on mobile, feature cards reflow to a
single column, workflow steps stack vertically with no truncated labels, the
CTA buttons wrap without overlapping, and the Login form remains fully
usable end-to-end at every width.

## 5. Accessibility Results

- Every button/link has meaningful, visible text (no icon-only actions
  without a label); the show/hide-password toggle keeps its existing
  `aria-label`.
- All decorative icons remain `aria-hidden` (the shared `Icon` component's
  default, unchanged).
- The mobile menu toggle has `aria-label="Toggle menu"` and `aria-expanded`.
- The Login header's current-page indicator uses `aria-current="page"`.
- The global `:focus-visible` ring (from Phase 12, untouched) still applies
  to every new interactive element.
- Colour is never the only signal — every status/role/feature element pairs
  colour with an icon and/or text label.
- No invalid HTML nesting was introduced (verified via the "no console
  errors" check in the regression suite below).

## 6. Functional Test Results

The full Phase 1–11 regression suite (22 harnesses) was run against the
redesigned pages, plus a dedicated manual check for the specific flows this
phase touches (Home button navigation, invalid-login error state, role-based
redirect) that had no prior automated coverage.

**Regression:** 21 of 22 suites passed cleanly on the first run; one
(`phase6-responsive-check`) showed a single failure ("sidebar visible" at
1024px) consistent with this project's long-documented batch-load timing
flake — re-verified standalone (fresh Chrome profile, wiped DB): **90/90
clean**. This suite exercises the authenticated dashboard sidebar, which
Phase 12.1 never touches.

**Final regression tally: 956/956.**

**Manual functional check (7/7 passed):**

| Check | Result |
| --- | --- |
| Home "Get Started" → `/register` | PASS |
| Home "Start Planning" → `/register` | PASS |
| Home "Log in" → `/login` | PASS |
| Invalid login stays on `/login` | PASS |
| Invalid login shows the existing error banner | PASS |
| Valid ORGANISER login → `/organiser` | PASS |
| Valid USER login → `/user` | PASS |

`/`, `/login`, and `/register` were all verified to render at their existing
paths with no routing changes.

## 7. Build Result

```
vite build
✓ 287 modules transformed
dist/index.html                 0.50 kB
dist/assets/index-*.css        40.10 kB (gzip 7.91 kB)
dist/assets/index-*.js         375.18 kB (gzip 110.57 kB)
dist/assets/index-*.js         563.06 kB (gzip 159.33 kB)
✓ built in ~4.5s
```

Clean build, 0 errors. Same pre-existing >500 kB chunk-size advisory as every
prior phase (no new dependency was added).

## 8. Confirmation: Backend and AI Service Unchanged

Verified via `git status` — every file touched this phase is under
`frontend/` (`HomePage.jsx`, `LoginPage.jsx`, `RootLayout.jsx`, `index.css`,
`package.json`). No file under `backend/` or `ai-service/` was modified. No
API endpoint, database model, authentication flow, or JWT handling was
touched. No route path changed — `/`, `/login`, and `/register` are exactly
as before.

## 9. Known Issues

None blocking. The one regression-suite flake (`phase6-responsive-check`,
unrelated to this phase) is a documented, recurring batch-load timing
characteristic of this test environment, re-confirmed clean standalone.

## 10. Final Verdict

**Zero backend/API/routing changes · all existing Login/Register/navigation
functionality preserved · 956/956 regression · 42/42 responsive checks at
the 7 required widths · 7/7 manual functional checks · clean build.**

### PASS

Do not begin another phase automatically.
