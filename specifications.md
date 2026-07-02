# Assessment Platform — Technical Specifications

> Precise functional requirements, complete data schema, API specification, and UI/UX guidelines for the Fastify + Vanilla JS rewrite.

---

## Table of Contents

1. [Functional Specification](#1-functional-specification)
2. [Non-Functional Specification](#2-non-functional-specification)
3. [Data Schema](#3-data-schema)
4. [API Specification](#4-api-specification)
5. [UI/UX Guidelines](#5-uiux-guidelines)

---

## 1. Functional Specification

### 1.1 Authentication & Access Control

**FS-AUTH-01: Admin Login — Google OAuth**
- Admin navigates to `/login.html`
- Clicks "Continue with Google" → Supabase OAuth flow → redirect back to `/login.html`
- Supabase JS client (`detectSessionInUrl: true`) auto-exchanges the code
- `session.access_token` stored in `localStorage` as `admin_token`
- Admin redirected to `/admin/`

**FS-AUTH-02: Admin Login — Magic Link**
- Admin enters email on `/login.html`, clicks "Send Magic Link"
- Supabase sends email with one-time link pointing to `/login.html`
- On click: Supabase client detects hash params, `onAuthStateChange` fires
- Token stored in `localStorage`, redirected to `/admin/`

**FS-AUTH-03: Admin Session Verification**
- Every admin API call sends `Authorization: Bearer <token>`
- Fastify `requireAdmin` preHandler:
  1. Extracts token
  2. `supabase.auth.getUser(token)` with anon-key client
  3. Fetches `users.role` with service-role client
  4. 401 if invalid token; 403 if role ≠ 'admin'

**FS-AUTH-04: Candidate Access (No Auth)**
- Candidates are not required to create accounts
- Access gated by `session_token` (UUID v4) generated on registration
- Token passed via query param (`?token=...`) or request body
- Server validates `session_token` exists in `candidate_sessions` for the given round

---

### 1.2 Admin Panel

**FS-ADMIN-01: Dashboard (`/admin/index.html`)**
- Shows stats: total rounds, published, total sessions, completed, disqualified
- Lists all rounds as cards with: title, status badges (Draft/Live/Paused), type badge, session count, duration
- "Manage" button navigates to `/admin/round.html?id=<roundId>`
- "Delete" button with confirmation modal
- "New Round" button opens creation modal

**FS-ADMIN-02: Round Creation Modal**
- Fields: title (required), description, type (live_coding / output_prediction / mcq), duration_minutes, cutoff_score
- On submit: `POST /api/admin/rounds` → redirect to round detail page

**FS-ADMIN-03: Round Detail (`/admin/round.html?id=<id>`)**
- Header: round title, status + type badges, duration
- Action buttons: Edit, Publish/Pause/Unpublish (context-aware)
- Stats row: cutoff (clickable to edit via `prompt()`), question count, session count, completed count, avg score
- Tabs: "Questions" and "Sessions"

**FS-ADMIN-04: Questions Tab**
- Lists questions as expandable accordion cards
- Each card shows: index, title, points badge, type badge, visible/hidden test case count
- Expanded: description, starter code (monospace), all test cases (input / expected output grid)
- "Edit" opens modal pre-populated with question data and test cases
- "Delete" with confirmation

**FS-ADMIN-05: Question Editor Modal**
- Fields: title, type, description, points, order_index, starter_code
- Test case editor: add/remove cases; each case has input (textarea), expected output (textarea), points, hidden toggle
- Hidden toggle is a custom CSS toggle (`.toggle.on`)
- On save: `POST` or `PUT /api/admin/questions` (with full test_cases array — server replaces all)

**FS-ADMIN-06: Sessions Tab**
- Table: Candidate, College/Roll, Status, Score, Started, Actions
- Actions: playback icon (→ `/admin/playback.html?session=<id>`), disqualify icon (with confirm), delete icon (with confirm)
- Export buttons: "Export All" and "Export Finalized" (cutoff-filtered)

**FS-ADMIN-07: Typing Playback (`/admin/playback.html?session=<id>`)**
- Header: candidate name, email, round title, score, status badge
- Sidebar: question selector dropdown, snapshot timeline list (clickable), metrics (CPM, paste count, WPM, etc.)
- Main area: Monaco editor (read-only) showing code at selected snapshot
- Controls: range slider (maps to snapshot index), Play/Pause button, time label, trigger label
- Paste events highlighted in amber in the timeline
- "Disqualify" button with confirmation

---

### 1.3 Candidate Portal

**FS-TEST-01: Landing Page (`/test/index.html`)**
- Shows all published rounds in a responsive card grid
- Each card: title, type badge, duration, active/paused badge
- "Start Assessment" button (if active) → `/test/entry.html?round=<id>`
- "Currently Paused" disabled button (if inactive)
- Shows admin name + "Admin Panel" link if `admin_token` in localStorage

**FS-TEST-02: Entry / Registration (`/test/entry.html?round=<id>`)**
- Shows round info (title, type, duration)
- Rules list (fullscreen, tab switch, no AI, incognito, typing recorded)
- Incognito confirmation toggle (required before proceeding)
- Registration form: full name*, email*, college, roll number, branch
- "Enter Exam" → `POST /api/test/:roundId/register` → `POST /api/test/:roundId/start` → `requestFullscreen()` → navigate to exam

**FS-TEST-03: Exam Page (`/test/exam.html?round=<id>`)**
- Session loaded from `localStorage` key `test_session_<roundId>`
- If no session → redirect to `/test/`
- Layout: top bar, split panel (problem left / editor right), bottom nav

**Top bar:**
- Question progress: "Q 1 / 3"
- Python status indicator (Loading... / Ready)
- Points badge for current question
- Timer countdown (changes color: normal → warning (amber, 5min) → critical (red, 1min))
- Timer progress bar + question progress bar below

**Left panel:**
- Question title, description (pre-wrap)
- Visible test cases: input/expected output per case
- Question navigation dots (gray = not submitted, indigo = current, green = submitted)

**Right panel (editor):**
- Toolbar: "Python 3" label, Run button, Submit button
- Monaco editor (vs-dark theme, Python language, font 14px, no minimap)
- Output panel (11rem height): shows run results (pass/fail per case with diff)

**Bottom nav:**
- Previous / Next buttons
- "Finish Assessment" button (visible only when all questions submitted)

**FS-TEST-04: Anti-Cheat (exam.html)**
- On `visibilitychange` (hidden) → `autoSubmit('tab_switch')`
- On `fullscreenchange` (no element) → `autoSubmit('fullscreen_exit')`
- On `window.blur` → `autoSubmit('window_blur')`
- On `beforeunload` → `autoSubmit('tab_close')` (best-effort)
- `autoSubmit` is guarded by `isSubmitting` and `hasCompleted` refs
- Blocks `Ctrl+U` and `F12` via keydown listener
- `oncontextmenu="return false"` on body

**FS-TEST-05: Python Execution (exam.html)**
- Web Worker loaded from `/js/pyodide-worker.js`
- Worker loads Pyodide from CDN on startup; posts `type:'ready'` when done
- Run: posts `{id, code, testCases}` to worker; resolves with results array
- 15-second timeout: resolves with TLE results; terminates and recreates worker
- Submit: fetches all test cases including hidden; runs all via worker; sends results to server

**FS-TEST-06: Typing Replay Capture (exam.html)**
- Per question: `replays[qid] = { startTime, snapshots: [], runEvents: [] }`
- Snapshot on load: `{ t:0, code: starter_code, trigger:'initial' }`
- Snapshot every 10s (if code changed since last)
- Snapshot on paste (with `pastedContent` from clipboard)
- Snapshot on Run and on Submit
- Sent to server as `typing_replay` field in `/api/test/submit`

**FS-TEST-07: Completion (`/test/complete.html?round=<id>`)**
- Exits fullscreen on page load
- Shows loading card for 1.2s (simulates finalization)
- Polls session status to determine if completed or disqualified
- Completed: shows "Well done!" card with round name
- Disqualified: shows "Session Ended" card with violation message
- Clears session from localStorage

---

## 2. Non-Functional Specification

| ID | Category | Requirement |
|----|----------|-------------|
| NF-01 | Performance | API p95 response time < 200 ms |
| NF-02 | Performance | Python execution (p95) < 5 s via Pyodide |
| NF-03 | Performance | Static frontend LCP < 1.5 s |
| NF-04 | Scalability | Auto-scales on Vercel serverless; Supabase pool is primary constraint |
| NF-05 | Availability | ≥ 99.5% uptime during assessment windows |
| NF-06 | Security | TLS enforced by Vercel CDN / edge network |
| NF-07 | Security | Service role key never sent to browser |
| NF-08 | Security | All user-supplied content HTML-escaped before DOM insertion |
| NF-09 | Security | Rate limit: 200 requests/min/IP (Fastify rate-limit) |
| NF-10 | Browser | Chrome 110+, Firefox 115+, Edge 110+ (fullscreen API required) |
| NF-11 | Correctness | Score computed server-side from client-provided test results |
| NF-12 | Audit | All anti-cheat events written to `audit_logs` before disqualification |

---

## 3. Data Schema

> Migration: `supabase/migrations/00003_reset_correct_schema.sql` — run in Supabase Dashboard → SQL Editor.

### SQL Definitions

```sql
-- Users (populated by Supabase Auth trigger)
CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  full_name   text,
  role        text NOT NULL DEFAULT 'candidate' CHECK (role IN ('admin','candidate')),
  avatar_url  text,
  created_at  timestamptz DEFAULT now()
);

-- Assessment rounds
CREATE TABLE rounds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL,
  description       text,
  round_type        text NOT NULL CHECK (round_type IN ('live_coding','output_prediction','mcq')),
  duration_minutes  int  NOT NULL CHECK (duration_minutes > 0),
  cutoff_score      int,
  is_published      bool DEFAULT false,
  is_active         bool DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

-- Questions per round
CREATE TABLE questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        uuid REFERENCES rounds(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  question_type   text DEFAULT 'coding' CHECK (question_type IN ('coding','output_prediction')),
  points          int  DEFAULT 100,
  starter_code    text,
  expected_output text,
  order_index     int  DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Test cases per question
CREATE TABLE test_cases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      uuid REFERENCES questions(id) ON DELETE CASCADE,
  input            text DEFAULT '',
  expected_output  text NOT NULL,
  is_hidden        bool DEFAULT false,
  points           int  DEFAULT 0,
  order_index      int  DEFAULT 0
);

-- Candidate sessions
CREATE TABLE candidate_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id         uuid REFERENCES rounds(id),
  user_id          uuid REFERENCES users(id),
  session_token    text UNIQUE NOT NULL,
  candidate_name   text,
  candidate_email  text,
  college_name     text,
  roll_no          text,
  branch           text,
  status           text DEFAULT 'registered'
                        CHECK (status IN ('registered','started','completed','disqualified')),
  score            int,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz DEFAULT now()
);

-- Submissions
CREATE TABLE submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid REFERENCES candidate_sessions(id),
  question_id  uuid REFERENCES questions(id),
  user_id      uuid,
  code         text,
  language_id  int  DEFAULT 71,
  status       text DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','wrong_answer')),
  is_final     bool DEFAULT false,
  score        int  DEFAULT 0,
  test_results jsonb,
  created_at   timestamptz DEFAULT now()
);

-- Speed metrics + typing replay
CREATE TABLE speed_metrics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id         uuid REFERENCES submissions(id),
  session_id            uuid REFERENCES candidate_sessions(id),
  question_id           uuid REFERENCES questions(id),
  total_keystrokes      int  DEFAULT 0,
  paste_count           int  DEFAULT 0,
  delete_count          int  DEFAULT 0,
  time_to_first_key_ms  int,
  total_active_time_ms  int  DEFAULT 0,
  idle_periods          jsonb DEFAULT '[]',
  chars_per_minute      float,
  wpm_equivalent        float,
  keystroke_sample      jsonb,  -- typing replay data
  created_at            timestamptz DEFAULT now()
);

-- Audit log
CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid REFERENCES candidate_sessions(id),
  event_type  text NOT NULL,
  event_data  jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
```

---

## 4. API Specification

### Base URL
```
http://localhost:4000                              (local development)
https://assessment-platform-drab.vercel.app       (production)
```

### Common Response Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Missing or invalid auth token |
| 403 | Access denied (wrong role or session mismatch) |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate final submission) |
| 500 | Server error |

### 4.1 Auth

**`GET /api/auth/user`**
Headers: `Authorization: Bearer <token>`
Response:
```json
{
  "id": "uuid",
  "email": "admin@example.com",
  "full_name": "Admin User",
  "role": "admin",
  "avatar_url": "https://..."
}
```

---

### 4.2 Admin — Rounds

**`GET /api/admin/rounds`**
Returns all rounds with candidate session count.
```json
[
  {
    "id": "uuid",
    "title": "Python Coding Round",
    "round_type": "live_coding",
    "duration_minutes": 60,
    "is_published": true,
    "is_active": true,
    "cutoff_score": 70,
    "created_at": "...",
    "candidate_sessions": [{ "count": 42 }]
  }
]
```

**`POST /api/admin/rounds`**
```json
// Request
{
  "title": "Python Coding Round",
  "description": "Write Python solutions",
  "round_type": "live_coding",
  "duration_minutes": 60,
  "cutoff_score": 70
}
// Response 201: round object
```

**`GET /api/admin/rounds/:id`**
Returns round with nested `questions` (each with `test_cases`).

**`PUT /api/admin/rounds/:id`** — update any field

**`DELETE /api/admin/rounds/:id`** — `{ "success": true }`

**`POST /api/admin/rounds/:id/publish`** — sets `is_published=true, is_active=true`

**`POST /api/admin/rounds/:id/pause`** — sets `is_active=false`

**`POST /api/admin/rounds/:id/unpublish`** — sets `is_published=false, is_active=false`

**`GET /api/admin/rounds/:id/sessions`**
Returns sessions with submissions nested.

**`GET /api/admin/rounds/:id/export`**
Query: `?finalized=true` (filter by cutoff_score)
Response: CSV file download (`Content-Type: text/csv`)

---

### 4.3 Admin — Questions

**`POST /api/admin/questions`**
```json
{
  "round_id": "uuid",
  "title": "Two Sum",
  "description": "Find two numbers that add to target...",
  "question_type": "coding",
  "points": 100,
  "order_index": 0,
  "starter_code": "def solve():\n    pass",
  "test_cases": [
    { "input": "5\n3", "expected_output": "8", "is_hidden": false, "points": 50 },
    { "input": "0\n0", "expected_output": "0", "is_hidden": true, "points": 50 }
  ]
}
// Response 201: question with test_cases
```

**`PUT /api/admin/questions/:id`** — same body; test_cases are fully replaced

**`DELETE /api/admin/questions/:id`** — cascades to test_cases

---

### 4.4 Admin — Sessions

**`GET /api/admin/sessions/:id`**
Returns full session with submissions (including `speed_metrics.keystroke_sample` for playback).

**`DELETE /api/admin/sessions/:id`**
Cascades: `speed_metrics` → `submissions` → `audit_logs` → `candidate_sessions`

**`POST /api/admin/sessions/:id/disqualify`**
```json
// Response
{ "id": "uuid", "status": "disqualified", ... }
```

---

### 4.5 Public Test

**`GET /api/test/rounds`**
```json
[
  {
    "id": "uuid",
    "title": "Python Round",
    "description": "...",
    "round_type": "live_coding",
    "duration_minutes": 60,
    "is_active": true
  }
]
```

**`POST /api/test/:roundId/register`**
```json
// Request
{
  "candidate_name": "Alice",
  "candidate_email": "alice@example.com",
  "college_name": "IIT",
  "roll_no": "21CS001",
  "branch": "CS"
}
// Response 201
{
  "session_id": "uuid",
  "session_token": "uuid",
  "round_id": "uuid",
  "already_registered": false
}
```

**`POST /api/test/:roundId/start`**
```json
// Request
{ "session_token": "uuid" }
// Response
{
  "session_id": "uuid",
  "session_token": "uuid",
  "round_id": "uuid",
  "round_title": "Python Round",
  "round_type": "live_coding",
  "duration_minutes": 60,
  "expires_at": "2026-07-02T12:00:00.000Z",
  "started_at": "2026-07-02T11:00:00.000Z"
}
```

**`GET /api/test/:roundId/questions?token=...&include_hidden=true`**
Returns questions with test cases. Hidden cases filtered unless `include_hidden=true`.

**`POST /api/test/submit`**
See implementation.md §5.4 for full request/response example.

**`GET /api/test/session/:id/status?token=...`**
```json
{ "status": "started" }   // or "completed" | "disqualified"
```

**`POST /api/test/session/:id/complete`**
```json
// Request
{ "session_token": "uuid" }
// Response
{ "status": "completed", "score": 150 }
```

**`POST /api/test/session/:id/event`**
```json
// Request
{
  "session_token": "uuid",
  "event_type": "tab_switch",
  "event_data": { "timestamp": 1720000000000 }
}
// Auto-disqualifies on: tab_switch, fullscreen_exit, window_blur, tab_close
// Response
{ "logged": true }
```

---

## 5. UI/UX Guidelines

### 5.1 Design System (`frontend/css/app.css`)

**Color Palette (CSS custom properties — light theme):**
```css
--bg-950: #f8fafc   /* lightest page wash */
--bg-900: #f1f5f9   /* page background */
--bg-850: #eef2f7   /* subtle section tint */
--bg-800: #ffffff   /* cards, modals (white) */
--bg-700: #e2e8f0   /* inputs, dividers */
--text-50:  #0f172a /* headings */
--text-100: #1e293b /* primary body text */
--text-300: #475569 /* secondary text */
--text-400: #64748b /* labels */
--text-500: #94a3b8 /* muted / placeholder */
--indigo-400: #3b82f6  /* accent / links */
--indigo-500: #2563eb  /* primary action */
--indigo-600: #1d4ed8  /* primary hover */
--green-400: #4ade80   /* success */
--red-400:   #f87171   /* danger */
--amber-400: #fbbf24   /* warning */
--border: #e2e8f0
```

**Typography:**
- Font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Monospace: `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`

**Component classes:** `.btn`, `.btn-primary`, `.btn-success`, `.btn-danger`, `.btn-ghost`, `.btn-outline`, `.btn-icon`, `.input`, `.textarea`, `.select`, `.card`, `.stat-card`, `.badge`, `.modal-backdrop`, `.toast`

### 5.2 Admin Layout

```
┌─────────────┬───────────────────────────────────────┐
│  Sidebar    │  Content Header                       │
│  220px wide │  Title + breadcrumb + action buttons  │
│             ├───────────────────────────────────────┤
│  Logo       │  Content Body                         │
│  Nav links  │  Stats grid + main content            │
│  User info  │                                       │
│  Sign out   │                                       │
└─────────────┴───────────────────────────────────────┘
```

On mobile (< 768px): sidebar overlays, toggled by ☰ button.

### 5.3 Exam Layout

```
┌─────────────────────────────────────────────────────┐
│  Top Bar: Q progress | Python status | Timer        │
│  Timer bar (color-coded) + Question progress bar    │
├───────────────────────┬─────────────────────────────┤
│  Left Panel (40%)     │  Right Panel (60%)          │
│  Question title       │  Editor toolbar             │
│  Description          │  Monaco Editor              │
│  Visible test cases   │  (Python, vs light, no mini) │
│  Navigation dots      │  Output panel (11rem)       │
├───────────────────────┴─────────────────────────────┤
│  Bottom Nav: Previous | Next | Finish Assessment    │
└─────────────────────────────────────────────────────┘
```

### 5.4 Timer Color States

| State | Condition | Bar Color | Text Color |
|-------|-----------|-----------|------------|
| Normal | > 5 min remaining | `--indigo-600` | `--text-300` |
| Warning | ≤ 5 min remaining | `--amber-500` | `--amber-400` |
| Critical | ≤ 1 min remaining | `--red-600` | `--red-400` |

### 5.5 Question Navigation Dots

| State | Style |
|-------|-------|
| Not visited / unsubmitted | Dark gray (`.bg-700`) |
| Current | Indigo (`.indigo-600`) |
| Submitted | Green (`.green-600`) |

### 5.6 Toast Notifications

Positioned bottom-right, auto-dismiss after 3.5s.
- Success: green left border
- Error: red left border
- Warning: amber left border
- Info: indigo left border

### 5.7 Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| > 768px | Full sidebar + horizontal exam split |
| ≤ 768px | Sidebar overlays; exam stacks vertically (problem on top, editor below) |
| ≤ 480px | Stats grids collapse to 1 column |
