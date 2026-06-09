# CodeAssess — Implementation Guide

> Authoritative technical reference for the development team. Covers architecture decisions, data model, data flows, security controls, API surface, key algorithms, and the permissions model.

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
| **Web App** | Next.js 14 (App Router) | Admin panel, candidate portal, API routes |
| **Auth Service** | Supabase Auth | JWT issuance, OAuth, magic links, session refresh |
| **Database** | Supabase PostgreSQL 15 | All application state; RLS for row-level access control |
| **Realtime Bus** | Supabase Realtime | Push live session/submission updates to admin dashboard |
| **Edge Functions** | Supabase Edge Functions (Deno) | Scoring, audit recording, session enforcement |
| **Code Executor** | Judge0 CE (Fly.io, Docker) | Isolated multi-language code execution |
| **Object Storage** | Supabase Storage | Exported reports, question assets |
| **CDN / Hosting** | Vercel | Next.js deployment, edge caching, preview environments |
| **Monitoring** | Sentry + Vercel Analytics | Error capture, performance tracking |

### 1.2 Service Dependency Graph

```
Browser
  │
  ├── Next.js App (Vercel)
  │     ├── /admin/*       → Supabase DB (RLS: admin role)
  │     │                  → Supabase Realtime (subscribe to sessions)
  │     ├── /assess/*      → Supabase DB (RLS: candidate role)
  │     │                  → Supabase Auth (JWT validation)
  │     └── /api/*
  │           ├── /api/execute  → Judge0 CE (Fly.io)
  │           ├── /api/admin/*  → Supabase DB + Storage
  │           └── /api/sessions → Supabase Edge Functions
  │
  ├── Supabase Auth          (OAuth, magic link, JWT)
  ├── Supabase PostgreSQL    (primary data store)
  ├── Supabase Realtime      (WebSocket → admin dashboard)
  ├── Supabase Edge Functions
  │     ├── submission-scorer          (called after final submit)
  │     ├── audit-event-recorder       (called on every client event)
  │     └── session-timeout-enforcer   (cron: every 60 s)
  └── Judge0 CE (Fly.io)
        └── isolate sandbox (per submission)
```

### 1.3 Directory Structure (Next.js App)

```
codeassess/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── admin/
│   │   ├── layout.tsx            # AdminGuard: redirect if not admin
│   │   ├── rounds/page.tsx
│   │   ├── rounds/[id]/page.tsx
│   │   ├── monitor/[roundId]/page.tsx
│   │   └── results/[roundId]/page.tsx
│   ├── assess/
│   │   ├── layout.tsx            # FullscreenGuard, SessionGuard
│   │   ├── [roundId]/page.tsx    # entry / instructions
│   │   ├── [roundId]/r1/page.tsx # Round 1 output prediction
│   │   └── [roundId]/r2/page.tsx # Round 2 live coding
│   └── api/
│       ├── admin/
│       ├── rounds/
│       ├── submissions/
│       ├── sessions/
│       └── execute/
├── components/
│   ├── admin/                    # AdminTable, SessionMonitor, etc.
│   ├── assess/                   # CodeEditor, TimerBar, ViolationBanner
│   └── ui/                       # shadcn/ui re-exports
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # browser Supabase client
│   │   ├── server.ts             # server-side client (service role)
│   │   └── middleware.ts         # session refresh in Next.js middleware
│   ├── judge0/
│   │   ├── client.ts             # Judge0 API wrapper
│   │   └── languages.ts          # language ID map
│   ├── scoring/                  # scoring algorithms
│   ├── metrics/                  # speed metric calculators
│   └── anti-cheat/               # event handlers, violation logic
├── supabase/
│   ├── migrations/               # numbered SQL migration files
│   ├── seeds/                    # dev seed data
│   └── functions/                # Edge Function source
│       ├── submission-scorer/
│       ├── audit-event-recorder/
│       └── session-timeout-enforcer/
├── judge0/
│   ├── docker-compose.yml
│   └── judge0.conf
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── types/
    └── supabase.ts               # auto-generated from schema
```

---

## 2. Data Model

### 2.1 Entity Relationship Diagram (Text)

