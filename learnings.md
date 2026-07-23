# Project Learnings — Assessment Platform

## What is the flow of the project and tech stack?

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js 22 + Fastify 4 (ES modules) |
| **Frontend** | Vanilla HTML + CSS + JavaScript (no framework, no build step) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase OAuth (Google) + Magic Link |
| **Code Execution** | Python 3 (server-side) + GCC/C (server-side), sandboxed |
| **Code Editor** | Monaco Editor (VS Code's editor, via CDN) |
| **Deployment** | Docker → Render (backend serves frontend as static files) |
| **Security** | @fastify/helmet, @fastify/rate-limit, @fastify/compress, ulimit sandbox |

---

## Architecture

```
Browser
  └── /admin/*        → Admin UI (HTML/JS)
  └── /test/*         → Candidate UI (HTML/JS)
        │
        ↓ HTTP (same origin)
Fastify Server (Node.js)
  └── /api/admin/*    → Requires Supabase Bearer token + role='admin'
  └── /api/test/*     → Public, session_token based
  └── /               → Serves frontend static files
        │
        ↓
Supabase PostgreSQL
```

---

## Two Separate User Flows

---

### Flow 1 — Admin

```
1. /login.html
   → Google OAuth or Magic Link via Supabase
   → Gets access token, stored in localStorage

2. /admin/ (Dashboard)
   → View all rounds with candidate counts
   → Create round (MCQ / Output Prediction / Coding / C Programming)
   → Set duration, cutoff score

3. /admin/round.html?id=...
   → Add questions (MCQ options, test cases, starter code)
   → Publish round → candidates can see it
   → Pause round → stops new sessions
   → Export CSV (all results or finalized/cutoff only)

4. /admin/round.html → Sessions tab
   → View all candidates: name, email, college, branch, department, score
   → Delete session or Disqualify candidate (real-time via DB update)

5. /admin/playback.html?session=...
   → Replay a candidate's coding session snapshot by snapshot
   → See typing speed, paste count, keystroke count
   → Disqualify from here after reviewing evidence
```

---

### Flow 2 — Candidate

```
1. /test/ (Landing)
   → Shows all published rounds
   → Click a round to begin

2. /test/entry.html?round=...
   → Read rules (fullscreen required, no tab switching, etc.)
   → Confirm incognito mode (toggle)
   → Fill registration form:
     Name, Email, College, Roll No, Branch (dropdown), Department (dropdown)
   → Click "Enter Exam →" → navigates to exam

3. /test/exam.html?round=...
   → Fullscreen gate appears first — must click to enter fullscreen
   → Timer starts immediately (countdown from round duration)
   → Questions loaded based on round type:

   ┌─────────────────────────────────────────────┐
   │  MCQ Round                                  │
   │  Left: Question description                 │
   │  Right: A/B/C/D options → Submit Answer     │
   └─────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────┐
   │  Output Prediction Round                    │
   │  Left: Code snippet (read-only Monaco)      │
   │        + visible test inputs                │
   │  Right: Text areas → type predicted output  │
   │         → Submit Predictions                │
   └─────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────┐
   │  Coding / C Programming Round               │
   │  Left: Problem statement + sample I/O       │
   │  Right: Language select (Python/C)          │
   │         Monaco editor (writable, dark)      │
   │         ▶ Run → tests visible cases only    │
   │         ✓ Submit Code → tests ALL cases     │
   └─────────────────────────────────────────────┘

   Anti-cheat monitoring (throughout):
   - Tab switch → auto-disqualify
   - Fullscreen exit → auto-disqualify
   - Copy/paste detected + logged
   - Typing snapshots every 10s (coding only)
   - Admin polling every 10s (checks if admin DQ'd them)

4. Finish Assessment (or timer expires)
   → Unsubmitted answers auto-submitted
   → completeSession() API called
   → Fullscreen exits
   → /test/complete.html
   → "Exam is Finished! You may close this tab."
```

---

## Database Key Tables

```
rounds              — title, type, duration, cutoff, published/active
questions           — belongs to round, type (MCQ/OP/coding), points
test_cases          — belongs to question, input/expected_output, hidden flag
candidate_sessions  — one per candidate+round, stores token, status, score
                      fields: name, email, college, roll_no, branch, department
submissions         — one per question per session, stores code/answer + score
speed_metrics       — one per coding submission, keystrokes/paste/CPM + replay
audit_logs          — security events (tab_switch, fullscreen_exit, paste, etc.)
users               — admin users with role='admin'
```

---

## Code Execution Pipeline (Coding Round)

```
Candidate writes code in Monaco editor
        │
        ▼
Click ▶ Run (visible test cases only)
   POST /api/test/execute-py  or  /api/test/execute-c
        │
        ▼
Server: executor.js
   ├── Write code to UUID temp file in /tmp
   ├── For C: compile with gcc, then run binary
   ├── For Python: run python3 with file
   ├── SAFE_ENV (no secrets leaked to subprocess)
   ├── ulimit: 5s CPU, 256 MB RAM
   ├── Wall timeout: 6s
   └── Output cap: 100 KB
        │
        ▼
Results returned → show pass/fail per visible case
        │
        ▼
Click ✓ Submit Code (all test cases including hidden)
   POST /api/test/answer
        │
        ▼
Server scores all test cases, saves submission + speed_metrics
Returns result (hidden test cases have expected_output stripped)
```

---

## Round Types

| Type | What candidate does | Scoring |
|---|---|---|
| **MCQ** | Pick A/B/C/D | Server checks correct option |
| **Output Prediction** | Type expected output for code snippets | Server string-matches |
| **Coding** | Write Python or C code | Server executes vs all test cases |
| **C Programming** | Write C code only | Same as Coding, C only |

---

## Key Concepts Learned

### ES Modules vs CommonJS
ES stands for **ECMAScript** (the JavaScript language standard) — NOT Express.js.
It refers to the modern import/export syntax in JavaScript.

```js
// ES Modules (this project)
import Fastify from 'fastify'
export function myFunction() { ... }

// Old CommonJS style
const Fastify = require('fastify')
module.exports = { myFunction }
```

`"type": "module"` in `package.json` enables ES module syntax in Node.js.

---

### Fastify vs Express

Both are Node.js web frameworks that handle HTTP routes, but Fastify is better for production:

| | Express.js | Fastify |
|---|---|---|
| Speed | Baseline | ~2–3× faster |
| Age | 2010, older API | 2016, modern design |
| Async errors | Manual try/catch | Native async support |
| Plugins | Order-sensitive middleware | Encapsulated plugin system |
| Logger | None built-in | Pino (structured JSON, fast) |

```js
// Express
app.get('/hello', (req, res) => { res.json({ message: 'hello' }) })

// Fastify — just return, no res.json() needed
app.get('/hello', async (request, reply) => { return { message: 'hello' } })
```

---

### Node.js is a JavaScript Runtime

JavaScript originally only ran inside browsers. Node.js took Chrome's V8 engine and made JS run outside the browser — on servers, terminals, anywhere.

| Feature | Browser JS | Node.js |
|---|---|---|
| Read/write files | No | Yes (`fs` module) |
| Spawn processes | No | Yes (`child_process`) |
| Environment variables | No | Yes (`process.env`) |
| Package manager (npm) | No | Yes |

**The Full Stack in One Line:**
```
Browser (Vanilla JS)  →  Node.js + Fastify (API Server)  →  Supabase (PostgreSQL)
```
