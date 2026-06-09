# CodeAssess — Technical Specifications

> Precise functional and non-functional requirements, complete data schema, Swagger-like API specification, and UI/UX guidelines with wireframe descriptions.

---

## Table of Contents

1. [Functional Specification](#1-functional-specification)
2. [Non-Functional Specification](#2-non-functional-specification)
3. [Data Schema Definitions](#3-data-schema-definitions)
4. [API Specification](#4-api-specification)
5. [UI/UX Guidelines & Wireframe Descriptions](#5-uiux-guidelines--wireframe-descriptions)

---

## 1. Functional Specification

### 1.1 Authentication & Access Control

**FS-AUTH-01: Google OAuth Login**
- Users navigate to `/login`
- Click "Continue with Google" → Supabase OAuth flow → Google consent screen → redirect to `/api/auth/callback`
- On success: Supabase session created; user redirected based on role
  - `admin` → `/admin`
  - `candidate` → `/assess`
- On failure: redirect to `/login?error=oauth_failed`

**FS-AUTH-02: Magic Link Login**
- Users enter email on `/login`
- Supabase sends a one-time magic link email
- Clicking the link authenticates and redirects per role
- Link expires after 1 hour; expired links show `/login?error=link_expired`

**FS-AUTH-03: Admin Bootstrap**
- First admin is provisioned via `POST /api/auth/bootstrap` with a secret token (`ADMIN_BOOTSTRAP_TOKEN` env var)
- Only one bootstrap call is permitted; the endpoint disables itself after first use
- Subsequent admins are promoted via the database directly (or a future admin management UI)

**FS-AUTH-04: Invitation-Gated Access**
- Candidates receive an email with a unique magic link that includes an invitation token
- Clicking the link authenticates them AND pre-validates the invitation token
- If a candidate is authenticated but has no active invitation for a round, they see a "No active assessment" page
- Invitation tokens are single-use; once a session is started, the token status is set to `accepted`

---

### 1.2 Admin Panel

**FS-ADMIN-01: Round Management**

| Action | Behaviour |
|--------|-----------|
| Create Round | Form with: title, description, type (output_prediction / live_coding), duration_minutes, allowed_languages (R2 only), pass_score |
| Edit Round | Available only when round is NOT active; all fields editable |
| Publish Round | Sets `is_published=true`, `is_active=true`; broadcasts Realtime event |
| Pause Round | Sets `is_active=false`; running sessions continue but new starts blocked |
| Delete Round | Soft-delete only if no sessions exist; hard-delete not permitted if any submissions exist |
| Duplicate Round | Copies round + all questions; new round starts as draft |

**FS-ADMIN-02: Question Editor — Round 1 (Output Prediction)**

Fields:
- `sequence_order` (int): display order
- `title` (text, required): question heading
- `description` (text): optional markdown-formatted context
- `code_snippet` (text, required): raw C source code
- `expected_output` (text, required): exact expected stdout; newlines and whitespace significant
- `points` (int, default 10): score value

Validation:
- Code snippet must be non-empty
- Expected output must be non-empty
- Sequence order must be unique within a round

**FS-ADMIN-03: Question Editor — Round 2 (Live Coding)**

Fields:
- `sequence_order`, `title`, `description` — same as above
- `starter_code` (text): optional skeleton code provided to candidate
- `time_limit_s` (int, default 5): per-submission CPU time limit for Judge0
- `memory_limit_mb` (int, default 128): per-submission memory limit
- `points` (int, default 10): total points (distributed across test cases)
- `test_cases` (array): see test case spec below

Test Case Fields (per case):
- `id` (string): unique within question
- `input` (string): stdin fed to the program
- `expected_output` (string): expected stdout
- `is_hidden` (bool): hidden cases not shown during Run; visible during final submit scoring
- `points` (int): points awarded for this case

**FS-ADMIN-04: Candidate Invitation**

- Admin pastes emails (one per line) or uploads a CSV with an `email` column
- System validates email format; deduplicates; rejects already-invited addresses
- On submit:
  - `invitations` rows created with `status='pending'`, `expires_at = now() + 7 days`
  - Invitation email sent via Supabase Auth (magic link + invitation token in query param)
- Admin can view invitation status (pending / accepted / expired) per round
- Admin can resend or revoke individual invitations

**FS-ADMIN-05: Live Session Monitor**

Real-time table (Supabase Realtime subscription) showing:

| Column | Source |
|--------|--------|
| Candidate Name | `users.full_name` |
| Email | `users.email` |
| Status | `candidate_sessions.status` |
| Started At | `candidate_sessions.started_at` |
| Time Remaining | `expires_at - now()` (client-computed) |
| Fullscreen Violations | `candidate_sessions.fullscreen_violations` |
| Tab Switch Violations | `candidate_sessions.tab_switch_violations` |
| Questions Answered | Count of `submissions WHERE is_final=true` |
| Actions | [View] [Disqualify] |

Refresh: Realtime push (no polling required). Admin can click a row to open the Session Detail page.

**FS-ADMIN-06: Submission Viewer**

Shows per submission:
- Submitted code (syntax-highlighted, read-only Monaco or `<pre>`)
- Language
- Status badge (Accepted / Wrong Answer / TLE / etc.)
- Score: `X / Y points`
- Test case breakdown table: case ID, input (visible cases), expected vs actual output, pass/fail, time, memory
- Speed metrics panel: CPM, WPM, total keystrokes, paste count, delete count, idle breakdown
- Submission timestamp

**FS-ADMIN-07: Audit Log Viewer**

Timeline view (sorted ascending by `created_at`) for a session:
- Event type icon + label
- Timestamp (relative + absolute)
- Event data payload (expandable JSON)
- Colour coding: green = normal, yellow = warning, red = violation

**FS-ADMIN-08: Results Export**

CSV columns:
```
round_title, candidate_email, candidate_name, question_title, question_type,
submitted_code, language, status, score, max_points, cpm, wpm, paste_count,
delete_count, total_keystrokes, active_time_ms, fullscreen_violations,
tab_switch_violations, submitted_at, session_status
```

PDF: Summary table per candidate (total score, status, violation summary) + per-question breakdown.

---

### 1.3 Candidate Portal

**FS-CAND-01: Round Entry Page**

Displays:
- Round title and description
- Duration
- Number of questions (but not question details)
- Instructions (markdown-rendered)
- "Begin Assessment" button

On click:
1. Request fullscreen: `document.documentElement.requestFullscreen()`
2. If fullscreen granted → `POST /api/rounds/:id/start` → navigate to first question
3. If fullscreen denied → show error: "Fullscreen is required to begin the assessment. Please allow fullscreen access."

**FS-CAND-02: Round 1 — Output Prediction UI**

Per question:
- Question title and description
- C code snippet in a read-only, syntax-highlighted code block
- Text area: "Enter predicted output" (plain text, multiline)
- "Submit" button (greyed out if empty)
- Progress bar: `current question / total`
- Timer bar (countdown, colour shifts to red at < 5 minutes)

On submit:
- `POST /api/submissions` with `predicted_output` and speed metrics
- Immediately move to next question (score not revealed during round)
- Once all questions answered, show "Assessment Complete" screen

**FS-CAND-03: Round 2 — Live Coding UI**

Per question:
- Question title and problem statement (markdown rendered)
- Visible test cases table (input / expected output)
- Language selector (restricted to `round.allowed_languages`)
- Monaco editor (full-width, 400px min height, dark theme by default)
- "Run" button → executes against visible test cases only; shows result table
- "Submit" button (final) → executes against all test cases; cannot be undone
- Execution output panel: stdout, stderr, time, memory per test case
- Timer bar and progress indicator

Keyboard shortcuts:
- `Ctrl+Enter` / `Cmd+Enter` → Run
- `Ctrl+Shift+Enter` → Submit (requires confirmation dialog)

**FS-CAND-04: Timer Behaviour**

- Timer is session-level (not per-question)
- Displayed as: `mm:ss` remaining
- At 5:00 remaining: yellow warning banner "5 minutes remaining"
- At 1:00 remaining: red banner + audio ping (if browser allows)
- At 0:00:
  - Client: auto-submits current question if code/answer present; calls `POST /api/sessions/:id/complete`
  - Server (cron): catches any sessions that client failed to complete

**FS-CAND-05: Fullscreen Guard Behaviour**

| Event | Client Action | Server Action |
|-------|--------------|---------------|
| Fullscreen exit | Show overlay modal; prompt re-entry; log event | `POST /api/sessions/:id/events { type: 'fullscreen_exit' }` |
| Re-enter fullscreen | Dismiss modal | `POST /api/sessions/:id/events { type: 'fullscreen_enter' }` |
| 3rd violation | Show "Final Warning" modal | Server sets `fullscreen_violations++`; if ≥ threshold, auto-disqualify |
| Tab switch (hidden) | Log event; show brief banner on return | `POST /api/sessions/:id/events { type: 'tab_switch' }` |

Default thresholds (configurable per round by admin):
- `fullscreen_violation_limit`: 3 → disqualify
- `tab_switch_limit`: 5 → flag (no auto-disqualify; admin review)

**FS-CAND-06: Paste Detection**

- `paste` event on the editor container is captured
- `paste_count` incremented in client-side metric tracker
- Audit event `paste_detected` logged with character count (not content)
- High paste count relative to keystrokes is a signal for admin review; no automatic action

**FS-CAND-07: Post-Round Review**

- After admin toggles `round.results_released=true`, candidates can visit `/assess/:roundId/results`
- Shows per-question: their submitted answer/code, score, and overall session score
- Does NOT show: other candidates' scores, hidden test case details, speed metrics

---

### 1.4 Code Execution

**FS-EXEC-01: Language Support**

| Language | Judge0 ID | Extension | Compile Step |
|----------|----------|-----------|-------------|
| C (GCC 9.2) | 50 | `.c` | `gcc -o prog prog.c` |
| C++ (GCC 9.2) | 54 | `.cpp` | `g++ -o prog prog.cpp` |
| Python 3 (3.8) | 71 | `.py` | None |
| JavaScript (Node 12) | 63 | `.js` | None |
| Java (OpenJDK 13) | 62 | `.java` | `javac Main.java` |
| Go (1.13.5) | 60 | `.go` | `go build` |

**FS-EXEC-02: Execution Limits**

Default limits (overridable per question):

| Limit | Default | Maximum |
|-------|---------|---------|
| CPU time | 5 s | 15 s |
| Wall time | 10 s | 30 s |
| Memory | 128 MB | 512 MB |
| Stack size | 64 MB | 64 MB |
| Max output size | 512 KB | 2 MB |

**FS-EXEC-03: Run vs Submit**

| Action | Test Cases | Score | Limits | Can Repeat |
|--------|-----------|-------|--------|-----------|
| Run | Visible only | Not scored | Full limits | Yes (max 10/question/session) |
| Submit (final) | All (visible + hidden) | Scored | Full limits | No (one final per question) |

---

## 2. Non-Functional Specification

### 2.1 Reliability

| Requirement | Target |
|-------------|--------|
| Uptime (assessment hours) | ≥ 99.5% |
| Uptime (off-hours) | ≥ 99.0% |
| Recovery Time Objective (RTO) | < 30 min for P1 incidents |
| Recovery Point Objective (RPO) | < 1 hour (Supabase managed backups: daily) |
| Judge0 availability | Auto-restart on crash via Fly.io health checks; keep 1 machine always warm |
| Data durability | Supabase Cloud: daily snapshots + WAL archiving |

### 2.2 Latency Targets

| Operation | P50 | P95 | P99 |
|-----------|-----|-----|-----|
| Page load (LCP) | < 1.0 s | < 2.0 s | < 3.0 s |
| API: auth check | < 50 ms | < 150 ms | < 300 ms |
| API: round/question fetch | < 80 ms | < 200 ms | < 400 ms |
| API: submission create | < 100 ms | < 300 ms | < 500 ms |
| Code execution round-trip | < 2 s | < 5 s | < 8 s |
| Realtime event delivery | < 200 ms | < 500 ms | < 1 s |
| Results export generation | < 5 s | < 15 s | < 30 s |

### 2.3 Security Requirements

| Requirement | Implementation |
|-------------|---------------|
| Transport security | TLS 1.3; HSTS header; no HTTP |
| Authentication | Supabase JWT; verified server-side on every request |
| Authorisation | Row Level Security on all tables; role checked in every API route |
| Code sandbox escape | Judge0 `isolate`; no network in sandbox; seccomp |
| Input validation | Zod schemas on all API request bodies |
| CSRF protection | Supabase auth cookies are SameSite=Strict |
| Rate limiting | `/api/execute`: 10 req/min per user (Vercel Edge Middleware) |
| XSS | Next.js JSX escaping; CSP header restricts inline scripts |
| Secrets | Never in source code; env vars only; Vercel/Supabase secrets management |
| Dependency security | Dependabot + `npm audit` in CI; block on high severity |

### 2.4 Scalability

| Dimension | V1 Target | Scaling Path |
|-----------|-----------|-------------|
| Concurrent candidate sessions | 100 | Vercel auto-scales functions; Judge0 horizontal scaling on Fly.io |
| Database connections | Supabase default pool (60 conns) | PgBouncer if needed |
| Realtime subscriptions | Up to 200 concurrent | Supabase Realtime auto-scales |
| Storage | 10 GB (reports + assets) | Supabase Storage auto-scales |
| Rounds per organization | Unlimited | No architectural limit |

### 2.5 Maintainability

- TypeScript strict mode throughout
- ESLint + Prettier enforced in CI
- `supabase gen types typescript` regenerates DB types on every migration
- All environment-specific configuration in env vars; zero hardcoding
- Database changes via numbered migration files only; no manual SQL in production
- All API routes follow the same pattern: validate JWT → check role → validate body (Zod) → execute → return

---

## 3. Data Schema Definitions

### 3.1 Full SQL Schema

```sql
-- ─── Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ─────────────────────────────────────────────────────────────────
CREATE TYPE user_role         AS ENUM ('admin', 'candidate');
CREATE TYPE round_type        AS ENUM ('output_prediction', 'live_coding');
CREATE TYPE question_type     AS ENUM ('output_prediction', 'coding');
CREATE TYPE session_status    AS ENUM ('invited', 'started', 'completed',
                                        'timed_out', 'disqualified');
CREATE TYPE submission_status AS ENUM ('pending', 'running', 'accepted',
                                        'wrong_answer', 'time_limit_exceeded',
                                        'memory_limit_exceeded', 'runtime_error',
                                        'compile_error', 'internal_error');
CREATE TYPE invite_status     AS ENUM ('pending', 'accepted', 'expired');
CREATE TYPE audit_event_type  AS ENUM ('session_start', 'session_end',
                                        'fullscreen_exit', 'fullscreen_enter',
                                        'tab_switch', 'paste_detected',
                                        'copy_detected', 'submission',
                                        'disqualified', 'admin_action');

-- ─── users ─────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT,
  role        user_role NOT NULL DEFAULT 'candidate',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── rounds ────────────────────────────────────────────────────────────────
CREATE TABLE rounds (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                        TEXT NOT NULL,
  description                  TEXT,
  type                         round_type NOT NULL,
  duration_minutes             INT NOT NULL CHECK (duration_minutes > 0),
  allowed_languages            INT[],          -- Judge0 language IDs
  pass_score                   INT NOT NULL DEFAULT 0,
  fullscreen_violation_limit   INT NOT NULL DEFAULT 3,
  tab_switch_limit             INT NOT NULL DEFAULT 5,
  is_published                 BOOLEAN NOT NULL DEFAULT FALSE,
  is_active                    BOOLEAN NOT NULL DEFAULT FALSE,
  results_released             BOOLEAN NOT NULL DEFAULT FALSE,
  created_by                   UUID NOT NULL REFERENCES users(id),
  starts_at                    TIMESTAMPTZ,
  ends_at                      TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── questions ─────────────────────────────────────────────────────────────
CREATE TABLE questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id         UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  sequence_order   INT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  type             question_type NOT NULL,
  code_snippet     TEXT,          -- Round 1: C code to read
  expected_output  TEXT,          -- Round 1: correct answer
  starter_code     TEXT,          -- Round 2: optional skeleton
  test_cases       JSONB,         -- Round 2: array of test case objects
  time_limit_s     INT NOT NULL DEFAULT 5,
  memory_limit_mb  INT NOT NULL DEFAULT 128,
  points           INT NOT NULL DEFAULT 10,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, sequence_order)
);

-- ─── invitations ───────────────────────────────────────────────────────────
CREATE TABLE invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token       TEXT UNIQUE NOT NULL,
  status      invite_status NOT NULL DEFAULT 'pending',
  expires_at  TIMESTAMPTZ NOT NULL,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, email)
);

-- ─── candidate_sessions ────────────────────────────────────────────────────
CREATE TABLE candidate_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  round_id                UUID NOT NULL REFERENCES rounds(id),
  status                  session_status NOT NULL DEFAULT 'invited',
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  fullscreen_violations   INT NOT NULL DEFAULT 0,
  tab_switch_violations   INT NOT NULL DEFAULT 0,
  ip_address              TEXT,
  user_agent              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, round_id)
);

-- ─── submissions ───────────────────────────────────────────────────────────
CREATE TABLE submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES candidate_sessions(id),
  question_id     UUID NOT NULL REFERENCES questions(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  code            TEXT,           -- Round 2
  language_id     INT,            -- Round 2: Judge0 language ID
  predicted_out   TEXT,           -- Round 1
  judge0_token    TEXT,           -- Round 2: Judge0 submission token
  status          submission_status NOT NULL DEFAULT 'pending',
  stdout          TEXT,
  stderr          TEXT,
  compile_output  TEXT,
  test_results    JSONB,          -- Round 2: per test-case results
  time_ms         FLOAT,
  memory_kb       INT,
  score           INT NOT NULL DEFAULT 0,
  is_final        BOOLEAN NOT NULL DEFAULT FALSE,
  attempt_count   INT NOT NULL DEFAULT 1,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── speed_metrics ─────────────────────────────────────────────────────────
CREATE TABLE speed_metrics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id         UUID NOT NULL REFERENCES submissions(id) UNIQUE,
  session_id            UUID NOT NULL REFERENCES candidate_sessions(id),
  question_id           UUID NOT NULL REFERENCES questions(id),
  total_keystrokes      INT NOT NULL DEFAULT 0,
  paste_count           INT NOT NULL DEFAULT 0,
  delete_count          INT NOT NULL DEFAULT 0,
  time_to_first_key_ms  INT,
  total_active_time_ms  INT NOT NULL DEFAULT 0,
  idle_periods          JSONB,    -- [{start_ms, end_ms}]
  chars_per_minute      FLOAT,
  wpm_equivalent        FLOAT,
  keystroke_sample      JSONB,    -- optional, sampled replay data
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── audit_logs ────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  session_id   UUID REFERENCES candidate_sessions(id),
  event_type   audit_event_type NOT NULL,
  event_data   JSONB NOT NULL DEFAULT '{}',
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX idx_candidate_sessions_user    ON candidate_sessions(user_id);
CREATE INDEX idx_candidate_sessions_round   ON candidate_sessions(round_id);
CREATE INDEX idx_candidate_sessions_status  ON candidate_sessions(status);
CREATE INDEX idx_submissions_session        ON submissions(session_id);
CREATE INDEX idx_submissions_question       ON submissions(question_id);
CREATE INDEX idx_submissions_user           ON submissions(user_id);
CREATE INDEX idx_audit_logs_session         ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_user            ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at      ON audit_logs(created_at DESC);
CREATE INDEX idx_invitations_email          ON invitations(email);
CREATE INDEX idx_invitations_round          ON invitations(round_id);

-- ─── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds               ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_metrics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;

-- (See implementation.md §4.3 for full RLS policy definitions)
```

### 3.2 JSONB Schema: `test_cases`

```typescript
interface TestCase {
  id: string;                 // unique within question, e.g., "tc_1"
  input: string;              // stdin content
  expected_output: string;    // expected stdout
  is_hidden: boolean;         // true = not shown to candidate during Run
  points: number;             // points for this case (sum = question.points)
}
```

### 3.3 JSONB Schema: `test_results` (submission)

```typescript
interface TestCaseResult {
  case_id: string;
  passed: boolean;
  score: number;
  stdout: string | null;
  stderr: string | null;
  time_ms: number;
  memory_kb: number;
  status: string;             // Judge0 status description
}
```

### 3.4 JSONB Schema: `idle_periods` (speed_metrics)

```typescript
interface IdlePeriod {
  start_ms: number;   // ms from question load
  end_ms: number;     // ms from question load
}
```

---

## 4. API Specification

> Base URL: `https://codeassess.yourorg.com`  
> All endpoints require `Authorization: Bearer <supabase_jwt>` unless noted.  
> All request bodies are `Content-Type: application/json`.  
> All responses include `Content-Type: application/json`.

---

### 4.1 Auth

#### `POST /api/auth/bootstrap`
Provision the first admin account. Disabled after first use.

**Auth:** None required  
**Body:**
```json
{ "token": "string", "email": "string" }
```
**Response `200`:**
```json
{ "message": "Admin account provisioned", "user_id": "uuid" }
```
**Errors:** `400` (invalid token), `409` (bootstrap already used)

---

### 4.2 Admin — Rounds

#### `GET /api/admin/rounds`
**Auth:** admin  
**Response `200`:** `Round[]`
```json
[{
  "id": "uuid",
  "title": "string",
  "type": "output_prediction | live_coding",
  "duration_minutes": 60,
  "is_published": true,
  "is_active": true,
  "results_released": false,
  "session_count": 24,
  "created_at": "ISO8601"
}]
```

#### `POST /api/admin/rounds`
**Auth:** admin  
**Body:**
```json
{
  "title": "string",
  "description": "string | null",
  "type": "output_prediction | live_coding",
  "duration_minutes": 60,
  "allowed_languages": [71, 63],
  "pass_score": 60,
  "fullscreen_violation_limit": 3,
  "tab_switch_limit": 5,
  "starts_at": "ISO8601 | null",
  "ends_at": "ISO8601 | null"
}
```
**Response `201`:** `Round`  
**Errors:** `400` (validation), `401`, `403`

#### `PUT /api/admin/rounds/:id`
**Auth:** admin  
**Body:** Same as POST (all fields optional)  
**Constraint:** Cannot edit while `is_active=true`  
**Response `200`:** `Round`  
**Errors:** `400`, `403`, `404`, `409` (active round)

#### `POST /api/admin/rounds/:id/publish`
**Auth:** admin  
**Body:** None  
**Response `200`:** `Round` with `is_published=true, is_active=true`  
**Errors:** `400` (no questions added), `404`

#### `POST /api/admin/rounds/:id/pause`
**Auth:** admin  
**Response `200`:** `Round` with `is_active=false`

#### `POST /api/admin/rounds/:id/release-results`
**Auth:** admin  
**Response `200`:** `Round` with `results_released=true`

---

### 4.3 Admin — Questions

#### `GET /api/admin/rounds/:roundId/questions`
**Auth:** admin  
**Response `200`:** `Question[]` (includes `expected_output` and hidden `test_cases`)

#### `POST /api/admin/rounds/:roundId/questions`
**Auth:** admin  
**Body (Round 1):**
```json
{
  "sequence_order": 1,
  "title": "string",
  "description": "string | null",
  "type": "output_prediction",
  "code_snippet": "string",
  "expected_output": "string",
  "points": 10
}
```
**Body (Round 2):**
```json
{
  "sequence_order": 1,
  "title": "string",
  "description": "string | null",
  "type": "coding",
  "starter_code": "string | null",
  "test_cases": [
    { "id": "tc_1", "input": "string", "expected_output": "string", "is_hidden": false, "points": 5 }
  ],
  "time_limit_s": 5,
  "memory_limit_mb": 128,
  "points": 10
}
```
**Response `201`:** `Question`  
**Errors:** `400` (validation), `403`, `404`

#### `PUT /api/admin/questions/:id`
**Auth:** admin  
**Body:** Partial `Question` fields  
**Response `200`:** `Question`

#### `DELETE /api/admin/questions/:id`
**Auth:** admin  
**Response `204`**  
**Errors:** `403`, `404`, `409` (round is active)

---

### 4.4 Admin — Invitations

#### `POST /api/admin/invitations`
**Auth:** admin  
**Body:**
```json
{
  "round_id": "uuid",
  "emails": ["alice@example.com", "bob@example.com"]
}
```
**Response `201`:**
```json
{
  "created": 2,
  "skipped": 0,
  "errors": []
}
```
**Side effect:** Sends invitation email to each address via Supabase Auth  
**Errors:** `400` (invalid emails), `403`, `404` (round not found)

---

### 4.5 Admin — Monitoring

#### `GET /api/admin/rounds/:roundId/sessions`
**Auth:** admin  
**Response `200`:** `SessionSummary[]`
```json
[{
  "id": "uuid",
  "user_email": "string",
  "user_name": "string",
  "status": "started | completed | timed_out | disqualified",
  "started_at": "ISO8601",
  "expires_at": "ISO8601",
  "fullscreen_violations": 1,
  "tab_switch_violations": 0,
  "questions_answered": 3,
  "total_questions": 5,
  "total_score": 20
}]
```

#### `GET /api/admin/sessions/:id/submissions`
**Auth:** admin  
**Response `200`:** `SubmissionDetail[]`
```json
[{
  "id": "uuid",
  "question_id": "uuid",
  "question_title": "string",
  "code": "string | null",
  "language_id": 71,
  "predicted_out": "string | null",
  "status": "accepted | wrong_answer | ...",
  "score": 10,
  "max_points": 10,
  "test_results": [],
  "time_ms": 42.3,
  "memory_kb": 9068,
  "submitted_at": "ISO8601",
  "speed_metrics": {
    "chars_per_minute": 26.0,
    "wpm_equivalent": 5.2,
    "total_keystrokes": 312,
    "paste_count": 0,
    "delete_count": 45,
    "total_active_time_ms": 720000
  }
}]
```

#### `GET /api/admin/sessions/:id/audit-logs`
**Auth:** admin  
**Response `200`:** `AuditLog[]`
```json
[{
  "id": "uuid",
  "event_type": "fullscreen_exit",
  "event_data": { "duration_outside_ms": 4200 },
  "created_at": "ISO8601"
}]
```

#### `POST /api/admin/sessions/:id/disqualify`
**Auth:** admin  
**Body:** `{ "reason": "string" }`  
**Response `200`:** `{ "status": "disqualified" }`  
**Side effect:** Inserts `audit_log` with `admin_action`; blocks further candidate API calls for this session

---

### 4.6 Candidate — Rounds & Sessions

#### `GET /api/rounds`
**Auth:** candidate  
**Response `200`:** `RoundSummary[]` — only rounds with active invitation for the authenticated user

#### `POST /api/rounds/:id/start`
**Auth:** candidate  
**Body:** `{ "invitation_token": "string" }`  
**Response `201`:**
```json
{
  "session_id": "uuid",
  "expires_at": "ISO8601",
  "question_count": 5
}
```
**Errors:** `400` (invalid/expired token), `403`, `409` (session already started)

#### `GET /api/rounds/:id/questions`
**Auth:** candidate  
**Constraint:** Active session for this round must exist  
**Response `200`:** `Question[]` — `expected_output` omitted; `test_cases` filtered to `is_hidden=false` only

#### `POST /api/sessions/:id/heartbeat`
**Auth:** candidate  
**Response `200`:** `{ "valid": true, "remaining_ms": 1234567 }`  
**Response `403`:** Session expired or disqualified → client auto-submits

#### `POST /api/sessions/:id/events`
**Auth:** candidate  
**Body:**
```json
{
  "event_type": "fullscreen_exit | tab_switch | paste_detected | copy_detected",
  "event_data": {}
}
```
**Response `204`**

#### `POST /api/sessions/:id/complete`
**Auth:** candidate  
**Response `200`:** `{ "status": "completed", "completed_at": "ISO8601" }`

---

### 4.7 Candidate — Submissions

#### `POST /api/submissions`
**Auth:** candidate  
**Body:**
```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "predicted_out": "string | null",
  "code": "string | null",
  "language_id": 71,
  "is_final": true,
  "speed_metrics": {
    "total_keystrokes": 312,
    "paste_count": 0,
    "delete_count": 45,
    "time_to_first_key_ms": 8200,
    "total_active_time_ms": 720000,
    "idle_periods": [{ "start_ms": 120000, "end_ms": 180000 }],
    "chars_per_minute": 26.0
  }
}
```
**Response `201`:** `{ "submission_id": "uuid", "status": "pending" }`  
**Errors:** `400` (session not active, question mismatch), `403`, `409` (already has final submission)

#### `GET /api/submissions/:id`
**Auth:** candidate (own submissions only)  
**Response `200`:** `Submission` (without hidden test case inputs)

---

### 4.8 Code Execution

#### `POST /api/execute`
**Auth:** candidate (rate-limited: 10/min/user)  
**Body:**
```json
{
  "source_code": "string",
  "language_id": 71,
  "stdin": "string | null",
  "cpu_time_limit": 2,
  "memory_limit": 131072
}
```
**Response `202`:** `{ "token": "string" }`

#### `GET /api/execute/:token`
**Auth:** candidate  
**Response `200` (processing):** `{ "status": { "id": 1, "description": "In Queue" } }`  
**Response `200` (complete):**
```json
{
  "status": { "id": 3, "description": "Accepted" },
  "stdout": "string | null",
  "stderr": "string | null",
  "compile_output": "string | null",
  "time": "0.042",
  "memory": 9068
}
```

---

### 4.9 Admin — Export

#### `GET /api/admin/rounds/:id/export`
**Auth:** admin  
**Query params:** `format=csv` (default) or `format=pdf`  
**Response:** File download (`text/csv` or `application/pdf`)  
**Response Headers:**
```
Content-Disposition: attachment; filename="round-<title>-results.csv"
```

---

## 5. UI/UX Guidelines & Wireframe Descriptions

### 5.1 Design Principles

| Principle | Application |
|-----------|-------------|
| **Clarity first** | Every action has one obvious affordance; no hidden menus in assessment flow |
| **Reduced cognitive load** | Candidate portal is stripped to essentials; no navigation, no settings |
| **Status always visible** | Timer, question count, and session status always in view during assessment |
| **Error recovery** | Network errors show retry buttons; session state is server-authoritative |
| **Admin density** | Admin panel may use data-dense tables; prioritise information over whitespace |

### 5.2 Design Tokens

```css
/* Colours */
--color-primary:       #4F46E5;  /* Indigo 600 */
--color-primary-hover: #4338CA;  /* Indigo 700 */
--color-success:       #16A34A;  /* Green 600 */
--color-warning:       #D97706;  /* Amber 600 */
--color-danger:        #DC2626;  /* Red 600 */
--color-surface:       #FFFFFF;
--color-surface-muted: #F9FAFB;  /* Gray 50 */
--color-border:        #E5E7EB;  /* Gray 200 */
--color-text:          #111827;  /* Gray 900 */
--color-text-muted:    #6B7280;  /* Gray 500 */

/* Dark mode (candidate assessment) */
--color-bg-dark:       #0F172A;  /* Slate 900 */
--color-surface-dark:  #1E293B;  /* Slate 800 */
--color-border-dark:   #334155;  /* Slate 700 */

/* Typography */
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Spacing */
/* 4px base grid; use multiples of 4 */

/* Border Radius */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
```

### 5.3 Wireframe: Login Page (`/login`)

```
┌─────────────────────────────────────────────────┐
│                                                  │
│              [CodeAssess Logo]                   │
│                                                  │
│         Technical Assessment Platform            │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │          [G] Continue with Google       │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│                   ── or ──                       │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │  Email address                          │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │         Send Magic Link                 │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  [Error message if present]                      │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 5.4 Wireframe: Admin — Round List (`/admin/rounds`)

```
┌────────────────────────────────────────────────────────────────┐
│  CodeAssess Admin                         [User Avatar ▼]       │
├────────────────────────────────────────────────────────────────┤
│  Rounds   Candidates   Settings                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Assessment Rounds                      [+ New Round]          │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Title          Type        Status    Sessions   Actions  │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ Backend R1   Output Pred   ● Active    24/30    [▶][✏]  │ │
│  │ Backend R2   Live Coding   ○ Draft      0/0     [▶][✏]  │ │
│  │ Frontend R1  Output Pred   ✓ Ended     15/15    [↓][👁] │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 5.5 Wireframe: Admin — Round Detail + Question Editor

```
┌────────────────────────────────────────────────────────────────┐
│  ← Rounds  /  Backend R1                  [Pause] [Export ↓]  │
├────────────────────────────────────────────────────────────────┤
│  [Overview] [Questions] [Candidates] [Monitor] [Audit]         │
├────────────────────────────────────────────────────────────────┤
│  QUESTIONS                                  [+ Add Question]   │
│                                                                │
│  #1  Pointer Arithmetic         10 pts   [✏ Edit] [🗑 Delete] │
│      Type: Output Prediction                                   │
│                                                                │
│  #2  Two Sum (Python)           10 pts   [✏ Edit] [🗑 Delete] │
│      Type: Coding | TC: 3 visible, 2 hidden                   │
│                                                                │
│  ─────────────────── Add Question ───────────────────          │
│  Type: [Output Prediction ▼]                                   │
│  Title: [                              ]                       │
│  Code Snippet:                                                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  #include<stdio.h>                                   │     │
│  │  int main(){ ... }                                   │     │
│  └──────────────────────────────────────────────────────┘     │
│  Expected Output: [        ]    Points: [10]                   │
│  [Save Question]                                               │
└────────────────────────────────────────────────────────────────┘
```

### 5.6 Wireframe: Admin — Live Monitor

```
┌────────────────────────────────────────────────────────────────┐
│  Live Monitor — Backend R1               ● 18 active           │
├────────────────────────────────────────────────────────────────┤
│  [Search: name or email        ]   [Filter: All Status ▼]      │
│                                                                │
│  Name         Email          Status    Time Left  FS  Tab  Q  │
│  ─────────────────────────────────────────────────────────── │
│  Alice M.     alice@...      ● Active  42:18       0    0  3/5│
│  Bob K.       bob@...        ● Active  38:55       1    0  2/5│
│  Carol S.     carol@...      ✓ Done    —            0    2  5/5│
│  Dave T.      dave@...       ✗ Disq.   —            4    1  1/5│
│                                                                │
│  [View] [Disqualify] — appear on row hover                     │
└────────────────────────────────────────────────────────────────┘
```

### 5.7 Wireframe: Candidate — Round Entry

```
┌────────────────────────────────────────────────────────────────┐
│  CodeAssess                                                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│         Backend Engineering Assessment — Round 1               │
│                                                                │
│  Duration:   60 minutes                                        │
│  Questions:  5                                                 │
│  Type:       C Output Prediction                               │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Instructions                                            │ │
│  │  • You will be shown C code snippets.                   │ │
│  │  • Type the exact output the program would produce.     │ │
│  │  • The assessment runs in fullscreen. Exiting           │ │
│  │    fullscreen is logged as a violation.                 │ │
│  │  • The timer starts when you click Begin.               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│                    [ Begin Assessment ]                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 5.8 Wireframe: Candidate — Round 1 Question

```
┌────────────────────────────────────────────────────────────────┐ ← Fullscreen
│  Question 2 of 5          ░░░░░░████████████░░░░  43:22 left  │ ← Timer bar (top strip)
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Pointer Arithmetic                                  10 pts   │
│                                                                │
│  What is the output of the following C program?               │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  #include<stdio.h>                                       │ │  ← Read-only, syntax-highlighted
│  │  int main(){                                             │ │
│  │      int a = 5, b = 10;                                  │ │
│  │      int *p = &a;                                        │ │
│  │      printf("%d %d", *p, *(p+1));                        │ │
│  │  }                                                       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Your predicted output:                                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │  ← Textarea
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [← Previous]                           [Submit & Next →]     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 5.9 Wireframe: Candidate — Round 2 Question

```
┌────────────────────────────────────────────────────────────────┐ ← Fullscreen
│  Question 1 of 3            ████████░░░░░░░░░░░░  28:40 left  │
├───────────────────────────────┬────────────────────────────────┤
│  Two Sum                      │  Language: [Python 3 ▼]        │
│  10 pts                       │                                │
│                               │  ┌──────────────────────────┐ │
│  Given an array of integers   │  │  def two_sum(nums, t):   │ │  ← Monaco editor
│  and a target, return         │  │      # your code here    │ │
│  indices of two numbers       │  │                          │ │
│  that add up to target.       │  └──────────────────────────┘ │
│                               │                                │
│  Test Cases (visible):        │  [Run  ⌘↵]    [Submit  ⌘⇧↵]  │
│  ┌─────────────────────────┐  │                                │
│  │ #  Input     Expected   │  │  Output:                       │
│  │ 1  [2,7,11], 9  → 0 1  │  │  ┌──────────────────────────┐ │
│  │ 2  [3,2,4],  6  → 1 2  │  │  │  TC #1: ✅ 0 1 (0.04s)  │ │
│  └─────────────────────────┘  │  │  TC #2: ✅ 1 2 (0.04s)  │ │
│                               │  └──────────────────────────┘ │
└───────────────────────────────┴────────────────────────────────┘
```

### 5.10 Wireframe: Fullscreen Exit Overlay

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│               ⚠  Fullscreen Required                          │
│                                                                │
│  You have exited fullscreen mode.                              │
│  This has been logged as violation 1 of 3.                     │
│                                                                │
│  After 3 violations, your session will be automatically        │
│  disqualified.                                                 │
│                                                                │
│               [ Return to Fullscreen ]                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```
*(Modal blocks all interaction until candidate re-enters fullscreen or clicks Return)*

### 5.11 Component Library Summary

| Component | Library | Notes |
|-----------|---------|-------|
| Buttons | shadcn/ui `Button` | primary / outline / destructive variants |
| Tables | shadcn/ui `Table` | sortable columns in admin views |
| Dialogs / Modals | shadcn/ui `Dialog` | confirmation, question editor |
| Forms | shadcn/ui + react-hook-form + Zod | client + server validation |
| Code editor | Monaco Editor | read-only (R1 snippet) + editable (R2) |
| Syntax highlight | Monaco built-in | C, Python, JS, Java, Go |
| Timer | Custom `SessionTimer` | ARIA live region for accessibility |
| Toast notifications | shadcn/ui `Sonner` | success, error, warning |
| Data tables | TanStack Table | sorting, filtering in admin |
| Real-time updates | Supabase Realtime hooks | admin monitor page |
| Charts (optional) | Recharts | speed metrics visualization in admin |
