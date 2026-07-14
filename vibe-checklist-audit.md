# Vibe Checklist Audit — Assessment Platform
> Phase 1 Development · Audited: 2026-07-14

---

## 1. API Key Status

| Key | Present | Status | Notes |
|-----|---------|--------|-------|
| `SUPABASE_URL` | ✅ | ✅ Working | Set in backend/.env |
| `SUPABASE_ANON_KEY` | ✅ | ✅ Working | Set in backend/.env |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ⚠️ Remote only | Set in Vercel env vars; never committed |

---

## 2. Checklist by Category

### 01 · Databases & Data
| # | Item | Status | Notes |
|---|------|--------|-------|
| 01 | Separate dev/prod databases | ❌ | Single Supabase project used for everything |
| 02 | Soft deletes only | ❌ | Hard DELETE on rounds, sessions, questions |
| 03 | Automated daily backups | ⚠️ | Supabase built-in backups (plan-dependent) |
| 04 | Test backup restore | ➖ | Operational task |
| 05 | `created_at`/`updated_at`/`created_by` on all tables | ⚠️ | `created_at` present on all; `updated_at` only on users/rounds; `created_by` missing everywhere |
| 06 | UUIDs for user-facing IDs | ✅ | All tables use `gen_random_uuid()` |
| 07 | Indexes on filtered/sorted columns | ✅ | All key columns indexed in migration |
| 08 | Schema changes via migration files | ✅ | `supabase/migrations/` committed to git |

### 02 · Secrets & Access
| # | Item | Status | Notes |
|---|------|--------|-------|
| 09 | No API keys in agent chat | ✅ | Service role key never exposed; anon key is public-safe |
| 10 | Rotate creds before go-live | ⚠️ | Anon key was in .env.example in git history — rotate before production |
| 11 | Separate dev/prod API keys | ❌ | Single Supabase project; no staging environment |
| 12 | `.env` in `.gitignore` | ✅ | `.env` gitignored; no service key in git history |

### 03 · Authentication & Authorization
| # | Item | Status | Notes |
|---|------|--------|-------|
| 13 | Don't roll your own auth | ✅ | Supabase Auth (Google OAuth + magic link) |
| 14 | IDOR protection on protected pages | ✅ | Admin routes verify token + DB role; test routes verify session_token + round match |
| 15 | Secure session cookies | ➖ | JWT in localStorage (Supabase pattern); no session cookies used |
| 16 | Re-auth for destructive actions | ❌ | Delete round/session requires no re-authentication |

### 04 · Admin Panel & Internal Tools
| # | Item | Status | Notes |
|---|------|--------|-------|
| 17 | Admin panel with one-click DB export | ✅ | CSV export (all / finalized) in round detail page |
| 18 | Admin behind own login; non-obvious path; 2FA | ⚠️ | Role-gated login exists; `/admin/` path is guessable; no 2FA |
| 19 | Admin role = DB flag | ✅ | `role='admin'` checked in DB via `requireAdmin` middleware |
| 20 | Log every admin action to audit log | ✅ | **FIXED** — publish/unpublish/pause/disqualify/delete-session now logged |
| 21 | Separate staging admin account | ❌ | Operational — needs a second Supabase project |

### 05 · User Input & Validation
| # | Item | Status | Notes |
|---|------|--------|-------|
| 22 | Validate everything server-side | ✅ | **FIXED** — email format, name/email/college/roll_no length limits added to /register |
| 23 | File upload size/type limits | ➖ | No file uploads |
| 24 | Rate-limit sensitive endpoints | ✅ | **FIXED** — /register now limited to 15 req/min per IP (global: 200/min) |
| 25 | Sanitize user content shown to others (XSS) | ✅ | `escHtml()` used consistently in all admin views |

### 06 · Costs & Limits
| # | Item | Status | Notes |
|---|------|--------|-------|
| 26 | Hard spending limits on paid services | ➖ | No paid AI/cloud APIs in use |
| 27 | Cap LLM usage per user | ➖ | No LLM API calls |
| 28 | Audit loops hitting paid APIs | ➖ | N/A |
| 29 | Billing alert email/phone | ➖ | Operational |

### 07 · Deployment & Environments
| # | Item | Status | Notes |
|---|------|--------|-------|
| 30 | Three environments (local/staging/prod) | ❌ | Only local dev + Vercel prod |
| 31 | No debug/stack traces in production | ✅ | **FIXED** — global error handler prevents 500 stack trace leaks; logger at 'warn' |
| 32 | CORS restricted to own domain | ✅ | **FIXED** — CORS now reads `FRONTEND_URL` env var (comma-separated); defaults to localhost only |
| 33 | HTTPS everywhere | ✅ | Vercel provides HTTPS automatically |
| 34 | `/health` endpoint + uptime monitor | ⚠️ | `/api/health` exists; no uptime monitor (UptimeRobot/BetterStack) configured |
| 35 | SPF/DKIM/DMARC for sending domain | ➖ | No custom email sending domain |