```
users
  ┌───────────────────────────────────────────────┐
  │ id            uuid PK default gen_random_uuid()│
  │ email         text UNIQUE NOT NULL             │
  │ full_name     text                             │
  │ role          user_role NOT NULL  ('admin'|    │
  │               'candidate')                     │
  │ avatar_url    text                             │
  │ created_at    timestamptz DEFAULT now()        │
  │ updated_at    timestamptz DEFAULT now()        │
  └───────────────────────────────────────────────┘
         │1
         │
         │∞
  ┌──────────────────────────────────────────────────────────────────┐
  │ rounds                                                           │
  │ id                uuid PK                                        │
  │ title             text NOT NULL                                  │
  │ description       text                                           │
  │ type              round_type NOT NULL  ('output_prediction'|     │
  │                   'live_coding')                                 │
  │ duration_minutes  int NOT NULL  CHECK (duration_minutes > 0)    │
  │ allowed_languages int[]   -- Judge0 language IDs (R2 only)       │
  │ pass_score        int DEFAULT 0  -- min score to pass            │
  │ is_published      bool DEFAULT false                             │
  │ is_active         bool DEFAULT false                             │
  │ created_by        uuid REFERENCES users(id)                      │
  │ starts_at         timestamptz                                    │
  │ ends_at           timestamptz                                    │
  │ created_at        timestamptz DEFAULT now()                      │
  │ updated_at        timestamptz DEFAULT now()                      │
  └──────────────────────────────────────────────────────────────────┘
         │1                                      │1
         │                                       │
         │∞                                      │∞
  ┌────────────────────────────────┐    ┌────────────────────────────────────┐
  │ questions                       │    │ invitations                         │
  │ id             uuid PK          │    │ id          uuid PK                 │
  │ round_id       uuid FK rounds   │    │ round_id    uuid FK rounds          │
  │ sequence_order int NOT NULL     │    │ email       text NOT NULL           │
  │ title          text NOT NULL    │    │ token       text UNIQUE NOT NULL    │
  │ description    text             │    │ status      invite_status           │
  │ type           question_type    │    │             ('pending'|'accepted'|  │
  │                ('output_pred'|  │    │             'expired')              │
  │                'coding')        │    │ expires_at  timestamptz             │
  │ code_snippet   text  -- R1      │    │ created_by  uuid FK users           │
  │ expected_output text -- R1      │    │ created_at  timestamptz             │
  │ starter_code   text  -- R2      │    └────────────────────────────────────┘
  │ test_cases     jsonb -- R2      │
  │ time_limit_s   int DEFAULT 5    │
  │ memory_limit_mb int DEFAULT 128 │
  │ points         int DEFAULT 10   │
  │ created_at     timestamptz      │
  └────────────────────────────────┘
         │1
         │
         │∞
  ┌──────────────────────────────────────────────────────────────────┐
  │ candidate_sessions                                               │
  │ id                    uuid PK                                    │
  │ user_id               uuid FK users                             │
  │ round_id              uuid FK rounds                             │
  │ status                session_status NOT NULL                    │
  │                        ('invited'|'started'|'completed'|         │
  │                         'timed_out'|'disqualified')              │
  │ started_at            timestamptz                                │
  │ completed_at          timestamptz                                │
  │ fullscreen_violations  int DEFAULT 0                             │
  │ tab_switch_violations  int DEFAULT 0                             │
  │ ip_address            text                                       │
  │ user_agent            text                                       │
  │ created_at            timestamptz DEFAULT now()                  │
  │ UNIQUE (user_id, round_id)                                       │
  └──────────────────────────────────────────────────────────────────┘
         │1                        │1
         │                         │
         │∞                        │∞
  ┌───────────────────────────┐   ┌───────────────────────────────────────┐
  │ submissions               │   │ audit_logs                             │
  │ id            uuid PK     │   │ id           uuid PK                   │
  │ session_id    uuid FK     │   │ user_id      uuid FK users             │
  │ question_id   uuid FK     │   │ session_id   uuid FK sessions (null ok)│
  │ user_id       uuid FK     │   │ event_type   audit_event_type          │
  │ code          text (R2)   │   │              ('session_start'|         │
  │ language_id   int (R2)    │   │               'session_end'|           │
  │ predicted_out text (R1)   │   │               'fullscreen_exit'|       │
  │ judge0_token  text (R2)   │   │               'fullscreen_enter'|      │
  │ status        sub_status  │   │               'tab_switch'|            │
  │ stdout        text        │   │               'paste_detected'|        │
  │ stderr        text        │   │               'submission'|            │
  │ compile_out   text        │   │               'disqualified'|          │
  │ time_ms       float       │   │               'admin_action')          │
  │ memory_kb     int         │   │ event_data   jsonb                     │
  │ score         int         │   │ ip_address   text                      │
  │ is_final      bool        │   │ user_agent   text                      │
  │ attempt_count int         │   │ created_at   timestamptz               │
  │ submitted_at  timestamptz │   └───────────────────────────────────────┘
  └───────────────────────────┘
         │1
         │
         │0..1
  ┌──────────────────────────────────────────────────────────────────┐
  │ speed_metrics                                                    │
  │ id                     uuid PK                                   │
  │ submission_id          uuid FK submissions UNIQUE                │
  │ session_id             uuid FK candidate_sessions                │
  │ question_id            uuid FK questions                         │
  │ total_keystrokes       int DEFAULT 0                             │
  │ paste_count            int DEFAULT 0                             │
  │ delete_count           int DEFAULT 0                             │
  │ time_to_first_key_ms   int                                       │
  │ total_active_time_ms   int                                       │
  │ idle_periods           jsonb  -- [{start_ms, end_ms}, ...]       │
  │ chars_per_minute       float  -- computed on save                │
  │ wpm_equivalent         float  -- chars_per_minute / 5           │
  │ keystroke_sample       jsonb  -- optional replay data (sampled)  │
  │ created_at             timestamptz DEFAULT now()                 │
  └──────────────────────────────────────────────────────────────────┘
```

