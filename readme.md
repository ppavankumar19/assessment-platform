# CodeAssess — Recruitment Assessment Platform

> A secure, full-stack platform for technical hiring: admin-managed coding rounds with sandboxed execution, speed analytics, and anti-cheat controls.

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
9. [Testing Approach](#9-testing-approach)
10. [CI/CD Pipeline](#10-cicd-pipeline)

---

## 1. Overview & Goals

CodeAssess provides a controlled, observable environment for multi-round technical screening. Admins design rounds, publish them to invited candidates, and monitor submissions in real time. Candidates take timed coding challenges inside a fullscreen-enforced browser session, with every interaction logged for integrity review.

| Goal | Description |
|------|-------------|
| **Fair & Consistent** | Every candidate faces identical questions, identical time limits, identical execution sandboxes |
| **Secure Execution** | All submitted code runs inside an isolated sandbox; no host system exposure |
| **Observable** | Speed metrics, keystroke patterns, and behavioral events accompany every submission |
| **Operator Control** | Admins can publish, pause, and audit any round at any time |
| **Deployment-Ready** | Fully containerised / serverless; one-command deploys via Vercel + Supabase + Fly.io |

---

## 2. Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Framework** | Next.js (App Router) | 14.x | SSR, API routes, file-based routing, Edge Runtime support |
| **Language** | TypeScript | 5.x | End-to-end type safety across frontend and backend |
| **UI** | Tailwind CSS + shadcn/ui | 3.x / latest | Utility-first styling, accessible, headless components |
| **Code Editor** | Monaco Editor (`@monaco-editor/react`) | 4.x | VS Code-grade editing, multi-language syntax highlighting |
| **Auth** | Supabase Auth | Managed | Google OAuth + Magic Link; JWT with RLS integration |
| **Database** | Supabase PostgreSQL | 15.x | Managed Postgres, Row Level Security, real-time subscriptions |
| **Backend Logic** | Next.js API Routes + Supabase Edge Functions | — | Co-located serverless handlers; Deno-based edge functions |
| **Code Execution** | Judge0 CE (self-hosted) | 1.13.x | Open-source, multi-language, `isolate`-based sandbox |
| **File Storage** | Supabase Storage | Managed | Test assets, exported CSV/PDF reports |
| **Deployment — App** | Vercel | — | Zero-config Next.js deployment, global CDN, preview URLs |
| **Deployment — Judge0** | Fly.io (Docker) | — | Persistent container with private networking |
| **Monitoring** | Sentry + Vercel Analytics | — | Error tracking, Web Vitals, performance budgets |
| **Testing** | Vitest + React Testing Library + Playwright | — | Unit, component, and E2E coverage |
| **CI/CD** | GitHub Actions | — | Lint → test → build → deploy pipeline |

### Language Runtimes Supported (Judge0)

| Language | Judge0 ID | Round Availability |
|----------|-----------|--------------------|
| C (GCC 9.2) | 50 | Round 1 (snippet prediction), Round 2 |
| C++ (GCC 9.2) | 54 | Round 2 |
| Python 3 (3.8) | 71 | Round 2 |
| JavaScript (Node 12) | 63 | Round 2 |
| Java (OpenJDK 13) | 62 | Round 2 |
| Go (1.13.5) | 60 | Round 2 |

Additional languages can be enabled by updating the `allowed_languages` config per round.

---

## 3. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            Browser (Client)                              │
│                                                                          │
│   ┌─────────────────────────┐      ┌─────────────────────────────────┐  │
│   │      Admin Panel        │      │       Candidate Portal          │  │
│   │  /admin/* (Next.js)     │      │   /assess/* (Next.js)           │  │
│   │                         │      │                                  │  │
│   │  • Round management     │      │  • Fullscreen-enforced session  │  │
│   │  • Live monitoring      │      │  • Monaco editor (Round 2)      │  │
│   │  • Results & export     │      │  • Output prediction (Round 1)  │  │
│   └───────────┬─────────────┘      └────────────────┬────────────────┘  │
│               │ HTTPS                               │ HTTPS / Supabase  │
└───────────────┼─────────────────────────────────────┼────────────────────┘
                │                                     │
                ▼                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  Next.js API Layer  (Vercel Serverless)                   │
│                                                                          │
│   /api/admin/*        /api/rounds/*       /api/submissions/*             │
│   /api/execute/*      /api/sessions/*     /api/auth/*                    │
│                                                                          │
│            ┌────────────────────────────────────────┐                   │
│            │       Supabase Edge Functions           │                   │
│            │  • submission-scorer                    │                   │
│            │  • audit-event-recorder                 │                   │
│            │  • session-timeout-enforcer             │                   │
│            └────────────────────────────────────────┘                   │
└───────────────┬──────────────────────────────────────────────┬──────────┘
                │                                              │
                ▼                                              ▼
┌──────────────────────────────┐           ┌──────────────────────────────┐
│       Supabase Cloud          │           │     Judge0 CE  (Fly.io)      │
│                              │           │                              │
│  ┌──────────────────────┐   │           │  ┌────────────────────────┐  │
│  │   PostgreSQL (RLS)    │   │           │  │   isolate  sandbox     │  │
│  │   • users            │   │           │  │   per-submission       │  │
│  │   • rounds           │   │           │  │   Linux container      │  │
│  │   • questions        │   │           │  │   CPU + memory limits  │  │
│  │   • sessions         │   │           │  └────────────────────────┘  │
│  │   • submissions      │   │           │                              │
│  │   • speed_metrics    │   │           │  Supported runtimes:         │
│  │   • audit_logs       │   │           │  C / C++ / Python / JS       │
│  └──────────────────────┘   │           │  Java / Go / Rust            │
│  ┌──────────────────────┐   │           └──────────────────────────────┘
│  │   Supabase Auth       │   │
│  │   OAuth / Magic Link  │   │
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │   Supabase Storage    │   │
│  │   (reports, assets)   │   │
│  └──────────────────────┘   │
└──────────────────────────────┘

Real-time (Supabase Realtime) ──► Admin monitoring dashboard (live session status)
```

---

## 4. Key Features

### Admin Panel

| Feature | Description |
|---------|-------------|
| Round Builder | Create/edit rounds (type, duration, allowed languages, scoring) |
| Question Editor | Add C snippets (R1) or multi-language coding problems (R2) with test cases |
| Candidate Invitations | Bulk-invite via CSV email upload; per-candidate magic link access |
| Live Monitor | Real-time dashboard: session status, time remaining, violation counts |
| Submission Viewer | Code diff, stdout/stderr, Judge0 verdicts, speed metric breakdown |
| Audit Log Browser | Per-session event timeline (fullscreen exits, tab switches, pastes) |
| Results Export | Download CSV/PDF of all submissions and scores per round |

### Candidate Portal

| Feature | Description |
|---------|-------------|
| Secure Entry | Magic link or Google OAuth login; invitation-gated access |
| Round 1 | Read C code snippet → type or select predicted output; auto-graded |
| Round 2 | Write code in Monaco editor; run against visible test cases; submit |
| Speed Tracking | Keystroke, paste, idle, and WPM metrics per question (invisible to candidate) |
| Timer | Countdown per session; auto-submit on expiry |
| Fullscreen Guard | Enforced on session start; violations logged and admin-alerted |
| Tab Monitoring | `visibilitychange` events logged; configurable disqualification threshold |
| Read-only Review | After admin releases results, candidate can view their own submissions |

---

## 5. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| **Performance** | Page load (LCP) | < 2 s on 4G |
| **Performance** | Code execution round-trip (p95) | < 5 s |
| **Performance** | API response time (p99) | < 500 ms |
| **Availability** | Uptime during assessment windows | ≥ 99.5 % |
| **Security** | Transport encryption | TLS 1.3 minimum |
| **Security** | Data at rest | AES-256 (Supabase default) |
| **Security** | Code sandbox escape | Zero tolerance; `isolate` + no network in sandbox |
| **Scalability** | Concurrent candidates per round | 100 + without degradation |
| **Compliance** | PII handling | GDPR-aware; minimal retention; deletion API |
| **Accessibility** | Public-facing pages | WCAG 2.1 AA |
| **Browser Support** | Required for candidates | Chrome 110+, Firefox 115+, Edge 110+ |
| **Audit** | Log retention | 90 days hot; exportable |

---

## 6. Environment Variables

Create `.env.local` in the project root. **Never commit this file.**

```dotenv
# ── Supabase ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # safe for browser
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # server-side ONLY — never expose

# ── Judge0 Code Execution ───────────────────────────────────────────────────
JUDGE0_API_URL=https://codeassess-judge0.fly.dev
JUDGE0_API_KEY=your-judge0-auth-token         # set in Judge0's judge0.conf

# ── Application ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000      # prod: https://yourapp.vercel.app
NEXTAUTH_SECRET=replace-with-32-char-random   # used for session signing

# ── Admin Bootstrap ──────────────────────────────────────────────────────────
# Used once during first-run to claim the first admin account
ADMIN_BOOTSTRAP_TOKEN=replace-with-random-token

# ── Monitoring (optional) ────────────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=https://xxx@oXXX.ingest.sentry.io/XXX
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=codeassess
```

> **Production note:** Set all variables in the Vercel dashboard (Settings → Environment Variables). Mark `SUPABASE_SERVICE_ROLE_KEY` and `JUDGE0_API_KEY` as **Server** only.

---

## 7. Setup & Local Development

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| Docker Desktop | Latest | [docker.com](https://docker.com) |
| Supabase CLI | Latest | `npm i -g supabase` |
| Vercel CLI | Latest | `npm i -g vercel` (optional) |

### Step-by-step

```bash
# 1. Clone the repository
git clone https://github.com/your-org/codeassess.git
cd codeassess

# 2. Install Node dependencies
npm ci

# 3. Start local Supabase (PostgreSQL + Auth + Storage + Edge Functions)
supabase start
# Outputs: API URL, anon key, service role key — copy into .env.local

# 4. Apply database migrations and seed data
supabase db push              # run all migrations in /supabase/migrations/
supabase db seed              # creates initial roles and test data

# 5. Start local Judge0 (Docker Compose)
cd judge0 && docker compose up -d && cd ..
# Runs on http://localhost:2358 by default

# 6. Create and populate .env.local
cp .env.example .env.local
# Fill in values from `supabase status` output and Judge0 URL

# 7. Start the development server
npm run dev
# App: http://localhost:3000
# Supabase Studio: http://localhost:54323
```

### Local Development Commands

```bash
npm run dev              # Next.js development server (hot reload)
npm run build            # Production build (validates types + lint)
npm run start            # Serve production build locally
npm run lint             # ESLint + TypeScript type check
npm run format           # Prettier auto-format
npm run test             # Vitest unit + integration tests (watch mode)
npm run test:run         # Vitest single-pass (for CI)
npm run test:coverage    # Coverage report → ./coverage/
npm run test:e2e         # Playwright end-to-end (requires running server)
npm run test:e2e:ui      # Playwright with interactive UI debugger

# Supabase helpers
supabase migration new <name>    # scaffold new migration file
supabase db diff                 # show pending schema changes
supabase db reset                # drop + recreate local DB (dev only)
supabase functions serve         # run Edge Functions locally
supabase gen types typescript    # regenerate DB type definitions → types/supabase.ts

# Judge0 helpers
docker compose -f judge0/docker-compose.yml logs -f   # tail Judge0 logs
docker compose -f judge0/docker-compose.yml restart   # restart sandbox
```

---

## 8. Deployment

### 8.1 Supabase Cloud

```bash
# Link local project to Supabase cloud project
supabase link --project-ref <your-project-ref>

# Push all migrations to production database
supabase db push

# Deploy Edge Functions
supabase functions deploy submission-scorer
supabase functions deploy audit-event-recorder
supabase functions deploy session-timeout-enforcer

# Set secrets for Edge Functions
supabase secrets set JUDGE0_API_URL=https://...
supabase secrets set JUDGE0_API_KEY=...
```

### 8.2 Judge0 on Fly.io

```bash
cd judge0

# First deploy
flyctl launch --name codeassess-judge0 --region sin  # pick closest region
flyctl volumes create judge0_data --size 10           # persistent volume for workers

# Configure environment
flyctl secrets set JUDGE0_AUTH_TOKEN=your-token
flyctl secrets set DISABLE_NETWORK=true               # sandbox security

# Deploy
flyctl deploy

# Scale (minimum 1 machine always-on during assessment hours)
flyctl scale count 2 --region sin
```

**Judge0 `judge0.conf` key settings:**

```ini
JUDGE0_AUTH_TOKEN=your-secret-token
DISABLE_NETWORK=true          # no internet access from sandbox
CPU_TIME_LIMIT=5              # seconds
WALL_TIME_LIMIT=10            # seconds
MEMORY_LIMIT=131072           # 128 MB in KB
```

### 8.3 Next.js on Vercel

```bash
# First time
vercel --prod

# Subsequent deploys (automatic via GitHub Actions on push to main)
# Set these env vars in Vercel Dashboard:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY   (Server only)
#   JUDGE0_API_URL
#   JUDGE0_API_KEY              (Server only)
#   NEXT_PUBLIC_APP_URL
#   NEXT_PUBLIC_SENTRY_DSN
```

### 8.4 Docker Compose (All-in-One, optional)

For teams that prefer a single-machine deploy (e.g., internal tooling on a VPS):

```yaml
# docker-compose.prod.yml (overview)
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env.production
    depends_on: [judge0-server]

  judge0-server:
    image: judge0/judge0:1.13.1
    volumes: [./judge0.conf:/judge0.conf]
    ports: ["2358:2358"]
    depends_on: [judge0-db, judge0-redis]

  judge0-db:
    image: postgres:13
    environment:
      POSTGRES_DB: judge0
      POSTGRES_USER: judge0
      POSTGRES_PASSWORD: judge0secret

  judge0-redis:
    image: redis:6
```

> Note: In this mode, Supabase is still used for auth and application data (cloud or self-hosted). Only the Next.js app and Judge0 run in Docker.

---

## 9. Testing Approach

### Coverage Matrix

| Layer | Tool | What's Tested | Target Coverage |
|-------|------|---------------|----------------|
| **Unit** | Vitest | Utility functions, scoring logic, metric calculators | ≥ 80 % lines |
| **Component** | Vitest + React Testing Library | Form validation, timer, editor controls | ≥ 70 % components |
| **Integration** | Vitest + Supabase local | API routes, RLS policies, DB queries | Critical paths |
| **E2E** | Playwright | Full user journeys (admin + candidate) | All P0 flows |
| **Security** | OWASP ZAP (CI) | OWASP Top 10 scan against staging | 0 high/critical findings |

### Priority E2E Test Scenarios

```
✅ Admin creates a round, adds questions, invites candidates, publishes
✅ Candidate receives invite, logs in, and starts session
✅ Fullscreen is enforced on session start; exit triggers a violation log
✅ Candidate submits Round 1 answer; score is calculated correctly
✅ Candidate writes Python in Monaco, runs against test cases, submits
✅ Judge0 returns correct verdict; score and metrics recorded
✅ Admin views live session, sees violation count, can view submission
✅ Session timer expires; session auto-submits all open questions
✅ RLS: candidate A cannot read candidate B's submission via direct API call
✅ Admin exports round results as CSV; all rows present
```

---

## 10. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml

name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:

  # ── Quality Gate ────────────────────────────────────────────────
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run build          # also type-checks
      - run: npm run test:run
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL_TEST }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY_TEST }}
      - run: npx supabase db lint    # catches bad migrations

  # ── End-to-End Tests ────────────────────────────────────────────
  e2e:
    runs-on: ubuntu-latest
    needs: quality
    services:
      # Supabase: use supabase/setup-cli action against local instance
      # Judge0: lightweight mock server for CI (see /test/judge0-mock/)
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: supabase db push
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env: { CI: 'true' }
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  # ── Deploy (main branch only) ───────────────────────────────────
  deploy:
    runs-on: ubuntu-latest
    needs: [quality, e2e]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
      - run: supabase db push
      - run: supabase functions deploy --no-verify-jwt
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        working-directory: judge0
        env: { FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }} }
      - run: npx vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

**Branch Strategy:**

```
main          ← production; protected; requires PR + CI green + 1 review
develop       ← integration branch; CI runs on every push
feature/*     ← feature branches; PR targets develop
hotfix/*      ← directly to main via PR when critical
```

**Deployment Environments:**

| Environment | Trigger | URL |
|-------------|---------|-----|
| Preview | Every PR | `https://codeassess-<branch>.vercel.app` |
| Staging | Push to `develop` | `https://staging.codeassess.yourorg.com` |
| Production | Push to `main` | `https://codeassess.yourorg.com` |