### 08 · Logging & Observability
| # | Item | Status | Notes |
|---|------|--------|-------|
| 36 | Error logging service (Sentry etc.) | ❌ | No external error tracking configured |
| 37 | Never log PII | ✅ | Fastify logger at 'warn'; no request body logging |
| 38 | 30+ days of logs | ⚠️ | Vercel log retention limited (1h hobby / 3d pro); Supabase audit_logs table provides partial coverage |

### 09 · Code & Version Control
| # | Item | Status | Notes |
|---|------|--------|-------|
| 39 | Commit before every major agent change | ✅ | Consistent commit history throughout development |
| 40 | Read diff before accepting | ✅ | Done throughout |
| 41 | Plain-English docs describing the app | ✅ | README.md, scope.md, specifications.md all present |
| 42 | Human review for payments/auth/sensitive data | ➖ | No payment processing |

### 10 · Legal & Compliance
| # | Item | Status | Notes |
|---|------|--------|-------|
| 43 | Privacy Policy before collecting user email | ✅ | **FIXED** — data-use notice added to entry/registration page |
| 44 | Know applicable privacy laws | ⚠️ | India DPDP applies (name, email, roll_no, college collected). Legal review needed before broader rollout. |
| 45 | "Delete my account" feature | ❌ | Admin can delete sessions; candidates cannot self-delete. Needed for compliance. |
| 46 | Cookie consent banner | ➖ | Only essential/session storage used; no analytics or tracking cookies |

### 11 · Operational Hygiene
| # | Item | Status | Notes |
|---|------|--------|-------|
| 47 | Document disaster recovery steps | ❌ | Not documented |
| 48 | Maintenance mode (no redeploy needed) | ✅ | **FIXED** — `MAINTENANCE_MODE=true` env var returns 503 on all API requests |
| 49 | Alerts for error spikes / server down | ❌ | No alerting configured |
| 50 | Team access to infrastructure | ❌ | Operational — share Vercel + Supabase access with at least one other person |

---

## 3. Summary

| Status | Count |
|--------|-------|
| ✅ Pass | 19 |
| ❌ Fail | 11 |
| ⚠️ Partial | 7 |
| ➖ N/A | 13 |

---

## 4. Fixed This Session

| Fix | Files Changed |
|-----|---------------|
| CORS restricted — no longer defaults to `*` | `backend/app.js` |
| Global error handler — 500s don't leak stack traces | `backend/app.js` |
| Maintenance mode via `MAINTENANCE_MODE=true` env var | `backend/app.js` |
| Input validation on /register — email format, length limits | `backend/routes/test/register.js` |
| Rate limit on /register — 15 req/min per IP | `backend/routes/test/register.js` |
| Admin audit log — publish/unpublish/pause round | `backend/routes/admin/rounds.js` |
| Admin audit log — disqualify + delete session | `backend/routes/admin/sessions.js` |
| Privacy/data-use notice on registration page | `frontend/test/entry.html` |
| `.env.example` cleaned — real keys removed, docs improved | `backend/.env.example` |

---

## 5. Next Priority Fixes (ordered by risk)

| Priority | Item | Action |
|----------|------|--------|
| 🔴 HIGH | Item 11/30 — No staging environment | Create a second Supabase project for dev; use separate Vercel preview env |
| 🔴 HIGH | Item 10 — Rotate Supabase anon key | The key was hardcoded in `.env.example` in git history — rotate in Supabase dashboard before public launch |
| 🔴 HIGH | Item 36 — No error tracking | Add Sentry (free tier): `npm i @sentry/node` + `Sentry.init()` in `server.js` |
| 🟡 MED | Item 02 — Hard deletes | Add `deleted_at TIMESTAMPTZ` to rounds/questions/sessions; filter `WHERE deleted_at IS NULL` |
| 🟡 MED | Item 45 — No self-delete for candidates | Add `DELETE /api/test/session/:id` that anonymises candidate PII (name/email → "deleted") |
| 🟡 MED | Item 34 — No uptime monitor | Register on UptimeRobot (free) pointing at `https://your-app.vercel.app/api/health` |
| 🟡 MED | Item 44 — DPDP compliance | Legal review; add a proper privacy policy page before broader rollout |
| 🟢 LOW | Item 05 — Missing `updated_at` on tables | Add `updated_at` + trigger to test_cases, submissions, candidate_sessions via new migration |
| 🟢 LOW | Item 18 — 2FA for admin | Enable "MFA Required" in Supabase Auth settings for admin accounts |
| 🟢 LOW | Item 47 — Disaster recovery docs | Document: (1) DB restore from Supabase backup, (2) env var loss recovery, (3) Vercel rollback steps |