### 2.2 Enum Definitions

```sql
CREATE TYPE user_role         AS ENUM ('admin', 'candidate');
CREATE TYPE round_type        AS ENUM ('output_prediction', 'live_coding');
CREATE TYPE question_type     AS ENUM ('output_prediction', 'coding');
CREATE TYPE session_status    AS ENUM ('invited', 'started', 'completed', 'timed_out', 'disqualified');
CREATE TYPE submission_status AS ENUM ('pending', 'running', 'accepted', 'wrong_answer',
                                        'time_limit_exceeded', 'memory_limit_exceeded',
                                        'runtime_error', 'compile_error', 'internal_error');
CREATE TYPE invite_status     AS ENUM ('pending', 'accepted', 'expired');
CREATE TYPE audit_event_type  AS ENUM ('session_start', 'session_end', 'fullscreen_exit',
                                        'fullscreen_enter', 'tab_switch', 'paste_detected',
                                        'submission', 'disqualified', 'admin_action');
```

### 2.3 `test_cases` JSONB Schema (Round 2)

```json
[
  {
    "id": "tc_1",
    "input": "5\n3",
    "expected_output": "8",
    "is_hidden": false,
    "points": 4
  },
  {
    "id": "tc_2",
    "input": "0\n0",
    "expected_output": "0",
    "is_hidden": true,
    "points": 6
  }
]
```

Hidden test cases are never sent to the candidate; only visible cases are shown during "Run" actions. All cases (hidden + visible) are evaluated on final submission.

---

## 3. Data Flow

### 3.1 Admin Creates and Publishes a Round

```
Admin Browser
  │
  ├─ POST /api/admin/rounds          → DB: INSERT into rounds
  ├─ POST /api/admin/rounds/:id/questions → DB: INSERT into questions
  ├─ POST /api/admin/invitations     → DB: INSERT into invitations
  │                                      → Email: send magic link per candidate
  └─ POST /api/admin/rounds/:id/publish
        → DB: UPDATE rounds SET is_published=true, is_active=true
        → Realtime: broadcasts 'round_published' event
```

### 3.2 Candidate Starts a Session

```
Candidate Browser
  │
  ├─ GET /assess/:roundId            → Check invitation token validity
  │                                    → Check round is_active and within window
  ├─ POST /api/rounds/:id/start
  │     → DB: INSERT candidate_sessions (status='started', started_at=now())
  │     → DB: INSERT audit_logs (event_type='session_start')
  │     → Returns: session_id, expires_at (started_at + duration_minutes)
  │
  └─ Client: enterFullscreen()       → logs 'fullscreen_enter' audit event
             startCountdown()        → displays timer bar
             loadQuestions()         → GET /api/rounds/:id/questions
                                         (questions filtered by session validity)
```

### 3.3 Round 1 — Output Prediction Submission

```
Candidate types predicted output → clicks Submit

  Client
  │
  └─ POST /api/submissions
       body: { session_id, question_id, predicted_output, speed_metrics_payload }
       │
       ├─ API route validates: session active, question belongs to round, within time
       ├─ DB: INSERT submissions { predicted_output, status='pending' }
       ├─ DB: INSERT speed_metrics { ...payload }
       │
       └─ Supabase Edge Function: submission-scorer
             ├─ Fetch question.expected_output
             ├─ Compare normalize(predicted_output) == normalize(expected_output)
             ├─ DB: UPDATE submissions SET score, status='accepted'|'wrong_answer'
             └─ DB: INSERT audit_logs (event_type='submission')
```

### 3.4 Round 2 — Live Coding Submission

