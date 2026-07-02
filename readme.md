# Assessment Platform — Technical Overview

> A secure, full-stack platform for technical hiring: admin-managed coding rounds with browser-based Python execution, speed analytics, and anti-cheat controls. Built with Node.js + Fastify and vanilla HTML/CSS/JS — no frameworks, no build step.

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Diagram](#3-architecture-diagram)
4. [Key Features](#4-key-features)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Environment Variables](#6-environment-variables)
7. [Setup & Local Development](#7-setup--local-development)
8. [Deployment](#8-deployment)

---

## 1. Overview & Goals

The Assessment Platform provides a controlled, observable environment for multi-round technical screening. Admins design rounds, publish them to candidates, and monitor submissions in real time. Candidates take timed coding challenges inside a fullscreen-enforced browser session, with every interaction logged for integrity review.

| Goal | Description |
|------|-------------|
| **Fair & Consistent** | Every candidate faces identical questions, identical time limits, and identical browser-based Python execution |
| **Secure Execution** | All code runs in a browser WebAssembly sandbox (Pyodide) — zero server-side execution surface |
| **Observable** | Speed metrics, keystroke replay, and behavioral events accompany every submission |
| **Operator Control** | Admins can publish, pause, and audit any round at any time; remote disqualification is instant |
| **Scales Simply** | Stateless REST API + static frontend — add more servers behind a load balancer, done |

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Backend** | Node.js 20 + Fastify 4 (ES modules) | Fast, low-overhead HTTP server; stateless; horizontally scalable |
| **Frontend** | Vanilla HTML + CSS + JavaScript | No framework, no build step, served as static files from CDN or Nginx |
| **Database** | Supabase PostgreSQL 15 | Managed Postgres, Row Level Security, Auth integration |
| **Auth** | Supabase Auth | Google OAuth + Magic Link; JWT validated by backend middleware |
| **Code Editor** | Monaco Editor (CDN) | VS Code-grade editing experience, loaded from CDN |
| **Code Execution** | Pyodide (browser WebAssembly) | Python 3 runs entirely in the browser — no server-side sandbox needed |
| **Deployment** | Any VPS / Docker / Nginx | No platform lock-in; single `node server.js` command |

### Why no framework on the frontend?

- Zero framework overhead → faster initial load
- Static files served from CDN or Nginx (no SSR CPU cost)
- Works on any deployment target without Node.js
- Easier to understand and maintain without build toolchain

### Why Fastify instead of Express?

- ~2× faster than Express in benchmarks
- Built-in schema validation and serialization
- Production-grade plugin ecosystem (`@fastify/cors`, `@fastify/static`, `@fastify/rate-limit`)

### Why Pyodide instead of Judge0?

- No external service dependency, no API keys
- Code executes locally in the candidate's browser — zero server load per submission
- Python 3.11 runtime via WebAssembly, sandboxed by the browser
- Works offline (after initial CDN load)

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                           │
│                                                                     │
│   ┌──────────────────────┐     ┌──────────────────────────────┐     │
│   │    Admin Panel        │     │      Candidate Portal        │     │
│   │  /admin/*.html        │     │    /test/*.html              │     │
│   │                      │     │                              │     │
│   │  • Round management  │     │  • Fullscreen exam session   │     │
│   │  • Question editor   │     │  • Monaco code editor        │     │
│   │  • Session table     │     │  • Pyodide Python execution  │     │
│   │  • Typing playback   │     │    (Web Worker, WASM)        │     │
│   └──────────┬───────────┘     └────────────┬─────────────────┘     │
│              │ fetch /api/*                 │ fetch /api/test/*     │
└──────────────┼───────────────────────────────┼──────────────────────┘
               │                              │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Fastify Server  (Node.js, port 4000)                  │
│                                                                     │
│   Serves frontend/ as static files         Handles API routes       │
│                                                                     │
│   GET  /api/auth/user          (verify Supabase token)             │
│   GET  /api/admin/rounds       (admin CRUD)                        │
│   POST /api/admin/rounds/:id/publish                               │
│   GET  /api/admin/sessions/:id (playback data)                     │
│   POST /api/admin/sessions/:id/disqualify                          │
│   GET  /api/admin/rounds/:id/export  (CSV download)                │
│   GET  /api/test/rounds        (public — published rounds)         │
│   POST /api/test/:roundId/register   (session_token issued)        │
│   POST /api/test/:roundId/start      (timer starts)               │
│   GET  /api/test/:roundId/questions  (token-gated)                 │
│   POST /api/test/submit              (score from Pyodide results)  │
│   POST /api/test/session/:id/event   (audit + auto-disqualify)     │
│   GET  /api/test/session/:id/status  (admin-initiated DQ poll)     │
│                                                                     │
│   requireAdmin middleware:                                          │
│     Authorization: Bearer <token> → supabase.auth.getUser() →      │
│     check users.role = 'admin'                                      │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
              ┌─────────────────────────────────────┐
              │         Supabase Cloud               │
              │                                     │
              │  ┌─────────────────────────────┐   │
              │  │   PostgreSQL (with RLS)      │   │
              │  │   • users                   │   │
              │  │   • rounds                  │   │
              │  │   • questions               │   │
              │  │   • test_cases              │   │
              │  │   • candidate_sessions      │   │
              │  │   • submissions             │   │
              │  │   • speed_metrics           │   │
              │  │   • audit_logs              │   │
              │  └─────────────────────────────┘   │
              │  ┌─────────────────────────────┐   │
              │  │   Supabase Auth              │   │
              │  │   Google OAuth + Magic Link  │   │
              │  └─────────────────────────────┘   │
              └─────────────────────────────────────┘
```

---

## 4. Key Features

### Admin Panel

| Feature | Description |
|---------|-------------|
| Round Builder | Create/edit rounds (type, duration, cutoff score) |
| Question Editor | Add questions with starter code and test cases (visible + hidden, per-case points) |
| Publish / Pause | Toggle round availability; candidates see "Paused" on inactive rounds |
| Session Table | Per-candidate status, score, timestamps; delete or disqualify in one click |
| Typing Playback | Monaco-based replay of keystroke snapshots; paste detection markers; timeline slider |
| CSV Export | All results or cutoff-filtered; downloads directly from the browser |

### Candidate Portal

| Feature | Description |
|---------|-------------|
| Landing Page | Shows all published active rounds; "Currently Paused" shown when inactive |
| Entry / Registration | Rules acceptance, incognito confirmation, name/email/college/roll/branch form |
| Exam Page | Monaco editor + Pyodide (browser Python); visible test case run + final submit |
| Speed Tracking | Keystrokes, paste count, deletes, idle periods captured invisibly |
| Typing Replay | Code snapshots every 10s + on paste, run, submit — stored in `speed_metrics.keystroke_sample` |
| Timer | Countdown bar; auto-submit on expiry |
| Fullscreen Guard | Enter on session start; exit = immediate disqualification |
| Tab Monitor | `visibilitychange` = disqualification; `window.blur` = disqualification |
| Session Polling | Every 10s checks if admin has disqualified remotely |

---

## 5. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| **Performance** | API response time (p95) | < 200 ms |
| **Performance** | Python execution in browser (p95) | < 5 s (Pyodide WASM) |
| **Performance** | Frontend page load (LCP) | < 1.5 s (static files from CDN) |
| **Availability** | Uptime during assessment windows | ≥ 99.5% |
| **Scalability** | Concurrent candidates per server | 500+ on a $10/mo VPS (static frontend = zero server load per candidate) |
| **Security** | Transport encryption | TLS 1.3 (via Nginx or Cloudflare) |
| **Security** | Auth | Supabase JWT; service role key never sent to browser |
| **Security** | Code execution | Browser sandbox (Pyodide/WASM); no server exposure |
| **Browser Support** | Candidates | Chrome 110+, Firefox 115+, Edge 110+ |
| **Audit** | Log retention | `audit_logs` table; export via CSV |

---

## 6. Environment Variables

Create `backend/.env` (copy from `backend/.env.example`):

```dotenv
# Server
PORT=4000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...          # safe for use in frontend too
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # server-side ONLY — never expose to browser

# Frontend origin (for CORS in development; set true in production to allow all)
FRONTEND_URL=http://localhost:4000

# Logging
LOG_LEVEL=info
```

Also update `frontend/login.html` — replace the two `__PLACEHOLDER__` strings with your actual Supabase URL and anon key (these are safe to expose in client code).

---

## 7. Setup & Local Development

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS |
| A Supabase project | Any plan |

### Step-by-step

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — add your Supabase URL and keys

# 3. Update login.html with Supabase credentials
# Open frontend/login.html and replace __SUPABASE_URL__ and __SUPABASE_ANON_KEY__

# 4. Add the redirect URL in Supabase Dashboard
# Authentication → URL Configuration → Redirect URLs → add:
#   http://localhost:4000/login.html

# 5. Run database migrations
# Supabase Dashboard → SQL Editor → run:
#   supabase/migrations/00001_initial_schema.sql
#   supabase/migrations/00002_add_session_fields.sql

# 6. Start the server
npm run dev   # auto-restart on changes
# or
npm start     # production
```

Visit `http://localhost:4000` — Fastify serves both the API and the static frontend.

### Make yourself an admin

Sign in with Google at `/login.html`, then in Supabase Dashboard → Table Editor → `users`, set `role = 'admin'` for your row.

### Dev commands

```bash
npm run dev     # Node.js --watch (restarts on file changes)
npm start       # production start
```

---

## 8. Deployment

### Option A — Single VPS (simplest, recommended)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Clone repo, install deps
cd backend && npm install --production

# Run with PM2 (process manager)
npm install -g pm2
pm2 start server.js --name assessment-platform
pm2 save
pm2 startup

# Open port 4000 or put Nginx in front
```

### Option B — Nginx + Node.js (production best practice)

Nginx serves the static frontend (ultra-fast, CDN-cacheable), Node.js handles only API requests.

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/assessment-platform/frontend;
    index index.html;

    # Proxy API requests to Fastify
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # All other requests serve static files
    location / {
        try_files $uri $uri.html $uri/ /index.html;
    }
}
```

### Option C — Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production
COPY . .
WORKDIR /app/backend
ENV PORT=4000
EXPOSE 4000
CMD ["node", "server.js"]
```

```bash
docker build -t assessment-platform .
docker run -p 4000:4000 --env-file backend/.env assessment-platform
```

### Scalability

To serve more concurrent users, run multiple Node.js instances behind a load balancer (Nginx upstream or HAProxy). Since the API is completely stateless and the frontend is static, this requires zero application changes:

```nginx
upstream api_servers {
    server 127.0.0.1:4000;
    server 127.0.0.1:4001;
    server 127.0.0.1:4002;
}

location /api/ {
    proxy_pass http://api_servers;
}
```

The database connection pool in Supabase (pgBouncer) handles the connection load automatically.
