# Credential Update — Default Development Accounts — Report

**Project:** AI-Powered Event Planning & Management System
**Change type:** Development/test account credentials only (no architecture change)
**Date:** 2026-09-05
**Database:** `event_management_system` (unchanged; old `event_management` never touched)

Scope: update only the three default dev/test accounts. No changes to
authentication logic, JWT, RBAC, event management, the planning system, the
database schema, API structure, frontend UI, or Phase 4 functionality.

---

## 1. Did the three accounts already exist?

No. Before this change `event_management_system` held one account per role from
the Phase 1.5 seed:

| email | role |
|---|---|
| admin@eventms.local | ADMIN |
| organiser@eventms.local | ORGANISER |
| user@eventms.local | USER |

None of `admin@gmail.com` / `organiser@gmail.com` / `user@gmail.com` existed.

## 2. Updated or created?

**Updated (re-pointed) — not created, no duplicates.** A new additive utility
`backend/src/utils/seedDevAccounts.js` (run via `npm run seed:dev`) took each
existing same-role account and changed its email + password to the required
values. The account count stayed at exactly **3**; no `@eventms.local` logins
remain. The seeder is idempotent (re-running is a no-op).

Final state:

| email | password | role | status | display name |
|---|---|---|---|---|
| admin@gmail.com | admin@123 | ADMIN | ACTIVE | System Administrator |
| organiser@gmail.com | organiser@123 | ORGANISER | ACTIVE | Olivia Organiser |
| user@gmail.com | user@123 | USER | ACTIVE | Uma Participant |

Seeder logic per account: (1) if an account already uses the target email →
refresh password/role/status; (2) else if the previous same-role
`*@eventms.local` account exists → re-point its email and refresh; (3) else
create. Only those three explicit legacy addresses are ever reused. It writes
through the existing Mongoose `User` model — no direct collection writes.

## 3. Passwords bcrypt-hashed?

Yes. Writing through the `User` model runs the unchanged `pre('save')` bcrypt
hook (salt rounds 12). DB verification: all three passwords stored as 60-char
`$2b$` hashes, none equal to the plaintext. No hashing/auth code was modified.

## 4. Database used

`mongodb://127.0.0.1:27017/event_management_system`.

The old `event_management` database was never connected to or modified —
verified before and after (still 2 legacy users, including a `PARTICIPANT`-role
record that predates this change).

## 5. Login test — ADMIN

`POST /api/auth/login` `admin@gmail.com` / `admin@123` → **200**,
`user.role = "ADMIN"`, `em_token` cookie set, no password/hash in the response
body. `GET /api/auth/me` → 200 ADMIN. `GET /api/admin/test` → 200;
`GET /api/admin/users` → 200 (admin dashboard + APIs reachable).
Old password → 401.

## 6. Login test — ORGANISER

`organiser@gmail.com` / `organiser@123` → **200**, `role = "ORGANISER"`, cookie
set. `GET /api/auth/me` → 200. `GET /api/organiser/test` → 200;
`GET /api/events/my` → 200; `POST /api/events` → 201;
`GET /api/events/:id/planning/overview` and `/planning/readiness` → 200;
`POST /api/events/:id/tasks` → 201 (organiser dashboard, events, and planning
workspace all reachable). The test event was hard-deleted afterward — DB back
to 0 events.

## 7. Login test — USER

`user@gmail.com` / `user@123` → **200**, `role = "USER"`, cookie set.
`GET /api/auth/me` → 200 USER. `GET /api/user/test` → 200. Not treated as
ADMIN (`/api/admin/test`, `/api/admin/users` → 403) and not as ORGANISER
(`/api/organiser/test`, `/api/events/my` → 403; `POST /api/events` → 403).

## 8. RBAC test result — all pass

| Actor | Target | Expected | Result |
|---|---|---|---|
| USER | `/api/admin/test`, `/api/admin/users` | 403 | 403 |
| USER | `/api/organiser/test`, `/api/events/my`, `POST /api/events` | 403 | 403 |
| ORGANISER | `/api/admin/test`, `/api/admin/users` | 403 | 403 |
| ORGANISER | `/api/user/test` | 403 | 403 |
| ADMIN | `/api/admin/test`, `/api/admin/users` | 200 | 200 |
| ADMIN | `/api/organiser/test`, `/api/user/test` | 403 | 403 |
| ADMIN, USER | `/api/events/:id/planning/*` | 403 | 403 |
| no cookie | `/api/auth/me`, `/api/admin/test` | 401 | 401 |
| tampered cookie | `/api/auth/me` | 401 | 401 |
| wrong password (each account) | `/api/auth/login` | 401 (generic message) | 401 |

No new role introduced; only `ADMIN | ORGANISER | USER` exist. Phase 4 rule
intact: ADMIN has no planning access.

Credential + RBAC + Phase-4 access harness: **65 / 65 passed** (temporary
harness, removed after the run).

## 9. Regression test result — all green

| Suite | Result |
|---|---|
| Phase 1 backend auth + RBAC | 51 / 51 |
| Phase 2 admin E2E | 47 / 47 |
| Phase 2 responsive | 40 / 40 |
| Phase 3 event E2E | 51 / 51 |
| Phase 3 responsive | 50 / 50 |
| Phase 4 planning E2E (incl. cross-owner / cross-event) | 44 / 44 |
| Phase 4 responsive | 70 / 70 |
| **Total** | **353 / 353** |

Frontend production build: 159 modules, no errors; JS bundle hash unchanged
from Phase 4 (`index-CT5y8gzR.js`), confirming no application code changed.
`git diff --stat` on tracked files shows **only `backend/package.json`** (the
added `seed:dev` script line).

## 10. Issues encountered

- **Pre-existing test bug:** `phase1-backend-tests.mjs` still had its `MONGO`
  constant pointed at the old `event_management` DB (written in Phase 1, never
  updated after the 1.5 rename). Repointed to `event_management_system` — a
  test-fixture fix, not an app change.
- **Phase 2 E2E display-name coupling:** the first run showed 6 failures
  because that script hard-codes account display names ("Olivia Organiser",
  "System Administrator"). Fix: the seeder keeps the original display names
  (the spec dictates only email/password/role); re-ran → 47 / 47.
- **Regression fixtures:** the scratchpad E2E / responsive scripts hard-coded
  the old `@eventms.local` credentials; their constants were updated to the new
  credentials so regression exercises the real login path.
- **Old DB drift (informational):** `event_management` still contains a legacy
  `PARTICIPANT`-role user — pre-existing, untouched, never connected to.
- `backend/.env` `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` were updated to
  the new admin values so `npm run seed:admin` stays consistent. `.env` is
  git-ignored and not committed.

---

## Files changed

| File | Change |
|---|---|
| `backend/src/utils/seedDevAccounts.js` | **New** — additive dev-account provisioning utility (`npm run seed:dev`) |
| `backend/package.json` | Added `"seed:dev"` script entry (only tracked-file change) |
| `backend/.env` | `ADMIN_*` updated to the new admin credentials (git-ignored, not committed) |

No changes to authentication, JWT, RBAC, models, schema, routes, controllers,
services, or any frontend file. The abstract PDF is unchanged (329574 bytes).

**Phase 5 not started.**