```
Candidate writes code in Monaco → clicks Run (test) or Submit (final)

  ── RUN (non-final) ─────────────────────────────────────────────────────
  Client
  └─ POST /api/execute
       body: { code, language_id, stdin, time_limit, memory_limit }
       │
       └─ API route → Judge0 POST /submissions?wait=false
             │
             ├─ Returns: { token }
             └─ Client polls GET /api/execute/:token every 1 s
                   → API route → Judge0 GET /submissions/:token
                   → Returns: { status, stdout, stderr, time, memory }
                   → Display result in output panel

  ── SUBMIT (final) ──────────────────────────────────────────────────────
  Client
  └─ POST /api/submissions
       body: { session_id, question_id, code, language_id,
               is_final: true, speed_metrics_payload }
       │
       ├─ API route:
       │   ├─ DB: INSERT submissions { code, language_id, status='pending', is_final=true }
       │   ├─ DB: INSERT speed_metrics
       │   └─ Enqueue: submission-scorer Edge Function
       │
       └─ Edge Function: submission-scorer
             ├─ For each test_case in question.test_cases:
             │     ├─ POST Judge0 /submissions { code, language_id, stdin=tc.input }
             │     ├─ Wait for result (poll or wait=true)
             │     └─ Compare stdout to tc.expected_output
             ├─ Calculate score: sum(passed_cases * case.points)
             ├─ DB: UPDATE submissions SET score, status, stdout, stderr, time_ms, memory_kb
             └─ DB: INSERT audit_logs (event_type='submission')
```

### 3.5 Speed Metric Tracking

```
Client (assess layout — invisible to candidate)
  │
  ├─ On question load:
  │     questionStartTime = Date.now()
  │     firstKeystroke = null
  │     metrics = { keystrokes:0, pastes:0, deletes:0, idleStart: null, idlePeriods:[] }
  │
  ├─ Monaco Editor events:
  │     onDidChangeModelContent(e):
  │         for each change:
  │             if firstKeystroke == null: firstKeystroke = Date.now()
  │             isDelete = change.text === ''
  │             keystrokes++ (or deletes++)
  │             resetIdleTimer()
  │
  ├─ onPaste event (editor container):
  │     pastes++
  │     log audit event 'paste_detected' immediately
  │
  ├─ Idle detection:
  │     idleThreshold = 30_000 ms
  │     idleTimer = setTimeout(() => {
  │         idleStart = Date.now()
  │     }, idleThreshold)
  │     resetIdleTimer():
  │         if idleStart: idlePeriods.push({start: idleStart, end: Date.now()})
  │         clearTimeout; restart idleTimer
  │
  └─ On submit:
       activeTime = Date.now() - questionStartTime - sum(idlePeriods.duration)
       cpm = (totalKeystrokes / activeTime) * 60_000
       payload = { total_keystrokes, paste_count, delete_count,
                   time_to_first_key_ms, total_active_time_ms,
                   idle_periods, chars_per_minute }
       → included in POST /api/submissions body
```

### 3.6 Anti-Cheat Event Flow

```
Client (FullscreenGuard component, always mounted in assess layout)
  │
  ├─ On mount: document.addEventListener('fullscreenchange', handler)
  │            document.addEventListener('visibilitychange', handler)
  │
  ├─ fullscreenchange (exit):
  │     POST /api/sessions/:id/events { type: 'fullscreen_exit' }
  │     → Edge Function: audit-event-recorder
  │           DB: INSERT audit_logs
  │           DB: UPDATE candidate_sessions SET fullscreen_violations++
  │           if fullscreen_violations >= threshold:
  │               DB: UPDATE sessions SET status='disqualified'
  │               → push Realtime event to admin dashboard
  │     Client: show warning overlay, re-enter fullscreen prompt
  │
  ├─ visibilitychange (hidden):
  │     POST /api/sessions/:id/events { type: 'tab_switch' }
  │     → same audit chain
  │     DB: UPDATE candidate_sessions SET tab_switch_violations++
  │
  └─ Heartbeat (every 30 s):
       POST /api/sessions/:id/heartbeat
       → API route: verifies session not expired
       → If expired: respond 403 → client auto-submits and ends session
```

### 3.7 Session Timeout Enforcement

```
Supabase Edge Function: session-timeout-enforcer
  Schedule: every 60 seconds (pg_cron or Supabase cron)
  │
  └─ SELECT * FROM candidate_sessions
         WHERE status = 'started'
           AND started_at + (duration_minutes * interval '1 minute') < now()
     │
     For each expired session:
       ├─ DB: UPDATE submissions SET is_final=true WHERE session_id = s.id AND is_final=false
       ├─ DB: UPDATE candidate_sessions SET status='timed_out', completed_at=now()
       ├─ DB: INSERT audit_logs (event_type='session_end', event_data={reason:'timeout'})
       └─ Realtime: publish 'session_timed_out' to admin channel
```

---

## 4. Security Considerations

### 4.1 Code Execution Sandboxing (Judge0 / isolate)

