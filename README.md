# CodeAssess - Technical Assessment Platform

A full-stack recruitment assessment platform for technical hiring. Built with Next.js 14, Supabase, and Judge0 for secure, proctored coding assessments.

## Features

### Assessment Types
- **Round 1 - C Output Prediction**: Candidates predict the output of C code snippets. Auto-graded with exact match scoring.
- **Round 2 - Live Coding**: Candidates write code in a Monaco editor with multi-language support (C, C++, Python, JS, Java, Go). Executed and graded via Judge0.

### Anti-Cheat System
- Fullscreen enforcement with violation tracking and auto-disqualification
- Tab switch monitoring with configurable limits
- Paste detection and copy logging
- Context menu and DevTools blocking
- Speed metrics tracking (keystrokes, CPM, idle periods, time to first key)
- Complete audit trail of all candidate actions

### Admin Dashboard
- Round CRUD with publish/pause lifecycle
- Question management with code snippets and test cases
- Candidate invitation via email (Supabase magic links)
- Real-time session monitoring via Supabase Realtime
- Per-session results with submissions, test results, speed metrics, and audit logs
- CSV export of round results

### Security
- HMAC-signed invitation tokens with timing-safe comparison
- Row Level Security (RLS) on all database tables
- Service role client for admin operations
- Session expiry enforcement (server-side + client-side)
- Input validation on all API endpoints

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (Google OAuth + Magic Link) |
| Realtime | Supabase Realtime |
| Code Editor | Monaco Editor (@monaco-editor/react) |
| Code Execution | Judge0 CE (via RapidAPI) |
| UI Components | shadcn/ui + Radix UI + Tailwind CSS |
| Deployment | Vercel |

## Project Structure

```
src/
  app/
    (auth)/login/          # Login page (Google OAuth + Magic Link)
    admin/                 # Admin dashboard
      rounds/[id]/         # Round detail (questions + candidates)
      monitor/[roundId]/   # Live session monitoring
      results/[roundId]/   # Session results viewer
      candidates/          # All candidates overview
    assess/                # Candidate dashboard
      [roundId]/           # Round entry + instructions
      [roundId]/r1/        # Round 1 - Output prediction
      [roundId]/r2/        # Round 2 - Live coding
      [roundId]/complete/  # Completion confirmation
    api/
      admin/               # Admin API routes (service role)
      auth/                # Auth callback + bootstrap
      rounds/              # Candidate rounds API
      sessions/            # Session events, heartbeat, complete
      submissions/         # Submission + auto-grading
      execute/             # Judge0 code execution proxy
  components/
    ui/                    # shadcn/ui components
    admin/                 # Admin navigation
    assess/                # FullscreenGuard, TimerBar
  lib/
    supabase/              # Client, server, middleware
    scoring/               # Output normalization + scoring
    judge0/                # Judge0 client + language config
    auth/                  # HMAC invitation tokens
    metrics/               # Speed metrics computation
  types/                   # TypeScript type definitions
supabase/
  migrations/              # Database schema (SQL)
```

## Setup

### Prerequisites
- Node.js 18+
- Supabase project
- Judge0 API key (RapidAPI)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
- Create a Supabase project
- Run the migration in SQL Editor: `supabase/migrations/00001_initial_schema.sql`
- Enable Google OAuth in Authentication > Providers
- Enable Realtime for: `candidate_sessions`, `submissions`, `audit_logs`

### 3. Configure environment variables
Copy `.env.example` to `.env` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-rapidapi-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=random-32-char-string
INVITATION_SECRET=random-secret-for-hmac
ADMIN_BOOTSTRAP_TOKEN=random-token
```

### 4. Bootstrap admin account
```bash
npm run dev
```
Sign in via Google at `/login`, then run in browser console:
```js
fetch('/api/auth/bootstrap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'your-ADMIN_BOOTSTRAP_TOKEN' })
}).then(r => r.json()).then(console.log)
```

### 5. Deploy to Vercel
```bash
vercel --prod
```
Update Supabase Auth redirect URLs to match your Vercel domain.

## API Routes

### Admin Routes (require admin role)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/admin/rounds` | List/create rounds |
| GET/PUT/DELETE | `/api/admin/rounds/[id]` | Round CRUD |
| POST | `/api/admin/rounds/[id]/publish` | Publish round |
| POST | `/api/admin/rounds/[id]/pause` | Pause round |
| GET/POST | `/api/admin/rounds/[id]/questions` | Round questions |
| GET | `/api/admin/rounds/[id]/sessions` | Round sessions |
| GET | `/api/admin/rounds/[id]/export` | CSV export |
| POST | `/api/admin/invitations` | Invite candidates |
| GET | `/api/admin/candidates` | All candidates |
| PUT/DELETE | `/api/admin/questions/[id]` | Question CRUD |
| POST | `/api/admin/sessions/[id]/disqualify` | Disqualify |
| GET | `/api/admin/sessions/[id]/submissions` | Submissions |
| GET | `/api/admin/sessions/[id]/audit-logs` | Audit logs |

### Candidate Routes (require auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rounds` | Available rounds |
| POST | `/api/rounds/[id]/start` | Start session |
| GET | `/api/rounds/[id]/questions` | Get questions |
| POST | `/api/submissions` | Submit answer |
| POST | `/api/sessions/[id]/events` | Log events |
| POST | `/api/sessions/[id]/heartbeat` | Heartbeat |
| POST | `/api/sessions/[id]/complete` | Complete session |
| POST | `/api/execute` | Execute code (Judge0) |
| GET | `/api/execute/[token]` | Poll execution result |

## License

MIT
