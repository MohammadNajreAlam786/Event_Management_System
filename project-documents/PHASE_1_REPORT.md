# Phase 1 — Authentication & Role-Based Access Control — Completion Report

**Project:** AI-Powered Event Planning & Management System
**Phase:** 1 (authentication + RBAC only — no event features)
**Date completed:** 2026-09-03
**Builds on:** Phase 0 foundation (unchanged architecture)

---

## 1. Files created (20)

**Backend (13)**

| File | Purpose |
|---|---|
| `backend/src/models/user.model.js` | Mongoose `User` schema, password hashing hook, `comparePassword`, `toSafeObject`, role/status enums |
| `backend/src/services/auth.service.js` | Domain logic: `registerUser`, `authenticateUser`, `getUserById` |
| `backend/src/controllers/auth.controller.js` | HTTP handlers: `register`, `login`, `logout`, `me` |
| `backend/src/controllers/roleTest.controller.js` | RBAC verification handlers |
| `backend/src/middleware/authMiddleware.js` | `authenticate` — verifies the cookie JWT, loads the user |
| `backend/src/middleware/roleMiddleware.js` | `requireRole(...roles)` — role authorization |
| `backend/src/routes/auth.routes.js` | `/api/auth/*` routes |
| `backend/src/routes/roleTest.routes.js` | `/api/{admin,organiser,user}/test` routes |
| `backend/src/utils/apiError.js` | `ApiError` class with status-coded factory helpers |
| `backend/src/utils/asyncHandler.js` | Async route wrapper → forwards rejections to the error handler |
| `backend/src/utils/validators.js` | Dependency-free email/password/registration/login validation |
| `backend/src/utils/token.js` | JWT sign/verify + auth-cookie option builders |
| `backend/src/utils/seedAdmin.js` | Idempotent initial-admin seed (`npm run seed:admin`) |

**Frontend (7)**

| File | Purpose |
|---|---|
| `frontend/src/store/useAuthStore.js` | Zustand auth store: `user`, `status`, `isInitialized`, `isLoading`, `error`; `initialize/login/register/logout/clearError` |
| `frontend/src/services/authService.js` | `register`, `login`, `logout`, `getCurrentUser` (uses the shared Axios instance) |
| `frontend/src/routes/ProtectedRoute.jsx` | Guard: any authenticated user, else → `/login` |
| `frontend/src/routes/RoleProtectedRoute.jsx` | Guard: specific role(s), else → `/login` or the user's own area |
| `frontend/src/utils/roles.js` | `ROLES`, `REGISTERABLE_ROLES`, `roleHomePath`, `roleLabel` |
| `frontend/src/components/FullScreenLoader.jsx` | Shown during the one-time session check |
| `frontend/src/components/RoleAreaPage.jsx` | Simple role landing page + protected-API check button |

## 2. Files modified (21)

**Backend:** `package.json` (auth deps + `seed:admin` script), `package-lock.json`,
`.env.example` (JWT/admin vars), `src/app.js` (cookie-parser), `src/config/env.js`
(JWT/admin config + `assertRequiredEnv`), `src/server.js` (assert env, log auth
URL), `src/routes/index.js` (mount auth + role-test), `src/middleware/errorHandler.js`
(map Mongoose `ValidationError` / duplicate-key / JWT errors, pass field errors).

**Frontend:** `package.json` (version/description), `src/App.jsx` (run
`initialize()` on mount, gate on `isInitialized`), `src/services/api.js`
(`withCredentials: true`, attach `status`/`fieldErrors` to errors),
`src/store/useAppStore.js` (drop stale `session` placeholder),
`src/routes/AppRoutes.jsx` (wrap role routes in `RoleProtectedRoute`),
`src/layouts/RootLayout.jsx` (auth-aware nav + logout), `src/pages/LoginPage.jsx`
& `RegisterPage.jsx` (real forms + validation), `src/pages/{Admin,Organiser,User}Page.jsx`
(role area pages), `src/pages/HomePage.jsx` (auth-aware CTA).

**Root:** `README.md` (Phase 1 section, env vars, scripts, roadmap).

_(Also: `.env` files updated locally — git-ignored, not committed.)_

**AI service: not touched.** `git diff` against Phase 0 for `ai-service/` is empty;
no AI/ML packages installed; `GET /health` still returns 200.

## 3. User model structure

`backend/src/models/user.model.js` — collection `users`:

| Field | Type | Rules |
|---|---|---|
| `name` | String | required, trimmed, 2–100 chars |
| `email` | String | required, **unique**, lowercased, trimmed, regex-validated |
| `password` | String | required, min 8, `select: false` (never returned by default), stored as a bcrypt hash |
| `role` | String | enum `ADMIN` / `ORGANISER` / `USER`, default `USER` |
| `status` | String | enum `ACTIVE` / `INACTIVE`, default `ACTIVE` |
| `createdAt`, `updatedAt` | Date | auto (`timestamps: true`) |

- **Pre-save hook** hashes `password` with `bcryptjs` (12 salt rounds) whenever it changes.
- **Instance methods:** `comparePassword(candidate)` (bcrypt compare), `toSafeObject()` (id/name/email/role/status/timestamps — no password).
- **`toJSON` transform** maps `_id → id` and strips `password` / `__v` as defence in depth.
- **Index:** unique on `email` (verified present in `db.users.indexes()`).

## 4. Authentication strategy selected

**JWT delivered in a single HTTP-only cookie.**

- On login the backend signs a JWT (`{ sub: <userId>, role }`, `expiresIn` from
  `JWT_EXPIRES_IN`, default `1d`) and sets it as cookie `em_token` with
  `httpOnly: true`, `sameSite: 'lax'`, `secure: <production only>`, `path: '/'`,
  `maxAge` matching the token lifetime.
- The browser attaches the cookie automatically; the Axios instance uses
  `withCredentials: true`; CORS pins a single origin with `credentials: true`.
