# Assessment Platform

A full-stack recruitment assessment platform for technical hiring. Built with **Node.js + Fastify** on the backend and **Vanilla HTML/CSS/JavaScript** on the frontend — no frameworks, no build step.

## Features

### Assessment Types
- **Output Prediction**: Candidates predict the output of code snippets. Auto-graded with exact-match scoring.
- **Live Coding (Python)**: Candidates write Python code in a Monaco editor. Executed entirely in the browser via Pyodide (WebAssembly) — no server-side execution required.
- **Live Coding (C)**: Candidates write C code compiled and executed server-side via `gcc`. Full test case evaluation with TLE detection.
- **MCQ**: Multiple choice questions.

### Anti-Cheat System
- Fullscreen enforcement with auto-disqualification on exit
- Tab switch / window blur monitoring with instant session termination
- Paste detection and keystroke replay recording
- Context menu and DevTools shortcut blocking
- Session status polling — admin can remotely disqualify in real time
- Complete audit trail of all candidate events written to `audit_logs`

### Admin Dashboard
- Round CRUD with publish / pause / unpublish lifecycle
- Question management with expandable cards, starter code, and per-case test case editor
- Visible and hidden test cases with per-case points
- Cutoff score per round (click stat card to edit inline)
- Candidate session management — delete or disqualify from the sessions table
- Typing replay viewer (keystroke playback per question, Monaco viewer, paste markers)
- CSV export — all results or cutoff-filtered

### Public Test Flow (No Auth for Candidates)
- Candidates register with name, email, college, roll number, and branch
- Session token-based flow — no Supabase auth needed for test takers
- Incognito mode confirmation + rules page before entry
- Fullscreen-enforced exam environment
- Auto-submit on timer expiry, tab switch, or fullscreen exit

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 22 + Fastify 4 (ES modules) |
| Frontend | Vanilla HTML + CSS + JavaScript |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (Google OAuth + Magic Link) |
| Code Editor | Monaco Editor (CDN) |
| Python Execution | Pyodide (browser WebAssembly) |
| C Execution | gcc (server-side, via Docker) |
| Deployment | Render.com (Docker) |

## Project Structure

```
assessment-platform/
├── backend/                    # Fastify API server
│   ├── server.js               # Entry point — registers routes + serves frontend/
│   ├── app.js                  # Fastify app builder (routes, middleware, CORS)
│   ├── lib/
│   │   ├── db.js               # Supabase service-role client
│   │   └── scoring.js          # normalizeOutput, computeDerivedMetrics
│   ├── middleware/
│   │   └── auth.js             # requireAdmin — verifies Supabase token + role
│   ├── routes/
│   │   ├── auth.js             # GET /api/auth/user
│   │   ├── admin/
│   │   │   ├── rounds.js       # Round CRUD + publish/pause/export
│   │   │   ├── questions.js    # Question CRUD with test cases
│   │   │   └── sessions.js     # GET/DELETE/disqualify sessions
│   │   └── test/
│   │       ├── rounds.js       # GET /api/test/rounds (public)
│   │       ├── register.js     # POST register + start session
│   │       ├── questions.js    # GET questions for active session
│   │       ├── submit.js       # POST submit answer
│   │       ├── execute_c.js    # POST /api/test/execute-c (gcc compile + run)
│   │       └── session.js      # complete / event / status
│   ├── package.json
│   └── .env.example
│
├── frontend/                   # Static HTML/CSS/JS (no build step)
│   ├── css/app.css             # Complete design system (CSS custom properties)
│   ├── js/
│   │   ├── api.js              # All API fetch methods in one module
│   │   ├── utils.js            # Toast, modal, formatTime, badges, DOM helpers
│   │   └── pyodide-worker.js   # Web Worker for browser Python execution
│   ├── index.html              # Root — redirects admins to /admin/, others to /test/
│   ├── login.html              # Admin login (Supabase OAuth + magic link)
│   ├── admin/
│   │   ├── index.html          # Dashboard (stats + rounds list)
│   │   ├── round.html          # Round detail (questions + sessions tabs)
│   │   └── playback.html       # Typing replay viewer (Monaco + slider)
│   └── test/
│       ├── index.html          # Candidate landing (published rounds)
│       ├── entry.html          # Rules + registration form
│       ├── exam.html           # Exam (Monaco editor + Pyodide/gcc + anti-cheat)
│       └── complete.html       # Completion / disqualification page
│
├── supabase/
│   └── migrations/
│       └── 00003_reset_correct_schema.sql   # Run this for fresh installs
│
├── Dockerfile                  # Node 22 + gcc — used by Render
├── render.yaml                 # Render.com deployment blueprint
└── .dockerignore
```