| Control | Implementation |
|---------|---------------|
| **Process isolation** | Each submission runs in a fresh `isolate` Linux container |
| **Network disabled** | `DISABLE_NETWORK=true` in judge0.conf; no outbound calls |
| **CPU time limit** | 5 s default (configurable per question) |
| **Wall time limit** | 10 s (prevents sleep/infinite loops) |
| **Memory limit** | 128 MB default (configurable per question) |
| **Filesystem** | Read-only rootfs; isolated `/tmp` per submission |
| **Privilege** | Runs as unprivileged user inside container |
| **Stack size** | 64 MB default; fork bombs blocked |
| **No exec** | System calls filtered via seccomp (Judge0 default) |

**Additional controls:**
- Judge0 API is not publicly accessible; calls are proxied through Next.js API routes
- API key required on all Judge0 calls (`X-Auth-Token` header)
- Judge0 instance is on Fly.io private network, not exposed on public internet

### 4.2 Authentication & Authorisation

| Mechanism | Detail |
|-----------|--------|
| **JWT validation** | Every API route calls `supabase.auth.getUser()` — validates Supabase-issued JWT |
| **Role enforcement** | `users.role` checked server-side; admin routes 403 if role ≠ 'admin' |
| **Row Level Security** | All tables have RLS enabled; policies enforce candidate isolation |
| **Service Role** | Used only in Edge Functions and server-side API routes; never sent to client |
| **Invitation token** | HMAC-signed, single-use, expiring (24 h); redeemed once on session start |

### 4.3 Key RLS Policies

```sql
-- candidates can only read their own sessions
CREATE POLICY "candidate_own_session"
  ON candidate_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- candidates can only submit to their own active sessions
CREATE POLICY "candidate_own_submission_insert"
  ON submissions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM candidate_sessions cs
      WHERE cs.id = session_id
        AND cs.user_id = auth.uid()
        AND cs.status = 'started'
    )
  );

-- admins have full read on everything
CREATE POLICY "admin_full_read"
  ON submissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- audit_logs: insert for own events only; admins read all
CREATE POLICY "audit_insert_own"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "audit_admin_read"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
```

### 4.4 Anti-Cheat Measures

| Measure | Implementation | Notes |
|---------|---------------|-------|
| **Fullscreen enforcement** | `document.documentElement.requestFullscreen()` on session start; `fullscreenchange` monitored | Cannot be programmatically prevented on all browsers; violations logged |
| **Fullscreen exit threshold** | 3 violations → auto-disqualify (configurable per round) | Admin can override |
| **Tab switch detection** | `document.visibilitychange` event listener | Captures alt-tab, new tab, dock switching |
| **Tab switch threshold** | 5 violations → flag for admin review (configurable) | Does not auto-disqualify by default |
| **Paste detection** | `paste` event on editor container; count logged | High paste-count relative to keystrokes = signal |
| **DevTools detection** | `window.outerWidth - window.innerWidth > threshold` heuristic | Logged, not enforced (false positive risk) |
| **Context menu** | Disabled in assess layout via CSS + event.preventDefault() | Reduces right-click copy options |
| **Keyboard shortcut blocking** | Block Ctrl+U (view source), F12 in assess layout | Not reliable cross-browser; layered defense |
| **Copy detection** | `copy` event listener; log content length (not content itself) | Privacy-preserving signal |
| **Session heartbeat** | Client pings `/api/sessions/:id/heartbeat` every 30 s | Server validates session validity; dead heartbeat = timeout |
| **IP logging** | Session start IP stored; flag changes mid-session | Detects session token sharing |
| **Audit trail** | Every anti-cheat event → `audit_logs` with timestamp | Full post-hoc review capability |

> **Note on extension blocking:** Browser extensions cannot be disabled programmatically from a web page. The recommended mitigation is to document the requirement in candidate instructions, use a dedicated browser profile, and rely on behavioral signals (paste frequency, typing speed anomalies) for detection.

### 4.5 Input Validation and Injection Prevention

| Risk | Mitigation |
|------|-----------|
| SQL injection | Parameterised queries via Supabase SDK; no raw SQL from user input |
| XSS | Next.js JSX auto-escaping; Content Security Policy header |
| Code in editor | Sent to sandboxed Judge0 only; never eval'd by server |
| SSRF | Judge0 URL is hardcoded env var; candidate cannot control execution target |
| CORS | Next.js CORS policy; only app domain and Supabase allowed |
| Rate limiting | Vercel Edge Middleware rate limits on `/api/execute` (10 req/min per user) |

### 4.6 Audit Logging Strategy

All audit events are written to `audit_logs` by the `audit-event-recorder` Edge Function. The function runs with the service role key (bypasses RLS) to ensure events are never lost. Candidates cannot modify or delete their own audit logs (no UPDATE/DELETE policy).