- **Why this over `localStorage` + `Authorization` header:** the token is never
  reachable from JavaScript (XSS can't exfiltrate it), the session survives a
  refresh with no token-refresh dance (`GET /api/auth/me` rehydrates state on
  load), and logout is a real server action (`clearCookie`). CSRF exposure is
  limited by `SameSite=Lax` + a pinned CORS origin. **One** strategy only — there
  is no header-based fallback.
- JWT secret comes from `JWT_SECRET` (required; the server refuses to start
  without it via `assertRequiredEnv()`). Nothing sensitive is placed in the token.

## 5. APIs created

| Method & path | Auth | Behaviour |
|---|---|---|
| `POST /api/auth/register` | public | Create `USER`/`ORGANISER`. Missing role → `USER`. `ADMIN` → 403. Validates name, email, password policy, optional `confirmPassword` match, duplicate email → 409. Returns 201 + safe user; does **not** log in. |
| `POST /api/auth/login` | public | Validates presence, verifies password (generic 401 for unknown user *or* wrong password), rejects `INACTIVE` (403), else signs JWT + sets cookie, returns safe user. |
| `POST /api/auth/logout` | public | Clears the auth cookie; 200. |
| `GET /api/auth/me` | cookie | Returns `{ success, user: { id, name, email, role } }` — safe fields only. |
| `GET /api/admin/test` | `ADMIN` | RBAC check endpoint (Phase 1 only). |
| `GET /api/organiser/test` | `ORGANISER` | RBAC check endpoint (Phase 1 only). |
| `GET /api/user/test` | `USER` | RBAC check endpoint (Phase 1 only). |

Error responses are `{ success: false, message, errors? }` with user-friendly
messages ("Invalid email or password.", "An account with this email already
exists.", "Your account is currently inactive.", "You are not authorized to
access this resource.", "Your session has expired. Please log in again.").

## 6. RBAC implementation

- **`authenticate`** (`authMiddleware.js`): reads `em_token` cookie → 401 if
  missing; `jwt.verify` → 401 `TokenExpiredError` vs `JsonWebTokenError` with
  distinct messages; **re-loads the user from MongoDB** by `sub` (malformed id →
  401, unknown → 401, `INACTIVE` → 403); attaches a server-verified
  `req.user = { id, name, email, role }`. The token's role claim is never trusted
  on its own.
- **`requireRole(...roles)`** (`roleMiddleware.js`): returns a guard that 403s any
  authenticated user whose DB role is not in the allowed list. Composes as
  `router.get(path, authenticate, requireRole('ADMIN'), handler)`.
- Internal error details are never sent to the client (generic messages; stack
  only in non-production for 5xx).

## 7. Frontend routes created

| Route | Guard | Notes |
|---|---|---|
| `/login` | public | Redirects to the role area if already authenticated. Email/password, error + loading state, "registered" success banner, link to `/register`. |
| `/register` | public | Name, email, password, confirm password, account type (`USER`/`ORGANISER` — **no ADMIN option**). Client validation mirrors the server; server field errors merged in. On success → `/login` with a success flash. |
| `/admin` | `RoleProtectedRoute roles={['ADMIN']}` | "Admin area" + protected-API check. |
| `/organiser` | `RoleProtectedRoute roles={['ORGANISER']}` | "Organiser area" + protected-API check. |
| `/user` | `RoleProtectedRoute roles={['USER']}` | "User area" + protected-API check. |
| `/` , `*` | public | Home (auth-aware CTA) and 404. |

Unauthenticated → `/login`; wrong-role → the user's own area. `App.jsx` blocks
rendering behind a full-screen loader until the initial `/auth/me` check settles,
so guards never flash-redirect. Frontend guarding is UX only — every protected
API is independently enforced on the backend.

---

## 8. Registration test results (`POST /api/auth/register`)

Automated harness (Node + real HTTP + MongoDB assertions), 14 assertions:

| Case | Expected | Result |
|---|---|---|
| Register `USER` | 201, account created | **PASS** |
| Response contains no `password` / `passwordHash` | — | **PASS** |
| Register `ORGANISER` | 201, role `ORGANISER` | **PASS** |
| Register `role: "ADMIN"` | rejected **403** | **PASS** |
| Duplicate email (2nd attempt) | rejected **409** | **PASS** |
| Invalid email format | **400** + `errors.email` | **PASS** |
| Weak password (`"short"`) | **400** + `errors.password` | **PASS** |
| Password / confirmPassword mismatch | **400** + `errors.confirmPassword` | **PASS** |
| Role omitted | 201, defaults to `USER` | **PASS** |

Frontend (headless Chrome via DevTools Protocol): register `USER` and
`ORGANISER` through the real form → land on `/login` with "Account created"
banner; mismatched passwords → stays on `/register` showing "Passwords do not
match". **PASS**

## 9. Login test results (`POST /api/auth/login`)

| Case | Expected | Result |
|---|---|---|
| Correct email + correct password | 200, `em_token` cookie set, safe user returned | **PASS** |
| Correct email + wrong password | **401**, generic "Invalid email or password." | **PASS** |
| Non-existent email | **401** (same generic message — no enumeration) | **PASS** |
| Inactive account (`status: INACTIVE`) | **403**, "Your account is currently inactive." | **PASS** |
| `GET /auth/me` with the login cookie | 200, only `id,name,email,role` | **PASS** |

Frontend: login as `USER` → redirected to `/user` ("User area"); as `ORGANISER`
→ `/organiser`; as `ADMIN` → `/admin`. **PASS**

## 10. RBAC test results

Accounts: 1 `ADMIN` (seeded), 1 `ORGANISER`, 1 `USER`. Matrix of
`GET /api/{admin,organiser,user}/test`:

| Caller | `/admin/test` | `/organiser/test` | `/user/test` |
|---|---|---|---|
| **ADMIN** | 200 ✅ | 403 ✅ | 403 ✅ |
| **ORGANISER** | 403 ✅ | 200 ✅ | 403 ✅ |
| **USER** | 403 ✅ | 403 ✅ | 200 ✅ |

All 9 combinations **PASS** (backend harness). Frontend: the "Run check" button
on `/user` returns "USER access granted." **PASS**

Frontend route RBAC (headless):

| Signed in as | `/admin` | `/organiser` | `/user` |
|---|---|---|---|
| _(nobody)_ | → `/login` ✅ | → `/login` ✅ | → `/login` ✅ |
| USER | → `/user` ✅ | → `/user` ✅ | allowed ✅ |
| ORGANISER | → `/organiser` ✅ | allowed ✅ | → `/organiser` ✅ |
| ADMIN | allowed ✅ | → `/admin` ✅ | _(→ `/admin`)_ ✅ |

## 11. Session / logout test results

| Case | Expected | Result |
|---|---|---|
| Login → `GET /auth/me` | 200 | **PASS** |
| Login → **reload browser** → still on `/user`, still authenticated | session persists (cookie) | **PASS** |
| `POST /auth/logout` | 200, cookie cleared (`Set-Cookie` expiry in the past) | **PASS** |
| After logout → `GET /auth/me` | **401** | **PASS** |
| After logout → visit `/user` in the SPA | redirected to `/login` | **PASS** |
| Expired JWT (signed with real secret, `expiresIn: -10`) → `GET /auth/me` | **401**, "…expired…log in again" | **PASS** |
| Garbage cookie value → `GET /auth/me` | **401** | **PASS** |

## 12. Security test results

| Attempt | Expected | Result |
|---|---|---|
| Protected API with **no** token | reject **401** | **PASS** |
| Protected API with **invalid** token | reject **401** | **PASS** |
| Protected API with **expired** token | reject **401** | **PASS** |
| Valid signature but **unknown/malformed `sub`** | reject **401** (not 500) | **PASS** |
| Valid token, **wrong role** | reject **403** | **PASS** |
| Valid token, **correct role** | allow **200** | **PASS** |
| Password stored **hashed** (`$2…` bcrypt), never plaintext | — | **PASS** (DB inspected) |
| `password` / hash **never** in any API response (`register`, `login`, `me`) | — | **PASS** |
| Public registration as `ADMIN` | blocked **403** | **PASS** |
| Secrets (`JWT_SECRET`, admin password) only in `.env` (git-ignored), never in source | — | **PASS** |
| Server refuses to start without `JWT_SECRET` | clear error, exit 1 | **PASS** |
| Backend authorization independent of the frontend | enforced on every `/api` guard | **PASS** |

## 13. Phase 0 regression test results

| Check | Result |
|---|---|
| Backend `GET /api/health` | **200**, `database: "connected"` |
| MongoDB connection (server starts only after connect) | **PASS** — `mongosh` ping `{ ok: 1 }` |
| AI service `GET /health` | **200** — source unchanged (`git diff` empty), no ML packages |
| Frontend dev server (`/`) | **200** |
| Frontend routing (`/`, `/login`, `/register`, unknown → 404) | **PASS** (headless render) |
| Tailwind CSS | **PASS** — v4 marker + utilities present in the built CSS (`dist/assets/index-*.css`, 15.1 kB) |
| Axios | **PASS** — home page "Backend connection: online" via the shared instance |
| Zustand | **PASS** — `useAppStore` + new `useAuthStore`, exercised throughout the E2E run, no errors |
| Frontend production build (`npm run build`) | **PASS** — 117 modules, no errors/warnings, `built in ~0.95s` |
| Browser console during full E2E | **no errors** |

**Automated totals:** backend harness **52/52 passed**; frontend E2E **23/23 passed**.

## 14. Remaining issues / notes

- **None blocking.** All acceptance-checklist items pass.
- One bug was found and fixed mid-testing: hardening `getUserById` for malformed
  token subjects initially referenced `mongoose` without importing it (caused 500s
  on protected routes). Import added; backend harness re-run **52/52**.
- **Pre-existing local data:** the `event_management` database already contained
  two user documents from earlier work — `mdnazrealam349@gmail.com` (role
  `PARTICIPANT`, no `status`) and `mysoul3115@gmail.com` (role `ADMIN`, no
  `status`). They predate this phase, do **not** match the Phase 1 schema enum
  (`PARTICIPANT` is not a valid role), and were left untouched. They can't be used
  to pass RBAC (`requireRole` only accepts `ADMIN`/`ORGANISER`/`USER`), but you
  may want to delete or migrate them before later phases.
- `.gitignore` from Phase 0 already covers the new secrets; `backend/.env` remains
  untracked. The repo still has **no commits** (Phase 0 ran `git init` only).
- The `/api/{admin,organiser,user}/test` endpoints are throwaway RBAC probes and
  should be removed when real feature APIs land.

---

## Final acceptance checklist

**Backend** — User model ✅ · password hashing ✅ · registration ✅ · login ✅ ·
logout ✅ · JWT auth ✅ · auth middleware ✅ · role middleware ✅ · `/api/auth/me`
✅ · no public admin registration ✅ · protected APIs reject unauthorized ✅

**Frontend** — login page ✅ · registration page ✅ · user registration ✅ ·
organiser registration ✅ · admin registration unavailable ✅ · role-based login
redirect ✅ · protected routes ✅ · role-based routes ✅ · logout ✅ · Zustand auth
state ✅ · refresh/session behaviour ✅

**Database** — users stored in MongoDB ✅ · passwords hashed ✅ · email unique ✅ ·
roles stored correctly ✅

**Security** — no plaintext passwords ✅ · no hash exposed ✅ · no JWT secret
exposed ✅ · no public admin registration ✅ · backend authorization enforced ✅ ·
frontend cannot bypass backend ✅

**Phase 0 regression** — frontend ✅ · backend ✅ · MongoDB ✅ · AI service ✅ ·
Tailwind ✅ · Axios ✅ · Zustand ✅ · production build ✅

**Phase 1 is complete. Phase 2 (Admin module) has not been started.**