## Setup

### Prerequisites
- Node.js 22+
- A Supabase project (database + auth)

### 1. Install backend dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Fill in `.env`:
```
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:4000
```

### 3. Configure Supabase credentials in the login page
Open `frontend/login.html` and replace the two placeholder strings:
```js
const SUPABASE_URL  = '__SUPABASE_URL__'
const SUPABASE_ANON = '__SUPABASE_ANON_KEY__'
```

In Supabase Dashboard → Authentication → URL Configuration, set:
- **Site URL**: your deployed app URL (e.g. `https://your-app.onrender.com`)
- **Redirect URLs**: `https://your-app.onrender.com/**`

For local development also add `http://localhost:4000/login.html` as a redirect URL.

### 4. Run database migration
Run in Supabase Dashboard → SQL Editor:
```
supabase/migrations/00003_reset_correct_schema.sql
```

This drops and recreates all tables with the correct schema. At the end of the file, uncomment and run:
```sql
UPDATE users SET role = 'admin' WHERE email = 'you@gmail.com';
```

### 5. Local development
```bash
cd backend
npm run dev        # starts Fastify on http://localhost:4000
```

### 6. Bootstrap the first admin
Sign in via Google at `/login.html`. Then run in Supabase SQL Editor:
```sql
UPDATE users SET role = 'admin' WHERE email = 'you@gmail.com';
```

## Deployment (Render.com)

The repo includes a `Dockerfile` and `render.yaml` for one-click deployment on Render.

1. Push the repo to GitHub
2. Go to [render.com](https://render.com) → **New → Blueprint** → connect your repo
3. Render picks up `render.yaml` automatically — select **Docker** as runtime
4. Set secrets in the Render dashboard (Environment tab):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FRONTEND_URL` → your Render app URL (e.g. `https://your-app.onrender.com`)

The Dockerfile installs `gcc` so C code compilation works out of the box.

> **Free tier note:** The free instance spins down after 15 min of inactivity. First request after sleep takes ~50s.

## API Routes

### Admin Routes (require `Authorization: Bearer <supabase_access_token>` + admin role)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/user` | Get current user profile |
| GET | `/api/admin/rounds` | List all rounds |
| POST | `/api/admin/rounds` | Create round |
| GET | `/api/admin/rounds/:id` | Round detail with questions |
| PUT | `/api/admin/rounds/:id` | Update round |
| DELETE | `/api/admin/rounds/:id` | Delete round |
| POST | `/api/admin/rounds/:id/publish` | Publish round |
| POST | `/api/admin/rounds/:id/unpublish` | Unpublish round |
| POST | `/api/admin/rounds/:id/pause` | Pause round |
| GET | `/api/admin/rounds/:id/sessions` | Sessions for a round |
| GET | `/api/admin/rounds/:id/export` | Export CSV (`?finalized=true` for cutoff filter) |
| POST | `/api/admin/questions` | Create question |
| PUT | `/api/admin/questions/:id` | Update question |
| DELETE | `/api/admin/questions/:id` | Delete question |
| GET | `/api/admin/sessions/:id` | Session detail (for playback) |
| DELETE | `/api/admin/sessions/:id` | Delete session |
| POST | `/api/admin/sessions/:id/disqualify` | Disqualify candidate |

### Public Test Routes (session token via query param or body)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/test/rounds` | Published rounds |
| POST | `/api/test/:roundId/register` | Register candidate, get session_token |
| POST | `/api/test/:roundId/start` | Start session, get expires_at |
| GET | `/api/test/:roundId/questions` | Questions (`?token=...&include_hidden=true`) |
| POST | `/api/test/submit` | Submit answer |
| POST | `/api/test/execute-c` | Compile and run C code (server-side gcc) |
| GET | `/api/test/session/:id/status` | Poll session status (`?token=...`) |
| POST | `/api/test/session/:id/complete` | Mark session complete |
| POST | `/api/test/session/:id/event` | Log audit event (auto-disqualifies on violations) |

## License

MIT
