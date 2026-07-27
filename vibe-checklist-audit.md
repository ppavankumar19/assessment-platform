# Vibe Checklist Audit — Assessment Platform
> Phase 2 (Post-Refactor) · Audited: 2026-07-27

---

## 1. API Key Status

| Key | Present | Status | Notes |
|-----|---------|--------|-------|
| `SUPABASE_URL` | ✅ | ✅ Working | Set in `backend/.env` |
| `SUPABASE_ANON_KEY` | ✅ | ✅ Working | Set in `backend/.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ⚠️ Remote only | Set in Render env vars; never committed |

---

## 2. Checklist by Category

### 01 · Databases & Data
| # | Item | Status | Notes |
|---|------|--------|-------|
| 01 | Separate dev/prod databases | ❌ | Single Supabase project for dev and prod |
| 02 | Soft deletes only | ❌ | Hard DELETE on rounds, sessions, questions; no `deleted_at` column |
| 03 | Automated daily backups stored outside hosting provider | ⚠️ | Supabase built-in backups (plan-dependent; free = daily, pro = PITR) |
| 04 | Test restoring a backup at least once | ❌ | Operational — not yet tested |
| 05 | `created_at`/`updated_at`/`created_by`/`updated_by` on all tables | ⚠️ | `created_at` present on all; `updated_at` only on `users` and `rounds`; `created_by` missing everywhere |
| 06 | UUIDs instead of sequential IDs for user-facing entities | ✅ | All tables use `gen_random_uuid()` |
| 07 | Indexes on every filtered/sorted/joined column | ✅ | Migration `00007_performance_indexes.sql` adds key indexes |
| 08 | Schema changes via migration files committed to git | ✅ | `supabase/migrations/` — 8 migration files committed |

### 02 · Secrets & Access
| # | Item | Status | Notes |
|---|------|--------|-------|
| 09 | No API keys/passwords pasted into agent chat | ✅ | Service role key never exposed in chat; anon key is public-safe |
| 10 | Rotate every credential the agent has seen before going live | ⚠️ | Rotate before first production assessment with real candidates |
| 11 | Separate dev/prod API keys | ❌ | Single Supabase project; same keys for dev and prod |
| 12 | `.env` in `.gitignore`; search git history for leaked secrets | ✅ | `.env` and `backend/.env` gitignored; `.env.example` has only placeholders |

### 03 · Authentication & Authorization
| # | Item | Status | Notes |
|---|------|--------|-------|
| 13 | Don't roll your own auth | ✅ | Supabase Auth (Google OAuth + Magic Link) |
| 14 | IDOR protection on every protected page | ✅ | Admin routes: token + DB role check; test routes: session_token + round match |
| 15 | Session cookies: Secure, HttpOnly, SameSite | ➖ | JWT in localStorage (Supabase pattern); no session cookies used |
| 16 | Re-auth for destructive actions | ❌ | Delete round/session/disqualify require no re-authentication |

### 04 · Admin Panel & Internal Tools
| # | Item | Status | Notes |
|---|------|--------|-------|
| 17 | Admin panel with one-click DB export | ✅ | CSV export (all / finalized) on round detail page |
| 18 | Admin behind own login; non-obvious path; ideally 2FA | ⚠️ | Role-gated login exists; `/admin/` path is guessable; no 2FA enforced |
| 19 | Admin role = DB flag | ✅ | `role='admin'` in `users` table; checked server-side via `requireAdmin` middleware |
| 20 | Log every admin action to append-only audit log | ✅ | publish/unpublish/pause/disqualify/delete-session all logged to `audit_logs` |
| 21 | Separate staging admin account | ❌ | Operational — single Supabase project; no staging environment |

### 05 · User Input & Validation
| # | Item | Status | Notes |
|---|------|--------|-------|
| 22 | Validate everything server-side | ✅ | Email format, name/email/college/roll_no/branch length limits on `/register`; event type whitelist on audit log |
| 23 | Cap file upload size; restrict file types | ➖ | No file uploads |
| 24 | Rate-limit: login, signup, and sensitive endpoints | ✅ | `/register` limited to 15 req/min per IP; global 200 req/min |
| 25 | Sanitize user-generated content shown to other users (XSS) | ✅ | `escHtml()` used consistently in all admin views |

### 06 · Costs & Limits
| # | Item | Status | Notes |
|---|------|--------|-------|
| 26 | Hard spending limits on every paid service | ➖ | No paid AI/cloud APIs in use |
| 27 | Cap LLM token usage per user | ➖ | No LLM API calls |
| 28 | Audit every loop that hits a paid API | ➖ | N/A |
| 29 | Billing alert email/phone | ➖ | Operational |

### 07 · Deployment & Environments
| # | Item | Status | Notes |
|---|------|--------|-------|
| 30 | Three environments (local / staging / production) | ❌ | Only local dev + Render production; no staging |
| 31 | Disable debug mode / stack traces / verbose errors in production | ✅ | Global error handler strips 500 stack traces; `LOG_LEVEL=warn` |
| 32 | CORS restricted to own domain | ✅ | `FRONTEND_URL` env var (comma-separated); defaults to localhost only |
| 33 | HTTPS everywhere | ✅ | Render provides TLS automatically on all deployments |
| 34 | `/health` endpoint + uptime monitor | ⚠️ | `/api/health` queries DB and returns status; no uptime monitor configured |
| 35 | SPF/DKIM/DMARC for sending domain | ➖ | No custom email sending domain |

### 08 · Logging & Observability
| # | Item | Status | Notes |
|---|------|--------|-------|
| 36 | Error logging to external service (Sentry, LogRocket) | ❌ | No external error tracking; errors visible only via Render log console |
| 37 | Never log passwords, card numbers, or PII | ✅ | Pino logger at 'warn'; no request body logging; PII not in log statements |
| 38 | Keep at least 30 days of logs | ⚠️ | Render log retention limited; `audit_logs` DB table provides partial coverage indefinitely |

### 09 · Code & Version Control
| # | Item | Status | Notes |
|---|------|--------|-------|
| 39 | Commit before every major agent change | ✅ | Consistent commit history throughout development |
| 40 | Read the diff before accepting | ✅ | Done throughout |
| 41 | Plain-English doc describing what the app does | ✅ | `README.md`, `scope.md`, `specifications.md`, `implementation.md` all present and current |
| 42 | Human review for payments/auth/sensitive data | ➖ | No payment processing |

### 10 · Legal & Compliance
| # | Item | Status | Notes |
|---|------|--------|-------|
| 43 | Privacy Policy before collecting user email | ✅ | Data-use notice added to registration page (`/test/entry.html`) |
| 44 | Know which privacy laws apply | ⚠️ | India DPDP applies (name, email, roll_no, college collected). Legal review needed before broader rollout. |
| 45 | "Delete my account" feature | ❌ | Admin can delete sessions; candidates cannot self-delete. Required for GDPR/DPDP compliance. |
| 46 | Cookie consent banner | ➖ | Only essential/session storage used; no analytics or tracking cookies |

### 11 · Operational Hygiene
| # | Item | Status | Notes |
|---|------|--------|-------|
| 47 | Document recovery steps for top 3 disasters | ✅ | **FIXED** — `DISASTER-RECOVERY.md` added (DB restore, env var loss, bad deployment) |
| 48 | Maintenance mode without redeploying | ✅ | `MAINTENANCE_MODE=true` env var returns 503 on all API requests |
| 49 | Email/SMS alerts for errors, spikes, server down | ❌ | No alerting configured; relies on manual log checking |
| 50 | Someone else can access hosting, database, domain, email | ❌ | Operational — share Render + Supabase access with at least one other person |

---

## 3. Summary

| Status | Count |
|--------|-------|
| ✅ Pass | 20 |
| ❌ Fail | 10 |
| ⚠️ Partial | 7 |
| ➖ N/A | 13 |

*+1 pass vs previous audit (item 47 — disaster recovery now documented)*

---

## 4. Fixed This Session (2026-07-27)

| Fix | Files Changed |
|-----|---------------|
| Disaster recovery procedures documented (item 47) | `DISASTER-RECOVERY.md` (new) |
| Launch readiness report created | `launch-readiness.md` (new) |
| Stale Vercel/Node 20 references corrected | `scope.md`, `implementation.md`, `readme.md` |
| Features tracker updated to reflect all shipped functionality | `features.md` |
| Unit tests for scoring module | `backend/test/scoring.test.js` (new) |

---

## 5. Next Priority Fixes (ordered by risk)

| Priority | Item | Action |
|----------|------|--------|
| 🔴 HIGH | Item 34 — No uptime monitor | Register free UptimeRobot monitor on `/api/health` (15 min) |
| 🔴 HIGH | Item 36 — No external error tracking | Add Sentry free tier: `npm i @sentry/node` + init in `server.js` |
| 🔴 HIGH | No tests | Unit tests for `scoring.js` added; next: integration tests for auth + submit routes |
| 🟡 MED | Item 10/11 — Rotate keys + add staging env | Rotate Supabase anon key; create second Supabase project for dev |
| 🟡 MED | Item 02 — Hard deletes | Add `deleted_at TIMESTAMPTZ` to rounds/questions/sessions; filter `WHERE deleted_at IS NULL` |
| 🟡 MED | Item 45 — No self-delete for candidates | Add anonymization endpoint for GDPR/DPDP compliance |
| 🟢 LOW | Item 05 — Missing `updated_at` | Add `updated_at` + trigger to test_cases, submissions, candidate_sessions via migration |
| 🟢 LOW | Item 18 — No 2FA for admin | Enable MFA Required in Supabase Auth dashboard settings |
| 🟢 LOW | Item 47 — Test backup restore | Run Supabase backup restore drill on a dev project |
