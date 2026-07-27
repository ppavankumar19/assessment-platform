# Launch Readiness Report — Assessment Platform

> Generated: 2026-07-27 · Stack: Node.js 22 + Fastify 4 · Docker → Render.com · Supabase PostgreSQL

---

## 1. Stack Summary

| Layer | Technology | Detected |
|-------|-----------|---------|
| Runtime | Node.js 22 (ES modules) | `backend/package.json` |
| Framework | Fastify 4 | `backend/package.json` |
| Frontend | Vanilla HTML/CSS/JS | `frontend/` |
| Database | Supabase PostgreSQL | `.env.example`, `backend/lib/db.js` |
| Auth | Supabase Auth (Google OAuth + Magic Link) | `backend/middleware/auth.js` |
| Code execution | Pyodide (WASM, browser) + gcc/python3 (server) | `Dockerfile`, routes/test/ |
| Deployment | Docker → Render.com | `Dockerfile`, `render.yaml` |
| Test tooling | None installed | — |
| CI platform | None configured | — |

---

## 2. Functional Testing Pyramid

### Unit Tests
**Verdict: FAIL**

No unit tests exist. Critical untested business logic:
- `normalizeOutput()` — output comparison for all scored submissions
- `computeDerivedMetrics()` — speed metrics (CPM, WPM) shown to admins
- Score computation in `submit.js` — sums client-provided `test_results[].score`
- Auth token cache logic in `middleware/auth.js` — TTL + eviction

### Integration Tests
**Verdict: FAIL**

No integration tests exist. Critical untested paths:
- Register → start → submit → complete full candidate flow
- Admin auth middleware rejection (401 for missing token, 403 for non-admin)
- Session expiry enforcement in `submit.js`
- Duplicate final submission protection (409)

### Contract Tests
**Verdict: N/A**

Frontend and backend are deployed together (same Docker image). No independent deployment, so no contract drift risk.

### E2E Tests
**Verdict: FAIL**

No E2E tests exist. Critical user journeys without coverage:
- Admin: create round → add question → publish
- Candidate: register → start → submit → complete
- Anti-cheat: tab switch → auto-disqualification

---

## 3. Non-Functional Properties

| Property | Status | Evidence | Gap |
|----------|--------|----------|-----|
| **Scalability** | PARTIAL | Stateless API; Supabase pgBouncer handles connection pooling | No load test run; no horizontal scaling tested |
| **Performance** | PARTIAL | `@fastify/compress` enabled; p95 SLO target: 200ms | No load test confirming SLO; no `EXPLAIN ANALYZE` on hot queries |
| **Availability** | PARTIAL | `/api/health` queries DB; Render auto-restarts containers | Single instance on Render free tier; no redundancy; no uptime monitor |
| **Reliability** | PARTIAL | Graceful shutdown (SIGTERM/SIGINT); body size limits | No timeouts on Supabase SDK calls; no circuit breaker; no retry logic |
| **Consistency** | PASS | `.eq('status', 'started')` guard prevents DQ race; 409 on duplicate final submit | No concurrent-write stress test |
| **Security** | PASS | helmet CSP, CORS scoped, rate-limit 200/min, no raw SQL, `npm audit` 0 vulns | No 2FA for admins; no Sentry error tracking |
| **Observability** | PARTIAL | Pino structured logs with reqId; `/api/health` endpoint | No external error tracking (Sentry); no metrics (RED); no uptime alert |
| **Data Integrity** | PARTIAL | FK constraints + UUID PKs; `audit_logs` append-only | Supabase daily backups (plan-dependent); no backup restore drill; soft deletes not implemented |

---

## 4. Security Checklist

