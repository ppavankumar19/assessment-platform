# Assessment Platform — Project Scope

> Defines what the platform does and does not do, establishes acceptance criteria, and documents performance, accessibility, and compliance goals.

---

## Table of Contents

1. [In-Scope vs Out-of-Scope](#1-in-scope-vs-out-of-scope)
2. [Feature Prioritization](#2-feature-prioritization)
3. [Acceptance Criteria](#3-acceptance-criteria)
4. [Performance Goals](#4-performance-goals)
5. [Accessibility Goals](#5-accessibility-goals)
6. [Compliance Goals](#6-compliance-goals)
7. [Assumptions & Constraints](#7-assumptions--constraints)

---

## 1. In-Scope vs Out-of-Scope

### In-Scope

#### Authentication & Access
- Supabase Auth: Google OAuth + Magic Link for admin login
- Session-token-based access for candidates (no Supabase auth required)
- Admin role enforced via `users.role` column, verified server-side on every request

#### Admin Panel
- Round management: create, edit, delete, publish, pause, unpublish
- Question management: coding and output-prediction questions
- Test case editor per question: visible and hidden cases, per-case points
- Cutoff score per round; export all or cutoff-filtered results as CSV
- Session management: view all candidate sessions, delete or disqualify
- Typing replay: per-question keystroke snapshots, paste markers, Monaco viewer
- Responsive dashboard, sidebar navigation

#### Candidate Portal
- Registration form (name, email, college, roll number, branch) — no invite required
- Rules and incognito mode confirmation page
- Fullscreen-enforced exam session with anti-cheat controls
- Monaco code editor with Python 3 execution via Pyodide (browser WebAssembly)
- Visible test case "Run" and final "Submit" with hidden test case scoring
- Timer countdown with auto-submit on expiry
- Completion and disqualification pages

#### Code Execution
- Pyodide WebAssembly in a Web Worker — Python 3.11 in the browser
- Zero server-side execution; no external sandbox service
- Test cases run client-side; results sent to server for scoring and storage
- 15-second timeout per execution; worker recovery on timeout

#### Speed & Behavioral Metrics
- Total keystrokes, paste count, delete count
- Time to first keystroke per question
- Active vs idle time breakdown
- Characters per minute and WPM equivalent
- Typing replay: code snapshots on load, every 10s, paste, run, submit

#### Security & Audit
- Full audit log per session (all anti-cheat events written to `audit_logs`)
- Auto-disqualification on tab switch, fullscreen exit, window blur
- Admin can manually disqualify from dashboard or typing playback page
- Rate limiting on all API endpoints (Fastify rate-limit plugin)
- CORS restricted to configured origin

#### Infrastructure
- Node.js + Fastify serving both API and static frontend
- Supabase Cloud (auth + database)
- Deploy on any VPS, Docker container, or behind Nginx

---

### Out-of-Scope

| Item | Reason / Future Consideration |
|------|-------------------------------|
| **Video proctoring** | Privacy complexity, infra cost; V2 |
| **AI plagiarism detection** | Requires ML pipeline; V2 |
| **Multi-language code execution** | Currently Python 3 only via Pyodide; adding more requires server-side sandbox or additional WASM runtimes |
| **Mobile-responsive candidate portal** | Fullscreen API is unreliable on mobile; desktop-only for assessments |
| **Third-party ATS integration** | Post-GA |
| **Dynamic question randomization** | Fixed question sets per round for V1 |
| **Multi-tenant / SaaS billing** | Single-org deployment for V1 |
| **SAML / SSO enterprise auth** | Google OAuth covers initial needs |
| **Custom branding per round** | Global branding only for V1 |
| **Real-time collaborative review** | Admins review asynchronously |
| **Offline mode** | Candidates require internet for Pyodide CDN load and API calls |
| **Bulk candidate invitation via CSV** | Candidates self-register; no invitation gate |

---

## 2. Feature Prioritization (MoSCoW)

### Must-Have
- Admin: round and question CRUD, publish/pause, session management
- Candidate: registration, exam flow, timer, auto-submit
- Anti-cheat: fullscreen enforcement, tab switch auto-disqualification
- Browser Python execution (Pyodide) with visible + hidden test cases
- Speed metrics capture and storage

### Should-Have
- Typing replay (keystroke snapshots, paste markers, playback slider)
- CSV export (all + cutoff-filtered)
- Remote disqualification by admin
- Cutoff score and filtered export

### Could-Have
- Admin audit log browser per session
- Email notifications on session completion
- Bulk operations on sessions (multi-select disqualify)

### Won't-Have (V1)
- Video proctoring, AI detection, ATS integration, mobile portal,
  multi-tenancy, SAML, multi-language execution beyond Python

---

## 3. Acceptance Criteria

### AC-01: Admin Creates and Publishes a Round
**Given** the user is logged in as admin
**When** they fill out the round form and click Publish
**Then**
- Round appears in dashboard with "Live" badge
- Candidates can see it on `/test/`
- Pausing sets it to "Paused"; unpublishing hides it from candidates

### AC-02: Candidate Registers and Starts Session
**Given** a round is published and active
**When** candidate fills in the registration form and clicks "Enter Exam"
**Then**
- A `candidate_sessions` row is created with `status='started'`
- `session_token` is stored in `localStorage`
- Browser enters fullscreen
- Candidate is redirected to the exam page

### AC-03: Fullscreen Exit Triggers Disqualification
**Given** the candidate is in an active fullscreen session
**When** they exit fullscreen (Escape or otherwise)
**Then**
- `audit_logs` records `fullscreen_exit`
- `candidate_sessions.status` is set to `disqualified`
- Session status polling detects the change within 10 seconds
- Candidate is redirected to the completion page

### AC-04: Code Runs and Scores Correctly (Pyodide)
**Given** the candidate writes Python code and clicks Run
**When** Pyodide executes it in the browser
**Then**
- Visible test case results shown within 5s
- stdout compared to expected output (normalized: trim + newlines)
- Pass/fail and timing shown per case

**Given** the candidate clicks Submit
**When** all test cases (including hidden) run via Pyodide
**Then**
- Results sent to `/api/test/submit`
- Score computed server-side from the results payload
- Submission stored in `submissions`; speed metrics in `speed_metrics`

### AC-05: Session Auto-Submits on Timer Expiry
**Given** the candidate's timer reaches zero
**Then**
- All unsubmitted questions are submitted without test results
- `/api/test/session/:id/complete` is called
- Candidate is redirected to completion page
- `candidate_sessions.status = 'completed'`

### AC-06: Admin Views Typing Replay
**Given** a session has completed submissions
**When** admin opens the playback page
**Then**
- Keystroke snapshots replay in Monaco editor
- Slider moves through snapshots chronologically
- Paste events are marked with yellow indicators
- Metrics (CPM, paste count, WPM) displayed in sidebar

### AC-07: CSV Export is Correct
**Given** a round has completed sessions
**When** admin clicks Export All
**Then**
- CSV downloads with Name, Email, College, RollNo, Branch, Status, Score, CompletedAt columns
- All candidates included
- "Export Finalized" filters to candidates whose score ≥ cutoff_score

---

## 4. Performance Goals

| Metric | Target | Method |
|--------|--------|--------|
| API p95 response time | < 200 ms | Server logs |
| Pyodide Python execution (p95) | < 5 s | Browser performance API |
| Static frontend LCP | < 1.5 s | Lighthouse / WebPageTest |
| Concurrent candidates (single $10 VPS) | 200+ without degradation | Load test (K6) |
| Concurrent candidates (Nginx + 3 Node instances) | 1000+ | Load test |
| Session status poll latency | < 10 s for disqualification to take effect | Manual test |

**Load Test Scenario (K6):**
```
Ramp to 200 virtual users over 2 minutes
Each VU: register → start session → submit 3 questions → complete
Duration: 10 min sustained
Success criteria:
  - Error rate < 0.1%
  - P95 end-to-end < 5 s
  - No DB connection pool exhaustion
```

---

## 5. Accessibility Goals

| Requirement | Standard |
|-------------|----------|
| Keyboard navigation — all interactive elements | WCAG 2.1 AA |
| Color contrast — text on background | ≥ 4.5:1 (WCAG 1.4.3) |
| Focus indicators visible | WCAG 2.4.7 |
| Form labels and error messages | WCAG 1.3.1, 3.3.1 |
| Monaco editor keyboard accessibility | Best-effort; documented limitation |

---

## 6. Compliance Goals

### GDPR (if serving EU candidates)

| Obligation | Implementation |
|------------|---------------|
| Data minimization | Only name, email, college, roll, branch, and assessment data stored |
| Right to erasure | `DELETE /api/admin/sessions/:id` removes all candidate data |
| Right to access | Admin can export candidate data via CSV export |
| Sub-processor disclosure | Supabase (EU region available), any VPS provider |

### Security

| Standard | Implementation |
|----------|---------------|
| OWASP Top 10 | No raw SQL; parameterized queries via Supabase SDK; rate limiting; CORS |
| TLS | Enforced by Nginx or Cloudflare in front of Fastify |
| Secrets management | `.env` file never committed; service role key server-side only |
| Dependency scanning | `npm audit` in CI |

---

## 7. Assumptions & Constraints

| Item | Detail |
|------|--------|
| **Auth provider** | Supabase Auth for admin; session tokens for candidates |
| **Database** | Supabase PostgreSQL; no additional database (Redis, etc.) |
| **Code execution** | Pyodide (browser WASM); Python 3 only; no server-side sandbox |
| **Browser requirement** | Chrome 110+, Firefox 115+, Edge 110+; fullscreen API required |
| **Network** | Candidates require internet for Pyodide CDN load (~10 MB first visit) |
| **Deployment model** | Any VPS or cloud VM; no platform lock-in |
| **Assessment scale** | 200+ concurrent candidates on a single server; scale by adding Node.js instances |
| **Admin count** | Small number of admins (< 20); single admin role, no permission tiers |