Log retention: 90 days in hot storage (PostgreSQL); nightly export to Supabase Storage (JSON-L) for long-term archive.

---

## 5. API Surface

### Authentication

All endpoints (except `/api/auth/*`) require a valid Supabase JWT in the `Authorization: Bearer <token>` header. The Next.js middleware validates the token on every request via `supabase.auth.getUser()`.

### 5.1 Auth Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/auth/callback` | Supabase OAuth redirect handler | None |
| POST | `/api/auth/logout` | Invalidate session | Any authenticated |

### 5.2 Admin Endpoints

| Method | Path | Request Body | Response | Notes |
|--------|------|-------------|---------|-------|
| GET | `/api/admin/rounds` | — | `Round[]` | All rounds |
| POST | `/api/admin/rounds` | `CreateRoundDTO` | `Round` | Creates draft |
| GET | `/api/admin/rounds/:id` | — | `Round` | With questions |
| PUT | `/api/admin/rounds/:id` | `UpdateRoundDTO` | `Round` | |
| DELETE | `/api/admin/rounds/:id` | — | `204` | Only if not active |
| POST | `/api/admin/rounds/:id/publish` | — | `Round` | Sets is_published, is_active |
| POST | `/api/admin/rounds/:id/pause` | — | `Round` | Sets is_active=false |
| GET | `/api/admin/rounds/:id/questions` | — | `Question[]` | |
| POST | `/api/admin/rounds/:id/questions` | `CreateQuestionDTO` | `Question` | |
| PUT | `/api/admin/questions/:id` | `UpdateQuestionDTO` | `Question` | |
| DELETE | `/api/admin/questions/:id` | — | `204` | |
| POST | `/api/admin/invitations` | `{ round_id, emails: string[] }` | `Invitation[]` | Sends emails |
| GET | `/api/admin/rounds/:id/sessions` | — | `SessionSummary[]` | Live + completed |
| GET | `/api/admin/sessions/:id` | — | `SessionDetail` | Full session data |
| GET | `/api/admin/sessions/:id/submissions` | — | `Submission[]` | With metrics |
| GET | `/api/admin/sessions/:id/audit-logs` | — | `AuditLog[]` | Sorted by time |
| POST | `/api/admin/sessions/:id/disqualify` | `{ reason: string }` | `Session` | |
| GET | `/api/admin/rounds/:id/export` | `?format=csv\|pdf` | File download | Results export |

**`CreateRoundDTO`:**
```json
{
  "title": "Backend Engineering — Round 1",
  "description": "C output prediction round",
  "type": "output_prediction",
  "duration_minutes": 60,
  "allowed_languages": null,
  "pass_score": 60
}
```

**`CreateQuestionDTO` (Round 1):**
```json
{
  "sequence_order": 1,
  "title": "Pointer Arithmetic",
  "description": "What is the output of the following C program?",
  "type": "output_prediction",
  "code_snippet": "#include<stdio.h>\nint main(){\n  int a=5,*p=&a;\n  printf(\"%d\",*p+1);\n}",
  "expected_output": "6",
  "points": 10
}
```

**`CreateQuestionDTO` (Round 2):**
```json
{
  "sequence_order": 1,
  "title": "Two Sum",
  "description": "Given an array of integers and a target, return indices of two numbers that add up to target.",
  "type": "coding",
  "starter_code": "def two_sum(nums, target):\n    pass",
  "test_cases": [
    { "id": "tc_1", "input": "4\n2 7 11 15\n9", "expected_output": "0 1", "is_hidden": false, "points": 5 },
    { "id": "tc_2", "input": "3\n3 2 4\n6", "expected_output": "1 2", "is_hidden": true, "points": 5 }
  ],
  "time_limit_s": 2,
  "memory_limit_mb": 256,
  "points": 10
}
```

### 5.3 Candidate Endpoints

| Method | Path | Request Body | Response | Notes |
|--------|------|-------------|---------|-------|
| GET | `/api/rounds` | — | `Round[]` | Rounds with active invitation for auth user |
| POST | `/api/rounds/:id/start` | `{ invitation_token }` | `SessionStart` | Creates session, returns session_id + expires_at |
| GET | `/api/rounds/:id/session` | — | `SessionState` | Current session status |
| GET | `/api/rounds/:id/questions` | — | `Question[]` | Questions for active session (no hidden test case answers) |
| POST | `/api/submissions` | `SubmissionDTO` | `Submission` | Create submission |
| GET | `/api/submissions/:id` | — | `Submission` | Own submissions only |
| POST | `/api/sessions/:id/heartbeat` | — | `{ valid: bool, remaining_ms: int }` | Liveness check |
| POST | `/api/sessions/:id/events` | `AuditEventDTO` | `204` | Log client-side events |
| POST | `/api/sessions/:id/complete` | — | `Session` | Mark session complete |

