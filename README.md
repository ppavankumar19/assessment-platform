# Assessment Platform

A full-stack technical assessment platform for college placements and hiring drives. Built with **Node.js + Fastify** on the backend and **Vanilla HTML/CSS/JS** on the frontend — no frameworks, no build step.

---

## Assessment Types

| Type | How it works |
|------|-------------|
| **Output Prediction** | Candidates read a code snippet and predict what it prints. Auto-graded with exact-match + partial-credit scoring. |
| **MCQ** | Multiple-choice questions with 4 options (A–D). Server-side scoring; correct option never exposed to candidates. |

---

## Features

### Admin Portal
- **Round CRUD** — create, edit, publish, pause, unpublish assessment rounds
- **Question CRUD** — rich editor with MCQ options or code snippet + test cases
- **Draft questions** — toggle any question to draft (hidden from candidates until published)
- **Auto-distribute points** — test case points split equally from the question's total; updates live
- **Question Library** — reusable question bank; import into any round in one click
- **Cutoff score** — set passing threshold per round; used for CSV export filtering
- **Session management** — view candidates, disqualify, delete sessions
- **Typing replay** — playback page with keystroke timeline, Monaco viewer, paste markers
- **CSV export** — export all results or cutoff-filtered finalists

### Anti-Cheat System
- **Fullscreen enforcement** — auto-disqualifies on exit
- **Tab switch monitoring** — session terminated instantly on visibility change
- **Paste detection** — logged with content for malpractice review
- **DevTools / hotkey blocking** — Ctrl+U, F12 blocked
- **Session status polling** — admin can remotely disqualify a live session in real time
- **15-minute registration timer** — candidates must complete registration before it expires
- **Audit trail** — every candidate event written to `audit_logs`

### Candidate Flow (no login required)
1. Browse published rounds at `/test/`
2. Read rules + confirm incognito mode + register details (`/test/entry.html`)
3. Exam auto-enters fullscreen and starts timer (`/test/exam.html`)
4. MCQ: select one of A–D and submit per question
5. Output Prediction: type predicted output per visible test case and submit
6. Auto-submit on timer expiry, tab switch, or fullscreen exit
7. Completion screen shows result or disqualification reason (`/test/complete.html`)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 22+ · Fastify 4 · ES modules |
| Frontend | Vanilla HTML · CSS custom properties · ES module JS |
| Database | PostgreSQL via Supabase |
| Admin Auth | Supabase Auth (Google OAuth + Magic Link) |
| Code display | Monaco Editor (CDN, read-only) |
| Deployment | Render.com (Docker) |

---

## Project Structure

```
assessment-platform/
├── backend/
│   ├── server.js               # Entry — registers Fastify app + serves frontend/
│   ├── app.js                  # Route registrations, CORS, rate-limit, error handler
│   ├── lib/
│   │   ├── db.js               # Supabase service-role client
│   │   └── scoring.js          # normalizeOutput, computeDerivedMetrics
│   ├── middleware/
│   │   └── auth.js             # requireAdmin (Supabase token + role check)
│   ├── routes/
│   │   ├── auth.js             # GET /api/auth/user
│   │   ├── admin/
│   │   │   ├── rounds.js       # Round CRUD + publish/pause/export
│   │   │   ├── questions.js    # Question + test case CRUD
│   │   │   ├── sessions.js     # GET/DELETE/disqualify sessions
│   │   │   └── library.js      # Library CRUD + import to round
│   │   └── test/
│   │       ├── rounds.js       # GET /api/test/rounds (public)
│   │       ├── register.js     # POST register + start session
│   │       ├── questions.js    # GET questions (strips correct MCQ option)
│   │       ├── answer.js       # POST /api/test/answer (MCQ + OP, server-side scoring)
│   │       └── session.js      # complete / event / status
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── css/app.css             # Design system — dark theme, CSS custom properties
│   ├── js/
│   │   ├── api.js              # All API fetch methods
│   │   └── utils.js            # Toast, modal, formatTime, badges, session helpers
│   ├── index.html              # Root redirect (admin → /admin/, else → /test/)
│   ├── login.html              # Admin login (Supabase OAuth + magic link)
│   ├── admin/
│   │   ├── index.html          # Dashboard — stats + rounds list
│   │   ├── round.html          # Round detail — questions, sessions, library import
│   │   ├── library.html        # Question Library CRUD portal
│   │   └── playback.html       # Keystroke replay viewer
│   └── test/
│       ├── index.html          # Candidate landing (published rounds)
│       ├── entry.html          # Rules + 15-min registration timer
│       ├── exam.html           # Exam — MCQ or Output Prediction, anti-cheat
│       └── complete.html       # Completion / disqualification screen
│
├── scripts/
│   └── seed-sample-data.mjs   # Seed 3 sample rounds (run from backend/ dir)
│
├── supabase/
│   └── migrations/
│       ├── 00003_reset_correct_schema.sql   # Fresh install — drops + recreates all tables
│       └── 00004_mcq_library_draft.sql      # Adds MCQ, Library, Draft support
│
├── Dockerfile
├── render.yaml
└── .dockerignore
```

---

## Setup

### Prerequisites
- Node.js 22+
- Supabase project (free tier works)

### 1. Clone and install