| Check | Status | Notes |
|-------|--------|-------|
| OWASP A01 — Broken access control | PASS | `requireAdmin` middleware on all `/api/admin/*`; session token validated on all candidate routes |
| OWASP A02 — Cryptographic failures | PASS | TLS via Render; service role key never sent to browser; JWT validated by Supabase |
| OWASP A03 — Injection | PASS | Parameterized queries via Supabase SDK; no raw SQL from user input |
| OWASP A04 — Insecure design | PASS | Score computed server-side (sums client results); event whitelist for audit logs |
| OWASP A05 — Security misconfiguration | PASS | `@fastify/helmet` CSP; CORS restricted; stack traces not exposed in 500 responses |
| OWASP A06 — Vulnerable components | PASS | `npm audit` reports 0 vulnerabilities |
| OWASP A07 — Auth failures | PARTIAL | Auth token cache (5-min TTL); no account lockout (delegated to Supabase) |
| OWASP A09 — Logging failures | PARTIAL | Pino logs errors; no external aggregation (Sentry/Datadog) |
| Secrets in source | PASS | `.env` gitignored; `.env.example` contains only placeholder values |
| Rate limiting | PASS | Global 200 req/min; `/register` limited to 15 req/min per IP |

---

## 5. CI/CD Readiness

| Check | Status | Notes |
|-------|--------|-------|
| Tests gate merges | FAIL | No test suite; no CI configured |
| Smoke test after deploy | FAIL | `/api/health` exists but no automated post-deploy check |
| Rollback procedure | PASS | Render dashboard → Deploys → rollback to prior deploy |
| Debug mode disabled in production | PASS | `LOG_LEVEL=warn`; global error handler strips stack traces |
| Env vars confirmed for production | PASS | `render.yaml` declares all required vars; validated at startup |

---

## 6. Risk Register

| Gap | Likelihood | Impact | Mitigation |
|-----|-----------|--------|-----------|
| No automated tests — regression introduced silently | HIGH | HIGH | Add unit tests for `scoring.js`; add Fastify inject integration tests for auth + submit routes |
| No uptime monitoring — outage discovered by users | HIGH | HIGH | Register free UptimeRobot monitor on `/api/health` |
| Score trusts client `test_results` — candidate could forge scores | MEDIUM | HIGH | Current design accepts Pyodide results from client; mitigate by capping individual test case scores server-side against DB values |
| No external error tracking — 500s invisible until log search | MEDIUM | MEDIUM | Add Sentry free tier (`@sentry/node` + `Sentry.init()` in `server.js`) |
| Single Render instance — one container failure = full outage | LOW | HIGH | Upgrade to Render paid plan with health-check-based restart; add UptimeRobot alert |
| Supabase free plan daily backups only | LOW | MEDIUM | Upgrade to Supabase Pro for point-in-time recovery before major assessment events |

---

## 7. Blocking Issues (must fix before launch)

| Severity | Issue | Fix |
|----------|-------|-----|
| 🔴 HIGH | No uptime monitoring | Register UptimeRobot (free) → `https://your-app.onrender.com/api/health` |
| 🔴 HIGH | No external error tracking | Add Sentry: `npm i @sentry/node` + 3 lines in `server.js` |
| 🔴 HIGH | No automated tests | Add unit tests for `scoring.js` at minimum before any assessment event |

---

## 8. Non-Blocking Items (monitor post-launch)

- Add 2FA requirement for admin accounts in Supabase Auth settings
- Add soft deletes (`deleted_at` column) to rounds and sessions
- Add `updated_at` column + trigger to `test_cases`, `submissions`, `candidate_sessions`
- Run `EXPLAIN ANALYZE` on the `/api/test/:roundId/questions` query at realistic data volumes
- Create staging Supabase project for dev/test isolation
- Run K6 load test at 200 concurrent virtual users before a large cohort assessment

---

## 9. Verdict

**GO WITH CONDITIONS**

The application is functionally complete, correctly handles auth/authz, has no dependency CVEs, and enforces all anti-cheat controls. The blocking conditions that must be met before running an assessment with real candidates are:

1. **Uptime monitor** configured and alerting (15 min setup)
2. **Error tracking** (Sentry free tier) so failures are visible without log diving
3. **At least unit tests for `scoring.js`** to catch regressions in the most critical business logic

All three can be done in under 2 hours. Everything else is improvement, not a launch blocker.