**`SubmissionDTO`:**
```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "code": "def two_sum(...):\n  ...",
  "language_id": 71,
  "is_final": true,
  "speed_metrics": {
    "total_keystrokes": 312,
    "paste_count": 0,
    "delete_count": 45,
    "time_to_first_key_ms": 8200,
    "total_active_time_ms": 720000,
    "idle_periods": [{"start_ms": 120000, "end_ms": 180000}],
    "chars_per_minute": 26.0
  }
}
```

### 5.4 Code Execution Endpoints (Proxy)

| Method | Path | Request Body | Response | Notes |
|--------|------|-------------|---------|-------|
| POST | `/api/execute` | `ExecuteDTO` | `{ token: string }` | Submits to Judge0 |
| GET | `/api/execute/:token` | — | `ExecuteResult` | Poll for result |

**`ExecuteDTO`:**
```json
{
  "source_code": "print('hello')",
  "language_id": 71,
  "stdin": "5\n3",
  "cpu_time_limit": 2,
  "memory_limit": 131072
}
```

**`ExecuteResult`:**
```json
{
  "status": { "id": 3, "description": "Accepted" },
  "stdout": "hello\n",
  "stderr": null,
  "compile_output": null,
  "time": "0.042",
  "memory": 9068
}
```

---

## 6. Key Algorithms

### 6.1 Output Normalization (Round 1 Scoring)

```typescript
// lib/scoring/normalizeOutput.ts
export function normalizeOutput(raw: string): string {
  return raw
    .trim()                          // strip leading/trailing whitespace
    .replace(/\r\n/g, '\n')          // normalize line endings
    .replace(/[ \t]+$/gm, '')        // strip trailing spaces per line
    .toLowerCase();                  // case-insensitive comparison
}

export function scoreOutputPrediction(
  predicted: string,
  expected: string,
  points: number
): { score: number; correct: boolean } {
  const correct = normalizeOutput(predicted) === normalizeOutput(expected);
  return { score: correct ? points : 0, correct };
}
```

### 6.2 Multi-Test-Case Scoring (Round 2)

```typescript
// lib/scoring/scoreSubmission.ts
interface TestResult {
  caseId: string;
  passed: boolean;
  points: number;
  stdout: string;
  time_ms: number;
  memory_kb: number;
}

export async function scoreMultipleTestCases(
  code: string,
  languageId: number,
  testCases: TestCase[],
  judge0: Judge0Client
): Promise<{ totalScore: number; results: TestResult[]; worstStatus: SubmissionStatus }> {

  const results: TestResult[] = [];
  let worstStatus: SubmissionStatus = 'accepted';

  // Run all test cases in parallel (Judge0 handles concurrency)
  const executions = await Promise.all(
    testCases.map(tc =>
      judge0.submitAndWait({
        source_code: code,
        language_id: languageId,
        stdin: tc.input,
        cpu_time_limit: tc.time_limit_s ?? 5,
        memory_limit: (tc.memory_limit_mb ?? 128) * 1024,
      })
    )
  );

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const exec = executions[i];
    const passed =
      exec.status.description === 'Accepted' &&
      normalizeOutput(exec.stdout ?? '') === normalizeOutput(tc.expected_output);

    results.push({
      caseId: tc.id,
      passed,
      points: passed ? tc.points : 0,
      stdout: exec.stdout ?? '',
      time_ms: parseFloat(exec.time ?? '0') * 1000,
      memory_kb: exec.memory ?? 0,
    });

    if (!passed && exec.status.id !== 3) {
      worstStatus = mapJudge0Status(exec.status.id);
    }
  }

  const totalScore = results.reduce((sum, r) => sum + r.points, 0);
  return { totalScore, results, worstStatus };
}
```

### 6.3 Speed Metrics Calculator

```typescript
// lib/metrics/speedMetrics.ts
export interface SpeedMetricsPayload {
  total_keystrokes: number;
  paste_count: number;
  delete_count: number;
  time_to_first_key_ms: number | null;
  total_active_time_ms: number;
  idle_periods: { start_ms: number; end_ms: number }[];
}

export function computeDerivedMetrics(payload: SpeedMetricsPayload) {
  const netKeystrokes = payload.total_keystrokes - payload.delete_count;
  const activeMinutes = payload.total_active_time_ms / 60_000;

  const chars_per_minute =
    activeMinutes > 0 ? netKeystrokes / activeMinutes : 0;

  const wpm_equivalent = chars_per_minute / 5; // standard WPM definition

  const total_idle_ms = payload.idle_periods.reduce(
    (sum, p) => sum + (p.end_ms - p.start_ms), 0
  );

  const idle_fraction =
    payload.total_active_time_ms + total_idle_ms > 0
      ? total_idle_ms / (payload.total_active_time_ms + total_idle_ms)
      : 0;

  return {
    chars_per_minute: Math.round(chars_per_minute * 10) / 10,
    wpm_equivalent: Math.round(wpm_equivalent * 10) / 10,
    total_idle_ms,
    idle_fraction: Math.round(idle_fraction * 1000) / 1000,
  };
}
```