```bash
git clone <repo-url>
cd assessment-platform/backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `backend/.env`:
```env
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:4000
```

### 3. Configure Supabase credentials in the login page

Open `frontend/login.html` and set the two constants near the top of the `<script>` block:

```js
const SUPABASE_URL  = 'https://your-project.supabase.co'
const SUPABASE_ANON = 'your-anon-key'
```

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `http://localhost:4000` (local) or your Render URL
- **Redirect URLs**: add `http://localhost:4000/login.html` and `https://your-app.onrender.com/login.html`

### 4. Run database migrations

In **Supabase Dashboard → SQL Editor**, run in order:

1. `supabase/migrations/00003_reset_correct_schema.sql` — fresh schema (drops everything first)
2. `supabase/migrations/00004_mcq_library_draft.sql` — adds MCQ options, draft, and library table

### 5. Bootstrap your admin account

Sign in at `http://localhost:4000/login.html` with Google or magic link. Then in Supabase SQL Editor:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

### 6. Start development server

```bash
cd backend
npm run dev    # http://localhost:4000  (auto-restarts on file changes)
```

### 7. (Optional) Seed sample data

Creates 3 live sample rounds: Python Basics, CS Fundamentals MCQ, Code Output Challenge.

```bash
node --env-file=backend/.env scripts/seed-sample-data.mjs
# Note: run from the project root but the script must resolve node_modules in backend/
# Alternatively: cp scripts/seed-sample-data.mjs backend/ && cd backend && node --env-file=.env seed-sample-data.mjs
```

---

## Deployment (Render.com)

1. Push repo to GitHub
2. Render → **New → Web Service** → connect repo → select **Docker** environment
3. Set environment variables in Render dashboard:
   | Variable | Value |
   |----------|-------|
   | `SUPABASE_URL` | your Supabase project URL |
   | `SUPABASE_ANON_KEY` | anon/public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role key (keep secret) |
   | `FRONTEND_URL` | `https://your-app.onrender.com` |

> **Free tier note:** Instance sleeps after 15 min of inactivity. First request after wake takes ~30–50 s.

---

## API Reference

### Admin Routes
Require `Authorization: Bearer <supabase_access_token>` header and `role = 'admin'`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/user` | Current admin profile |
| GET | `/api/admin/rounds` | List all rounds |
| POST | `/api/admin/rounds` | Create round |
| GET | `/api/admin/rounds/:id` | Round + questions + sessions stats |
| PUT | `/api/admin/rounds/:id` | Update round |
| DELETE | `/api/admin/rounds/:id` | Delete round |
| POST | `/api/admin/rounds/:id/publish` | Publish (visible to candidates) |
| POST | `/api/admin/rounds/:id/unpublish` | Unpublish |
| POST | `/api/admin/rounds/:id/pause` | Pause (published but no new sessions) |
| GET | `/api/admin/rounds/:id/sessions` | All candidate sessions |
| GET | `/api/admin/rounds/:id/export` | CSV (`?finalized=true` = cutoff filter) |
| POST | `/api/admin/questions` | Create question (with test cases) |
| PUT | `/api/admin/questions/:id` | Update question |
| DELETE | `/api/admin/questions/:id` | Delete question |
| GET | `/api/admin/library` | List library questions (`?type=&search=`) |
| POST | `/api/admin/library` | Add to library |
| PUT | `/api/admin/library/:id` | Update library question |
| DELETE | `/api/admin/library/:id` | Delete from library |
| POST | `/api/admin/library/:id/import` | Import to a round (`{round_id}`) |
| GET | `/api/admin/sessions/:id` | Session detail (playback data) |
| DELETE | `/api/admin/sessions/:id` | Delete session |
| POST | `/api/admin/sessions/:id/disqualify` | Disqualify candidate |

### Public Test Routes
No authentication. Session token passed via query param `?token=` or request body.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/test/rounds` | Published + active rounds |
| POST | `/api/test/:roundId/register` | Register candidate, receive `session_token` |
| POST | `/api/test/:roundId/start` | Start session, receive `expires_at` |
| GET | `/api/test/:roundId/questions` | Questions for active session (MCQ options stripped of correct answer) |
| POST | `/api/test/answer` | Submit MCQ or Output Prediction answer (server-side scored) |
| GET | `/api/test/session/:id/status` | Poll session status (for admin disqualification) |
| POST | `/api/test/session/:id/complete` | Mark session complete |
| POST | `/api/test/session/:id/event` | Log audit event (auto-disqualifies on violations) |

---

## Database Schema (key tables)

```
rounds            — title, round_type (output_prediction|mcq), duration_minutes, is_published, is_active, cutoff_score
questions         — round_id, title, description, question_type, points, starter_code, mcq_options (JSONB), is_draft
test_cases        — question_id, input, expected_output, is_hidden, points
library_questions — title, description, question_type, points, starter_code, mcq_options, tags[]
candidate_sessions— session_token, candidate_name/email/college/roll_no/branch, status, score
submissions       — session_id, question_id, code (MCQ: selected option), score, status, test_results (JSONB)
audit_logs        — session_id, event_type, event_data
```

---

## Sample Data

The seed script creates three ready-to-use rounds:

| Round | Type | Questions | Duration |
|-------|------|-----------|----------|
| Python Basics | Output Prediction | 2 (Even/Odd, Print N) | 30 min |
| CS Fundamentals MCQ | MCQ | 5 (algorithms, syntax, HTML) | 20 min |
| Code Output Challenge | Output Prediction | 5 (slicing, loops, methods) | 45 min |

---

## License

MIT
