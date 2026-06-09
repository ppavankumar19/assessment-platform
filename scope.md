# CodeAssess — Project Scope

> Defines what the platform will and will not do, sets milestone targets, establishes acceptance criteria, and documents performance, accessibility, and compliance goals.

---

## Table of Contents

1. [In-Scope vs Out-of-Scope](#1-in-scope-vs-out-of-scope)
2. [MVP Milestones](#2-mvp-milestones)
3. [Feature Prioritization](#3-feature-prioritization)
4. [Acceptance Criteria](#4-acceptance-criteria)
5. [Performance Goals](#5-performance-goals)
6. [Accessibility Goals](#6-accessibility-goals)
7. [Compliance Goals](#7-compliance-goals)
8. [Assumptions & Constraints](#8-assumptions--constraints)

---

## 1. In-Scope vs Out-of-Scope

### In-Scope (MVP and beyond)

#### Authentication & Access
- Supabase Auth: Google OAuth + Magic Link login
- Invitation-gated candidate access (email-based)
- Admin role provisioned via bootstrap token
- JWT session management with Supabase RLS

#### Admin Panel
- Round management: create, edit, delete, publish, pause
- Question management: C snippet output questions (Round 1), multi-language coding questions (Round 2)
- Test case editor per question (visible + hidden cases)
- Bulk candidate invitation via email list / CSV upload
- Live session monitoring dashboard (status, violations, time remaining)
- Submission viewer: code, stdout/stderr, score, speed metrics, audit log
- Results export: CSV and PDF per round
- Manual disqualification with audit trail

#### Candidate Portal
- Instructions and round entry page
- Fullscreen-enforced assessment session
- **Round 1:** Read C code snippets, type predicted output, auto-graded
- **Round 2:** Monaco editor, run code against visible test cases, final submission
- Per-question countdown display (session-level timer)
- Anti-cheat event logging (fullscreen, tab switch, paste, copy)
- Auto-submit on timer expiry
- Post-round read-only submission review (admin-controlled release)

#### Code Execution
- Judge0 CE (self-hosted, Docker/Fly.io)
- Supported languages: C, C++, Python 3, JavaScript (Node), Java, Go
- Per-submission isolation via `isolate`
- CPU, memory, and wall-time limits per question

#### Speed & Behavioral Metrics
- Total keystrokes, paste count, delete count
- Time to first keystroke per question
- Active vs idle time breakdown
- Characters per minute and WPM equivalent
- Stored per submission; visible to admins only

#### Security & Audit
- Full audit log per session (all anti-cheat events)
- RLS-enforced data isolation between candidates
- Secure invitation tokens (HMAC-signed, expiring)
- Rate limiting on code execution endpoint
- OWASP Top 10 mitigations

#### Infrastructure
- Vercel deployment (Next.js)
- Supabase Cloud (auth, database, edge functions, storage)
- Fly.io deployment (Judge0)
- GitHub Actions CI/CD (lint, test, deploy)
- Sentry error monitoring

---

### Out-of-Scope (V1 / Post-MVP)

| Item | Reason / Future Consideration |
|------|-------------------------------|
| **Video proctoring** | Privacy complexity, infra cost; candidate-facing webcam recording is V2 |
| **AI-based plagiarism detection** | Requires ML pipeline; flagged as V2 |
| **Collaborative coding** | Not a recruitment use case for this platform |
| **Custom IDE plugins** | Browser-based Monaco editor is sufficient for MVP |
| **Mobile-responsive candidate portal** | Fullscreen API is unreliable on mobile; desktop-only for assessments |
| **Third-party ATS integration** (Greenhouse, Lever) | API integration post-GA |
| **Candidate self-registration** | All access is invitation-gated; self-sign-up out of scope |
| **Dynamic question randomization** | Fixed question sets per round for V1 |
| **Voice/audio recording** | Privacy and infra out of scope |
| **Whiteboard / diagram tools** | Text-based coding only for V1 |
| **Multi-tenant / SaaS billing** | Single-org deployment; multi-tenancy is post-MVP |
| **SAML / SSO enterprise auth** | Google OAuth covers initial needs; SAML is V2 |
| **Custom branding per round** | Global branding only for V1 |
| **Automated resume parsing** | Candidate profiles are minimal (name + email) |
| **Real-time collaborative review** | Admins review asynchronously; live co-review is V2 |

---

## 2. MVP Milestones

> **Project Start: Week of 16 June 2026**
> All dates are Monday of the target completion week.

### Milestone 0 — Project Setup (by 23 June 2026)

| Task | Owner | Done When |
|------|-------|-----------|
| Repository created, branch strategy documented | Tech Lead | Repo visible, CI runs on push |
| Supabase project provisioned (dev + prod) | Backend | Projects exist, .env.example complete |
| Judge0 deployed to Fly.io (staging) | DevOps | `/api/execute` returns result for "Hello, World" in Python |
| Next.js scaffold with Supabase Auth | Frontend | Login page works; redirect on auth |
| Database migrations: all tables + enums | Backend | `supabase db push` succeeds; Supabase Studio shows schema |
| CI pipeline: lint + test + build | Tech Lead | GitHub Actions green on PR |

### Milestone 1 — Admin Core (by 14 July 2026)

| Feature | Acceptance Criteria |
|---------|---------------------|
| Round CRUD | Admin can create, edit, delete, and publish a round from the dashboard |
| Question editor (R1) | Admin can add a C snippet question with expected output; question saved to DB |
| Question editor (R2) | Admin can add a coding question with visible + hidden test cases |
| Candidate invitation | Admin uploads email list; invitations saved; magic link email sends |
| Admin auth guard | Non-admin users are redirected to `/403` when accessing `/admin/*` |

### Milestone 2 — Candidate Portal + Round 1 (by 4 August 2026) ← **MVP**

| Feature | Acceptance Criteria |
|---------|---------------------|
| Session start | Candidate redeems invitation, session is created, fullscreen enforced |
| Round 1 flow | Candidate sees C snippet, types predicted output, submits, gets score |
| Auto-grading | Score computed server-side using normalized string comparison |
| Timer | Countdown displays correctly; auto-submits all unanswered questions on expiry |
| Anti-cheat logging | Fullscreen exit and tab switch events written to `audit_logs` |
| Session heartbeat | Server detects dead sessions within 90 seconds and marks `timed_out` |
| Admin monitoring | Admin sees live session list with status and violation count |

> **MVP Definition:** A real recruitment round can be conducted end-to-end using only Round 1 features with full admin oversight.

### Milestone 3 — Round 2: Live Coding (by 1 September 2026)

| Feature | Acceptance Criteria |
|---------|---------------------|
| Monaco editor | Editor loads for Round 2; language selector works; syntax highlighting correct |
| Run (non-final) | Code executes against visible test cases; result displayed within 5 s (p95) |
| Final submit | Code runs against all test cases (including hidden); score computed and stored |
| Speed metrics | All metric fields captured per submission; viewable in admin submission detail |
| Multi-language support | C, C++, Python 3, JS, Java, Go all execute correctly |
| Paste detection | Paste events counted; logged to audit; viewable per session in admin |

### Milestone 4 — Hardening & Export (by 22 September 2026)

| Feature | Acceptance Criteria |
|---------|---------------------|
| Results export (CSV) | Admin can download a CSV with all submissions, scores, and metrics per round |
| Results export (PDF) | Admin can download a formatted PDF summary per round |
| Audit log viewer | Admin can browse the full event timeline for any session |
| Disqualification | Admin can disqualify a session with a reason; candidate is locked out |
| OWASP ZAP scan | Zero high or critical findings against staging environment |
| Load test | 100 concurrent candidate sessions sustain without error rate > 0.1 % |
| WCAG 2.1 AA audit | Automated scan (axe-core) passes on all admin and candidate pages |

### Milestone 5 — General Availability (by 6 October 2026)

| Task | Criteria |
|------|---------|
| Production deploy | App live on `codeassess.yourorg.com` |
| Runbook complete | On-call team has incident playbook |
| Monitoring alerts | Sentry + Uptime alerts configured; on-call paged on error spike |
| Stakeholder demo | End-to-end demo with HR and Engineering leadership signed off |
| Documentation | README, implementation.md, scope.md, specifications.md published in repo |

---

## 3. Feature Prioritization

### Priority Tiers (MoSCoW)

#### Must-Have (MVP — Milestones 0–2)
- Admin: round creation, question editor, candidate invitation, publish/pause
- Candidate: invitation-gated login, Round 1 flow, session timer, auto-submit
- Anti-cheat: fullscreen enforcement, fullscreen + tab-switch audit logging
- Admin: live session monitor, violation count visibility
- Infrastructure: Supabase Auth, PostgreSQL RLS, Judge0 sandbox, CI/CD

#### Should-Have (Milestone 3)
- Round 2: Monaco editor, multi-language code execution, test case running
- Speed metrics: keystroke tracking, paste detection, CPM/WPM computation
- Submission viewer with code + metrics in admin

#### Could-Have (Milestone 4)
- Results export (CSV / PDF)
- Audit log browser with event timeline
- Admin disqualification with reason
- DevTools detection heuristic
- Email notifications on session complete

#### Won't-Have (V1)
- Video proctoring, AI plagiarism detection, ATS integration, mobile portal,
  multi-tenancy, SAML SSO, custom branding, collaborative review
  (see [Out-of-Scope](#out-of-scope-v1--post-mvp))

---

## 4. Acceptance Criteria

### AC-01: Admin Creates and Publishes a Round

**Given** the user is logged in as admin  
**When** they fill out the round creation form and click Publish  
**Then**
- Round appears in the round list with status "Active"
- Invited candidates can see the round on their dashboard
- Non-invited candidates cannot see the round
- Round details are saved correctly in `rounds` table

### AC-02: Candidate Starts a Session

**Given** a candidate has received a magic link invitation  
**When** they click the link, log in, and click "Begin Assessment"  
**Then**
- Browser enters fullscreen mode
- A `candidate_sessions` row is created with `status='started'`
- `audit_logs` records `session_start`
- The candidate sees the first question and a running countdown

### AC-03: Fullscreen Exit is Logged

**Given** the candidate is in an active fullscreen session  
**When** they press Escape or otherwise exit fullscreen  
**Then**
- `audit_logs` records `fullscreen_exit` with timestamp
- `candidate_sessions.fullscreen_violations` increments by 1
- Admin's live monitor shows updated violation count within 3 seconds (Realtime)
- Candidate sees a warning overlay prompting them to re-enter fullscreen

### AC-04: Round 1 Answer is Auto-Graded

**Given** the candidate submits a predicted output for a C snippet  
**When** the submission is processed  
**Then**
- Comparison is normalized (trim, case-insensitive, line-ending normalized)
- `submissions.score` is set to `question.points` if correct, `0` if not
- `submissions.status` is `accepted` or `wrong_answer`
- Speed metrics are stored in `speed_metrics`
- Response returns within 500 ms

### AC-05: Round 2 Code Executes Correctly

**Given** the candidate writes Python code and clicks Run  
**When** Judge0 processes the submission  
**Then**
- Visible test case results are displayed within 5 s (p95)
- stdout and stderr are shown in the output panel
- Execution time and memory usage are displayed
- Hidden test cases are NOT revealed during Run (only on final Submit)

### AC-06: Session Auto-Submits on Timer Expiry

**Given** the candidate's session timer reaches zero  
**When** the timer fires (client) or the server cron detects expiry  
**Then**
- All open (non-final) submissions for the session are marked `is_final=true`
- `candidate_sessions.status` is set to `timed_out`
- Candidate is redirected to a "Time's Up" confirmation page
- Admin monitoring dashboard updates status within 90 seconds

### AC-07: Admin Views Submission Detail

**Given** the admin selects a completed session  
**When** they open a submission  
**Then**
- They see: submitted code, language, stdout, stderr, compile output
- Score breakdown per test case is visible
- Speed metrics (CPM, WPM, paste count, idle periods) are displayed
- Full audit event timeline for the session is accessible

### AC-08: RLS Isolates Candidate Data

**Given** two candidates (A and B) are in the same round  
**When** candidate A makes a direct Supabase API call with their JWT  
**Then**
- They cannot read candidate B's `submissions` rows
- They cannot read candidate B's `candidate_sessions` row
- They cannot read `speed_metrics` for any submission
- They cannot read `audit_logs`

### AC-09: Results Export

**Given** the admin opens a completed round  
**When** they click "Export CSV"  
**Then**
- A CSV downloads with columns: candidate email, question title, score, status, CPM, paste count, submission time
- All candidates in the round are included
- Hidden test case results are included in admin export

---

## 5. Performance Goals

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| LCP (Largest Contentful Paint) | < 2.0 s | Vercel Web Analytics / Lighthouse |
| API P50 response time | < 150 ms | Vercel Function logs |
| API P95 response time | < 400 ms | Vercel Function logs |
| API P99 response time | < 800 ms | Vercel Function logs |
| Code execution round-trip (P95) | < 5 s | Custom metric: submit → result |
| Concurrent sessions without degradation | 100 | K6 load test (see below) |
| Supabase Realtime event latency | < 500 ms | Manual timing in admin dashboard |
| Session heartbeat response | < 200 ms | API logs |
| Judge0 cold start | < 2 s | Fly.io metrics; keep at least 1 machine warm |

**Load Test Scenario (K6):**
```
Ramp to 100 virtual users over 2 min
Each VU: start session → submit 5 Round 1 answers → complete session
Duration: 10 min sustained
Success criteria:
  - Error rate < 0.1%
  - P95 end-to-end session time < 60 s
  - No DB connection pool exhaustion
```

---

## 6. Accessibility Goals

| Requirement | Standard | Tool |
|-------------|----------|------|
| Keyboard navigation — all interactive elements | WCAG 2.1 AA (2.1.1) | Manual + axe-core |
| Color contrast — text on background | WCAG 2.1 AA (1.4.3) ≥ 4.5:1 | axe-core, Colour Contrast Analyser |
| Focus indicators visible | WCAG 2.1 AA (2.4.7) | Manual |
| Form labels and error messages | WCAG 2.1 AA (1.3.1, 3.3.1) | axe-core |
| Timer announces changes (ARIA live region) | WCAG 2.1 AA (4.1.3) | Screen reader test (NVDA/VoiceOver) |
| Monaco editor keyboard accessibility | Best-effort (Monaco limitation) | Document workaround in help text |
| ARIA roles on dynamic content | WCAG 2.1 AA (4.1.2) | axe-core |

**Note on Monaco Editor:** The Monaco editor has known accessibility limitations. The platform must provide a plain `<textarea>` fallback for users who cannot use Monaco, with a clear toggle. This does not affect grading.

---

## 7. Compliance Goals

### GDPR (applicable if serving EU candidates)

| Obligation | Implementation |
|------------|---------------|
| Lawful basis | Consent collected at invitation acceptance; documented in privacy notice |
| Data minimization | Only name, email, and assessment data stored — no unnecessary PII |
| Right to access | Admin can export candidate's own data on request |
| Right to erasure | `DELETE /api/admin/candidates/:id` removes all rows; documented in runbook |
| Data retention | Auto-delete audit logs after 90 days; configurable |
| Sub-processor disclosure | Supabase (EU region), Vercel, Fly.io listed in Data Processing Agreement |
| Breach notification | Sentry alerts trigger 72-hour reporting window in runbook |

### General Security Compliance

| Standard | Scope |
|----------|-------|
| OWASP Top 10 | Mitigated in implementation (see implementation.md §4) |
| TLS 1.3 | Enforced by Vercel and Fly.io |
| Secrets management | No secrets in source code; all via env vars / Vercel secrets |
| Dependency scanning | Dependabot + `npm audit` in CI |

---

## 8. Assumptions & Constraints

| Item | Detail |
|------|--------|
| **Auth provider** | Supabase Auth is the sole auth provider; no custom auth server |
| **Database** | Supabase PostgreSQL; no additional database (Redis, etc.) for MVP |
| **Code execution** | Judge0 CE self-hosted; no fallback to third-party Judge0 API in production (vendor lock avoidance) |
| **Sandboxing approach** | `isolate` within Judge0; no additional VM-level isolation for MVP |
| **Browser requirement** | Candidates must use Chrome 110+, Firefox 115+, or Edge 110+; fullscreen API required |
| **Network** | Candidates assumed to have stable broadband; no offline mode |
| **Language runtimes** | Fixed set (C, C++, Python 3, JS, Java, Go); adding more requires Judge0 image rebuild |
| **Team size** | 3–5 engineers (1 full-stack lead, 1–2 frontend, 1 backend/infra) |
| **Deployment model** | Cloud-hosted (Vercel + Supabase Cloud + Fly.io); no on-premise for V1 |
| **Assessment scale** | Up to 100 concurrent candidates; above this requires Judge0 horizontal scaling |
| **Admin count** | Small number of admins (< 20); no admin permission tiers in V1 |
| **Email delivery** | Supabase SMTP for magic links and invitations; custom SMTP recommended for production > 100 emails/hour |
