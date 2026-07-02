# Assessment Platform — Implementation Guide

> Authoritative technical reference for the development team. Covers architecture decisions, data model, data flows, security controls, API surface, and key algorithms.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Data Model](#2-data-model)
3. [Data Flow](#3-data-flow)
4. [Security Considerations](#4-security-considerations)
5. [API Surface](#5-api-surface)
6. [Key Algorithms](#6-key-algorithms)
7. [Permissions Matrix](#7-permissions-matrix)

---

## 1. System Architecture

### 1.1 Component Inventory

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| **API Server** | Node.js 20 + Fastify 4 | REST API + static file serving |
| **Frontend** | Vanilla HTML + CSS + JS | Admin panel, candidate portal (no framework) |
| **Auth Service** | Supabase Auth | Google OAuth + Magic Link; JWT issuance |
| **Database** | Supabase PostgreSQL 15 | All application state; Row Level Security |
| **Code Executor** | Pyodide (browser WASM) | Python 3 execution in the browser; Web Worker |
| **Deployment** | Any VPS / Docker / Nginx | No platform dependency |

### 1.2 Directory Structure

```
assessment-platform/
├── backend/
│   ├── server.js                 # Fastify app — registers all plugins and routes
│   ├── lib/
│   │   ├── db.js                 # Supabase service-role client + makeUserClient()
│   │   └── scoring.js            # normalizeOutput, computeDerivedMetrics
│   ├── middleware/
│   │   └── auth.js               # requireAdmin preHandler
│   ├── routes/
│   │   ├── auth.js               # GET /api/auth/user
│   │   ├── admin/
│   │   │   ├── rounds.js         # Full CRUD + publish/pause/export
│   │   │   ├── questions.js      # CRUD with test_cases replace
│   │   │   └── sessions.js       # GET / DELETE / disqualify
│   │   └── test/
│   │       ├── rounds.js         # GET /api/test/rounds (public)
│   │       ├── register.js       # POST register + POST start
│   │       ├── questions.js      # GET questions (token-gated)
│   │       ├── submit.js         # POST submit (score from Pyodide results)
│   │       └── session.js        # complete / event / status
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── css/app.css               # Full design system (CSS custom properties, dark theme)
    ├── js/
    │   ├── api.js                # Centralized fetch wrapper + all endpoint methods
    │   ├── utils.js              # Toast, modal, confirm, formatTime, badges, DOM helpers
    │   └── pyodide-worker.js     # Web Worker: runs Python code via Pyodide WASM
    ├── index.html                # Root redirect (admin → /admin/, other → /test/)
    ├── login.html                # Admin login (Supabase OAuth + magic link)
    ├── admin/
    │   ├── index.html            # Dashboard: stats + rounds list
    │   ├── round.html            # Round detail: questions tab + sessions tab
    │   └── playback.html         # Typing replay: Monaco viewer + slider
    └── test/
        ├── index.html            # Candidate landing: published rounds grid
        ├── entry.html            # Rules + registration form
        ├── exam.html             # Exam: Monaco + Pyodide + anti-cheat
        └── complete.html         # Submission confirmed / disqualified
```

### 1.3 Request Flow

```
Browser
  │
  ├── GET /admin/index.html   → Fastify @fastify/static serves frontend/admin/index.html
  ├── GET /js/api.js          → serves frontend/js/api.js
  │
  ├── GET /api/admin/rounds   → Fastify route handler
  │     requireAdmin middleware:
  │       Authorization: Bearer <token>
  │       → supabase.auth.getUser(token)
  │       → users.role must be 'admin'
  │     → db.from('rounds').select(...)
  │     → JSON response
  │
  └── POST /api/test/submit   → No auth middleware
        body.session_token → verify in candidate_sessions
        → score from body.test_results
        → INSERT submissions
        → INSERT speed_metrics
        → JSON response
```

---

## 2. Data Model

### 2.1 Key Tables

```
users
  id            uuid PK
  email         text UNIQUE NOT NULL
  full_name     text
  role          text NOT NULL  ('admin' | 'candidate')
  avatar_url    text
  created_at    timestamptz

rounds
  id                uuid PK
  title             text NOT NULL
  description       text
  round_type        text NOT NULL  ('live_coding' | 'output_prediction' | 'mcq')
  duration_minutes  int NOT NULL
  cutoff_score      int
  is_published      bool DEFAULT false
  is_active         bool DEFAULT false
  created_at        timestamptz

questions
  id              uuid PK
  round_id        uuid FK rounds
  title           text NOT NULL
  description     text
  question_type   text  ('coding' | 'output_prediction')
  points          int DEFAULT 100
  starter_code    text
  expected_output text
  order_index     int DEFAULT 0
  created_at      timestamptz

test_cases
  id               uuid PK
  question_id      uuid FK questions
  input            text
  expected_output  text NOT NULL
  is_hidden        bool DEFAULT false
  points           int DEFAULT 0
  order_index      int DEFAULT 0

candidate_sessions
  id               uuid PK
  round_id         uuid FK rounds
  user_id          uuid FK users (nullable — candidates may not have Supabase accounts)
  session_token    text UNIQUE NOT NULL
  candidate_name   text
  candidate_email  text
  college_name     text
  roll_no          text
  branch           text
  status           text  ('registered' | 'started' | 'completed' | 'disqualified')
  score            int
  started_at       timestamptz
  completed_at     timestamptz
  created_at       timestamptz

submissions
  id           uuid PK
  session_id   uuid FK candidate_sessions
  question_id  uuid FK questions
  user_id      uuid (nullable)
  code         text
  language_id  int DEFAULT 71  (Python 3)
  status       text  ('pending' | 'accepted' | 'wrong_answer')
  is_final     bool DEFAULT false
  score        int
  test_results jsonb  -- [{case_id, passed, stdout, stderr, score, ...}]
  created_at   timestamptz

speed_metrics
  id                    uuid PK
  submission_id         uuid FK submissions
  session_id            uuid FK candidate_sessions
  question_id           uuid FK questions
  total_keystrokes      int DEFAULT 0
  paste_count           int DEFAULT 0
  delete_count          int DEFAULT 0
  time_to_first_key_ms  int
  total_active_time_ms  int DEFAULT 0
  idle_periods          jsonb  -- [{start_ms, end_ms}]
  chars_per_minute      float
  wpm_equivalent        float
  keystroke_sample      jsonb  -- typing replay: {startTime, snapshots, runEvents}
  created_at            timestamptz

audit_logs
  id           uuid PK
  session_id   uuid FK candidate_sessions
  event_type   text  ('tab_switch' | 'fullscreen_exit' | 'window_blur' | 'tab_close' | 'timer_expired' | ...)
  event_data   jsonb
  created_at   timestamptz
```

### 2.2 Typing Replay Schema (`keystroke_sample` JSONB)

```json
{
  "startTime": 1720000000000,
  "snapshots": [
    { "t": 0,     "code": "# starter code", "trigger": "initial" },
    { "t": 10000, "code": "def solve():\n  pass", "trigger": "periodic" },
    { "t": 15000, "code": "def solve():\n  return 42", "trigger": "paste", "pastedContent": "return 42" },
    { "t": 20000, "code": "def solve():\n  return 42", "trigger": "run" },
    { "t": 25000, "code": "def solve():\n  return 42", "trigger": "submit" }
  ],
  "runEvents": [
    { "t": 20000, "results": [{ "passed": true, "case_id": "...", "time_ms": 42 }] }
  ]
}
```

---

## 3. Data Flow

### 3.1 Admin Creates and Publishes a Round

```
Admin Browser
  │
  ├─ POST /api/admin/rounds               → INSERT INTO rounds
  ├─ POST /api/admin/questions            → INSERT INTO questions + test_cases
  └─ POST /api/admin/rounds/:id/publish
        → UPDATE rounds SET is_published=true, is_active=true
```

### 3.2 Candidate Registers and Starts

```
Candidate Browser
  │
  ├─ GET  /api/test/rounds                → SELECT published rounds
  ├─ POST /api/test/:roundId/register
  │     → INSERT candidate_sessions (status='registered', session_token=uuid())
  │     → Returns: session_id, session_token
  │
  └─ POST /api/test/:roundId/start
        → Verify round is_published + is_active
        → UPDATE candidate_sessions SET status='started', started_at=now()
        → Returns: expires_at = started_at + duration_minutes
        Client: requestFullscreen() → navigate to /test/exam.html
```

### 3.3 Exam: Run (Non-Final)

```
Candidate writes Python code → clicks Run

Client (exam.html)
  ├─ GET /api/test/:roundId/questions?token=...
  │     → Returns visible test cases only (is_hidden=false)
  │
  └─ Pyodide Web Worker
        for each visible test case:
          run code with stdin = tc.input
          compare stdout to tc.expected_output
        → Display results in output panel
        → Record run event in replays[q.id]
```

### 3.4 Exam: Submit (Final)

```
Candidate clicks Submit → confirms dialog

Client (exam.html)
  ├─ GET /api/test/:roundId/questions?token=...&include_hidden=true
  │     → Returns ALL test cases (visible + hidden)
  │
  ├─ Pyodide Web Worker
  │     for each test case (including hidden):
  │       run code with stdin = tc.input
  │       compare stdout (normalized) to expected_output
  │     → Results array: [{case_id, passed, score, stdout, ...}]
  │
  └─ POST /api/test/submit
        body: {
          session_token,
          question_id,
          code,
          test_results: [...],   ← pre-computed by Pyodide
          is_final: true,
          speed_metrics: {...},
          typing_replay: {...}
        }
        │
        Server:
          → Verify session active + not expired
          → Compute score = sum(r.score for r in test_results)
          → INSERT submissions
          → INSERT speed_metrics (+ keystroke_sample = typing_replay)
          → Returns: { submission_id, score, status }
```

### 3.5 Anti-Cheat Event Flow

```
Client (exam.html)
  │
  ├─ visibilitychange (document.hidden=true)
  │     → autoSubmit('tab_switch')
  │
  ├─ fullscreenchange (no fullscreenElement)
  │     → autoSubmit('fullscreen_exit')
  │
  ├─ window blur
  │     → autoSubmit('window_blur')
  │
  └─ autoSubmit(reason):
        if already submitting or completed: return
        POST /api/test/session/:id/event { event_type: reason }
          → Server: INSERT audit_logs
          → Server: UPDATE candidate_sessions SET status='disqualified' (for tab_switch, fullscreen_exit, etc.)
        Submit all unsubmitted questions (without test results)
        POST /api/test/session/:id/complete
        document.exitFullscreen()
        redirect to /test/complete.html
```

### 3.6 Speed Metric Tracking

```
Client (exam.html, per question)
  │
  ├─ Monaco editor.onDidChangeModelContent:
  │     metrics[qid].keystrokes++
  │     if !firstKey: firstKey = Date.now()
  │
  ├─ Monaco editor.onDidPaste:
  │     metrics[qid].pastes++
  │     navigator.clipboard.readText() → snapshot with pastedContent
  │
  ├─ Periodic snapshot (setInterval 10s):
  │     if code changed since last snapshot:
  │       replays[qid].snapshots.push({ t, code, trigger:'periodic' })
  │
  └─ On submit:
       idle_ms = sum of idle_periods durations
       active_ms = Date.now() - startTime - idle_ms
       payload = {
         total_keystrokes, paste_count, delete_count,
         time_to_first_key_ms, total_active_time_ms, idle_periods
       }
       → sent to POST /api/test/submit
```

---

## 4. Security Considerations

### 4.1 Admin Authentication

| Control | Implementation |
|---------|---------------|
| Token verification | `supabase.auth.getUser(token)` on every admin request |
| Role enforcement | `users.role = 'admin'` checked server-side via service role client |
| Service role key | Never sent to browser; only used in `backend/lib/db.js` |
| CORS | Configured origin restriction via `@fastify/cors` |

### 4.2 Candidate Session Security

| Control | Implementation |
|---------|---------------|
| Session token | UUID v4 generated on registration; stored in `candidate_sessions.session_token` |
| Token validation | Every candidate API call validates `session_token` against DB |
| Session expiry | `started_at + duration_minutes * 60000` checked server-side on every request |
| Duplicate final submit | 409 returned if `is_final=true` submission already exists for that question |

### 4.3 Code Execution Security

| Control | Implementation |
|---------|---------------|
| Sandbox | Browser WASM (Pyodide); sandboxed by browser process model |
| Network isolation | WASM has no network access; Pyodide runs in a Web Worker |
| Timeout | 15-second client-side timeout per execution; worker terminated and recreated |
| No server exposure | Server never executes candidate code; only stores pre-computed results |

### 4.4 Anti-Cheat Measures

| Measure | Implementation |
|---------|---------------|
| Fullscreen enforcement | `requestFullscreen()` on entry; `fullscreenchange` → immediate disqualification |
| Tab switch detection | `visibilitychange` → immediate disqualification |
| Window blur | `window.blur` → immediate disqualification |
| Paste detection | `editor.onDidPaste` → count + snapshot with pasted content |
| Context menu | `oncontextmenu="return false"` on exam body |
| DevTools shortcuts | `keydown` listener blocks `Ctrl+U`, `F12` |
| Status polling | Client polls `/api/test/session/:id/status` every 10s for admin-initiated DQ |

### 4.5 Input Validation

| Risk | Mitigation |
|------|-----------|
| SQL injection | Parameterised queries via Supabase SDK; no raw SQL from user input |
| XSS | All user content HTML-escaped in frontend JS (`escHtml()` helper) |
| CORS | Configured allowed origin; `credentials: true` for cookie support |
| Rate limiting | `@fastify/rate-limit`: 200 requests/minute/IP globally |

---

## 5. API Surface

### 5.1 Auth Header

All admin routes require:
```
Authorization: Bearer <supabase_access_token>
```

The `requireAdmin` preHandler:
1. Extracts token from `Authorization` header
2. Calls `supabase.auth.getUser(token)` with an anon-key client
3. Looks up `users.role` with the service role client
4. Returns 401/403 if invalid; attaches `request.user` if valid

### 5.2 Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/user` | Current admin profile |
| GET | `/api/admin/rounds` | All rounds with session count |
| POST | `/api/admin/rounds` | Create round |
| GET | `/api/admin/rounds/:id` | Round + questions + test_cases |
| PUT | `/api/admin/rounds/:id` | Update round fields |
| DELETE | `/api/admin/rounds/:id` | Delete round |
| POST | `/api/admin/rounds/:id/publish` | Set `is_published=true, is_active=true` |
| POST | `/api/admin/rounds/:id/unpublish` | Set `is_published=false, is_active=false` |
| POST | `/api/admin/rounds/:id/pause` | Set `is_active=false` |
| GET | `/api/admin/rounds/:id/sessions` | Sessions with submissions |
| GET | `/api/admin/rounds/:id/export` | CSV download (`?finalized=true` for cutoff filter) |
| POST | `/api/admin/questions` | Create question + test_cases |
| PUT | `/api/admin/questions/:id` | Update question (replaces test_cases) |
| DELETE | `/api/admin/questions/:id` | Delete question + test_cases |
| GET | `/api/admin/sessions/:id` | Session detail for playback (with speed_metrics.keystroke_sample) |
| DELETE | `/api/admin/sessions/:id` | Delete session cascade |
| POST | `/api/admin/sessions/:id/disqualify` | Set `status='disqualified'` |

### 5.3 Public Test Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/test/rounds` | None | Published rounds |
| POST | `/api/test/:roundId/register` | None | Register → `session_token` |
| POST | `/api/test/:roundId/start` | `session_token` in body | Start timer → `expires_at` |
| GET | `/api/test/:roundId/questions` | `?token=...` | Questions (visible TCs only unless `&include_hidden=true`) |
| POST | `/api/test/submit` | `session_token` in body | Save submission + speed metrics |
| GET | `/api/test/session/:id/status` | `?token=...` | Session status (for DQ poll) |
| POST | `/api/test/session/:id/complete` | `session_token` in body | Mark completed, compute final score |
| POST | `/api/test/session/:id/event` | `session_token` in body | Log audit event; auto-DQ on violations |

### 5.4 Request / Response Examples

**POST /api/test/:roundId/register**
```json
// Request
{
  "candidate_name": "Alice Kumar",
  "candidate_email": "alice@example.com",
  "college_name": "IIT Bombay",
  "roll_no": "21CS001",
  "branch": "Computer Science"
}

// Response 201
{
  "session_id": "uuid",
  "session_token": "uuid",
  "round_id": "uuid",
  "already_registered": false
}
```

**POST /api/test/submit**
```json
// Request
{
  "session_token": "uuid",
  "question_id": "uuid",
  "code": "n = int(input())\nprint(n * 2)",
  "test_results": [
    { "case_id": "uuid", "passed": true, "stdout": "10", "score": 50, "time_ms": 12, "is_hidden": false, "expected_output": "10" },
    { "case_id": "uuid", "passed": false, "stdout": "4", "score": 0, "time_ms": 8, "is_hidden": true, "expected_output": "8" }
  ],
  "is_final": true,
  "speed_metrics": {
    "total_keystrokes": 42,
    "paste_count": 0,
    "delete_count": 5,
    "time_to_first_key_ms": 3200,
    "total_active_time_ms": 180000,
    "idle_periods": []
  },
  "typing_replay": {
    "startTime": 1720000000000,
    "snapshots": [
      { "t": 0, "code": "", "trigger": "initial" },
      { "t": 15000, "code": "n = int(input())\nprint(n * 2)", "trigger": "periodic" }
    ],
    "runEvents": []
  }
}

// Response 201
{
  "submission_id": "uuid",
  "score": 50,
  "status": "wrong_answer",
  "test_results": [...]
}
```

---

## 6. Key Algorithms

### 6.1 Output Normalization

```javascript
// backend/lib/scoring.js
export function normalizeOutput(raw) {
  if (raw === null || raw === undefined) return ''
  return String(raw)
    .replace(/\r\n/g, '\n')   // normalize Windows line endings
    .replace(/\r/g, '\n')     // normalize old Mac line endings
    .trim()                   // strip leading/trailing whitespace
}
```

### 6.2 Score Computation (Server-Side)

```javascript
// Server trusts client Pyodide results; computes total score server-side
let finalScore = 0
let finalStatus = 'pending'

if (Array.isArray(test_results) && test_results.length > 0) {
  finalScore = test_results.reduce((sum, r) => sum + (r.score || 0), 0)
  const allPassed  = test_results.every(r => r.passed)
  const somePassed = test_results.some(r => r.passed)
  finalStatus = allPassed ? 'accepted' : somePassed ? 'wrong_answer' : 'wrong_answer'
}
```

### 6.3 Pyodide Test Case Execution (Browser)

```javascript
// frontend/js/pyodide-worker.js (Web Worker)
for (const tc of testCases) {
  // Redirect stdin, capture stdout/stderr
  pyodide.runPython(`
    import sys, io
    _stdout = io.StringIO()
    sys.stdin = io.StringIO(${JSON.stringify(tc.input || '')})
    sys.stdout = _stdout
  `)
  pyodide.runPython(code)
  const stdout = pyodide.runPython('_stdout.getvalue()') || ''
  const got      = normalizeOutput(stdout)
  const expected = normalizeOutput(tc.expected_output)
  const passed   = got === expected
  results.push({ case_id: tc.id, passed, stdout, score: passed ? tc.points : 0, ... })
}
```

### 6.4 Speed Metrics Derived Values

```javascript
// backend/lib/scoring.js
export function computeDerivedMetrics(m) {
  const totalMs = m.total_active_time_ms || 0
  const keys    = m.total_keystrokes || 0
  const chars_per_minute = totalMs > 0
    ? Math.round((keys / (totalMs / 60000)) * 10) / 10
    : 0
  const wpm_equivalent = Math.round(chars_per_minute / 5 * 10) / 10
  return { chars_per_minute, wpm_equivalent }
}
```

### 6.5 Auto-Submit Guard

```javascript
// frontend/test/exam.html
let hasCompleted  = false
let isSubmitting  = false

async function autoSubmit(reason) {
  if (isSubmitting || hasCompleted) return  // prevent duplicate calls
  isSubmitting = true
  hasCompleted  = true

  // 1. Log audit event
  // 2. Submit all unsubmitted questions (code only, no results)
  // 3. Complete session
  // 4. Exit fullscreen + redirect
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) autoSubmit('tab_switch')
})
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) autoSubmit('fullscreen_exit')
})
window.addEventListener('blur', () => autoSubmit('window_blur'))
```

---

## 7. Permissions Matrix

### 7.1 Feature Access

| Feature | Admin | Candidate |
|---------|:-----:|:---------:|
| View all rounds | ✅ | ❌ |
| Create / edit / delete rounds | ✅ | ❌ |
| Publish / pause rounds | ✅ | ❌ |
| Add / edit / delete questions | ✅ | ❌ |
| View expected outputs / hidden test cases | ✅ | ❌ |
| View published rounds | ✅ | ✅ |
| Register and start assessment | ❌ | ✅ |
| Submit code / answers | ❌ | ✅ (active session) |
| Run code (non-final) | ❌ | ✅ (active session) |
| View all sessions | ✅ | ❌ |
| View typing replay | ✅ | ❌ |
| View all speed metrics | ✅ | ❌ |
| Disqualify candidate | ✅ | ❌ |
| Delete session | ✅ | ❌ |
| Export results CSV | ✅ | ❌ |

### 7.2 API Endpoint Auth

| Endpoint | Required |
|----------|----------|
| `/api/auth/user` | Supabase JWT (any role) |
| `/api/admin/*` | Supabase JWT + `role='admin'` |
| `/api/test/rounds` | None |
| `/api/test/:id/register` | None |
| `/api/test/:id/start` | `session_token` in body |
| `/api/test/:id/questions` | `session_token` in query string |
| `/api/test/submit` | `session_token` in body |
| `/api/test/session/:id/*` | `session_token` in body/query |

### 7.3 Supabase RLS Summary

| Table | Public | Candidate (via service role API) | Admin (via service role API) |
|-------|--------|----------------------------------|------------------------------|
| `rounds` | Published rows (via public API) | ❌ direct | Full |
| `questions` | Via session-gated API | ❌ direct | Full |
| `candidate_sessions` | ❌ | Own row (via session token) | Full |
| `submissions` | ❌ | Own rows (via session token) | Full |
| `speed_metrics` | ❌ | ❌ | Full |
| `audit_logs` | ❌ | Insert only (via event API) | Full |

> All database operations from the backend use the **service role key**, which bypasses RLS. Access control is enforced at the Fastify middleware layer, not at the database level. RLS policies remain as a defense-in-depth layer.
