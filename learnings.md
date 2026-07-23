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

---

## Production Hardening — What Was Done

### Security Headers (`@fastify/helmet`)
- Content Security Policy: allows inline scripts (vanilla JS), CDN assets (Monaco, Pyodide), Supabase connections
- `crossOriginEmbedderPolicy: false` — required for Pyodide SharedArrayBuffer

### Compression (`@fastify/compress`)
- gzip/brotli compression on all responses — reduces bandwidth significantly

### Body Limits
- Global: 128 KB (`bodyLimit: 131_072` in Fastify config)
- Per-route override: 512 KB for `/api/test/answer` (typing replay payload)

### Admin Auth Token Cache
- In-memory Map with 5-minute TTL, max 500 entries, FIFO eviction
- Eliminates 2 Supabase DB round-trips per admin API request

### Graceful Shutdown
- SIGTERM/SIGINT handlers call `app.close()` so Render can drain cleanly

### Code Execution Sandbox
- `SAFE_ENV` — no secrets leaked to subprocesses
- `ulimit -v 262144 -t 5` — 256 MB RAM, 5s CPU limit
- UUID temp files in `/tmp`, cleaned up after execution
- Wall timeout: 6s, output cap: 100 KB

### Session Race Fix
- `.eq('status', 'started')` guard on complete update prevents `completed` overwriting `disqualified`

---

## Bugs Fixed in Audit

| Bug | Root Cause | Fix |
|---|---|---|
| Python execution failed in Docker | Dockerfile only installed gcc, not python3 | Added python3 to apt-get |
| HTML entities shown raw (`&#10003;`) | Used `textContent` on HTML strings | Changed to `innerHTML` |
| Fullscreen lost on navigation | `requestFullscreen()` before `location.replace()` | Moved to gate overlay on exam page |
| Same code shown for C and Python | Shared code buffer | Per-language buffers: `ans.python`, `ans.c` |
| Playback always showed "Python 3" | Hardcoded in HTML | Dynamic badge from `language_id` |
| Playback had no data | Never captured snapshots or saved speed_metrics | Added snapshot tracking + DB save in answer.js |
| execute_c.js had no sandbox | No SAFE_ENV, no ulimit | Refactored to use executor.js |
| Auto-submit used wrong code buffer | `ans.code` instead of per-language buffer | Fixed to use `ans[lang]` |
| compile_error not shown to candidate | Not included in submit response | Added `compileError` to response |
| confirm() stacked event handlers | addEventListener without cleanup | Clone node to remove all listeners |
| `branch`/`department` not validated | Missing length checks | Added 50/100 char limits |
| Any string accepted as event_type | No whitelist | Whitelist of 8 allowed event types |
| anonKey not checked at startup | Only url+serviceKey validated | Added check + throw |
| Bearer prefix not verified in auth | `authHeader.slice(7)` without check | Added `startsWith('Bearer ')` guard |
| language field not saved for questions | Missing from INSERT/UPDATE | Added language to both |
| test_cases insert error ignored silently | No error handling | Propagate error → 400 response |
| department missing from admin session queries | Not in SELECT | Added to both admin session endpoints |

---

## Key Architecture Patterns

### Event Whitelist (Security)
Only these event types can be logged via `/api/test/session/:id/event`:
- `tab_switch`, `fullscreen_exit`, `window_blur`, `tab_close` (auto-disqualify)
- `paste`, `copy`, `right_click`, `key_shortcut` (monitoring only)

### Per-Language Editor Buffers
Coding answers stored as `{ type: 'coding', python: '...', c: '...', language: 'python' }`.
Language switch saves to previous buffer, restores from new buffer.

### Typing Replay Storage
Structure: `{ startTime, snapshots: [{t, code, trigger, pastedContent?}] }`
- Max 30 snapshots: keeps first (initial) + most recent 29
- Triggers: initial, periodic (10s), paste, run, submit
- Stored in `speed_metrics.keystroke_sample` (JSONB)