### 6.4 Session Timer and Auto-Submit

```typescript
// lib/assess/sessionTimer.ts
export class SessionTimer {
  private expiresAt: Date;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    expiresAt: Date,
    private onTick: (remainingMs: number) => void,
    private onExpire: () => void
  ) {
    this.expiresAt = expiresAt;
  }

  start() {
    this.intervalId = setInterval(() => {
      const remaining = this.expiresAt.getTime() - Date.now();
      if (remaining <= 0) {
        this.stop();
        this.onExpire();   // triggers auto-submit + POST /api/sessions/:id/complete
      } else {
        this.onTick(remaining);
        // Warn at 5 min and 1 min remaining
        if (remaining <= 60_000 || remaining <= 300_000) {
          // trigger warning UI
        }
      }
    }, 1000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
```

### 6.5 Invitation Token Generation

```typescript
// lib/auth/invitationToken.ts
import { createHmac, randomBytes } from 'crypto';

export function generateInvitationToken(
  roundId: string,
  email: string
): string {
  const nonce = randomBytes(16).toString('hex');
  const payload = `${roundId}:${email}:${nonce}`;
  const hmac = createHmac('sha256', process.env.NEXTAUTH_SECRET!)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

export function verifyInvitationToken(
  token: string,
  roundId: string,
  email: string
): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    const [tRound, tEmail, tNonce, tHmac] = parts;
    if (tRound !== roundId || tEmail !== email) return false;
    const expected = createHmac('sha256', process.env.NEXTAUTH_SECRET!)
      .update(`${tRound}:${tEmail}:${tNonce}`)
      .digest('hex');
    return expected === tHmac;   // timing-safe in production: use timingSafeEqual
  } catch {
    return false;
  }
}
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
| Invite candidates | ✅ | ❌ |
| View own assigned rounds | ❌ | ✅ |
| Start assessment session | ❌ | ✅ (invitation required) |
| Submit code / answers | ❌ | ✅ (active session required) |
| Run code (non-final) | ❌ | ✅ (active session required) |
| View own submissions | ❌ | ✅ (after round ends or admin releases) |
| View all submissions | ✅ | ❌ |
| View all sessions | ✅ | ❌ |
| Monitor live sessions | ✅ | ❌ |
| View audit logs | ✅ | ❌ |
| Disqualify candidate | ✅ | ❌ |
| Export results | ✅ | ❌ |
| View own speed metrics | ❌ | ❌ (admin only) |
| View all speed metrics | ✅ | ❌ |

### 7.2 API Endpoint Auth Requirements

| Endpoint Group | Required Role | Additional Check |
|---------------|:------------:|-----------------|
| `/api/admin/*` | `admin` | JWT valid |
| `/api/rounds` (GET) | `candidate` | Has active invitation |
| `/api/rounds/:id/start` | `candidate` | Round active, invitation valid, no existing session |
| `/api/rounds/:id/questions` | `candidate` | Active session exists for this round |
| `/api/submissions` (POST) | `candidate` | Session active, question belongs to session's round |
| `/api/submissions/:id` (GET) | `candidate` | Own submission only |
| `/api/execute` | `candidate` | Active session (rate limited) |
| `/api/sessions/:id/heartbeat` | `candidate` | Own session only |
| `/api/sessions/:id/events` | `candidate` | Own session only |
| `/api/sessions/:id/complete` | `candidate` | Own active session only |

### 7.3 Database RLS Summary

| Table | Candidate READ | Candidate INSERT | Candidate UPDATE | Admin |
|-------|:--------------:|:----------------:|:----------------:|:-----:|
| `users` | Own row only | ❌ | Own row (name, avatar) | Full |
| `rounds` | Assigned only | ❌ | ❌ | Full |
| `questions` | Assigned round only (no expected_output) | ❌ | ❌ | Full |
| `candidate_sessions` | Own rows only | Restricted¹ | ❌ | Full |
| `submissions` | Own rows (post-release) | Own active session | ❌ | Full |
| `speed_metrics` | ❌ | Own (via submission) | ❌ | Full |
| `audit_logs` | ❌ | Own events only | ❌ | Full |
| `invitations` | Own email only | ❌ | ❌ | Full |

¹ Session creation is handled server-side via service role in `/api/rounds/:id/start`; candidates cannot directly INSERT into sessions.
