# Assessment Platform — Feature Tracker

## Shipped (Phase 1)

- Admin dashboard: create, edit, publish, pause, unpublish, delete rounds
- Admin: add/edit/delete questions with test cases (Python 3)
- Admin: per-question language selector with Python starter code template
- Admin: cutoff score per round, CSV export (all / finalized)
- Admin: session management — delete, disqualify candidates
- Admin: typing replay / playback page for malpractice detection
- Candidate registration with email, college, roll no, branch, department
- Exam page: Monaco editor, Python 3 execution via Pyodide (browser WebAssembly)
- Exam page: per-question submit with test-case preview modal before locking
- Exam page: submitted questions locked — cannot be revisited
- Exam page: Finish Assessment button with confirmation modal
- Security: fullscreen enforcement, tab-switch detection, auto-disqualification
- Security: copy/paste logging, right-click/F12 blocked, incognito recommended
- Security: admin audit log for publish/unpublish/pause/disqualify/delete actions
- Deployment: Docker → Render.com (backend serves frontend as static files)

---

## Shipped (Phase 2)

### MCQ Question Type

**Status:** Fully shipped.

- Round type `mcq` supported in round creation form
- Admin question editor: MCQ options (4 choices + correct answer flag, stored as JSONB)
- Exam page: radio-button selection for MCQ rounds
- Server-side scoring via `/api/test/answer` — correct option never exposed to candidate
- Score computed from `mcq_options.correct` flag without revealing which option is correct

### Output Prediction Question Type

**Status:** Fully shipped.

- Round type `output_prediction` supported
- Admin question editor: starter code + visible test cases for candidates to predict output
- Exam page: text input per visible test case (no code editor)
- Server-side scoring: normalized string match of candidate input vs `expected_output`
- Hidden test cases scored without revealing expected values

### C Language / Coding Round

**Status:** Fully shipped on Docker/Render deployment.

**What's built:**
- `POST /api/test/execute-c` — compiles and runs C code server-side via `gcc`
- `POST /api/test/execute-py` — runs Python code server-side (alternative to Pyodide)
- Compile timeout: 15 seconds; per-test-case run timeout: 5 seconds; output cap: 100 KB
- Returns per-test-case results (pass/fail, stdout, stderr, time_ms, score)
- Admin question form: C language selector and C starter code template
- Exam page: language switcher (Python 3 / C) per question
- Language auto-detected from starter code (presence of `#include`)
- Sandbox: `SAFE_ENV` (no secrets leaked), `ulimit -v 262144 -t 5` (256 MB RAM, 5s CPU)

**Deployment note:** Requires Docker environment with `gcc` and `python3` installed.
The `Dockerfile` includes both. Render.com (Docker runtime) fully supports this.

### Question Library

**Status:** Fully shipped.

- `GET/POST/PUT/DELETE /api/admin/library` — full CRUD for reusable question bank
- Library questions: title, description, type, points, starter code, MCQ options, tags
- `POST /api/admin/library/:id/import` — import library question into any round in one click
- Admin UI: `/admin/library.html` — searchable, filterable library portal

---

## Planned / Future

### Additional Languages via Judge0

Once Judge0 is integrated, the following languages can be added with minimal effort:
- C++ (gcc)
- Java
- JavaScript (Node.js)
- Go
- Rust

**To implement:**
- A `JUDGE0_API_URL` + `JUDGE0_API_KEY` env var
- A new `/api/test/execute-judge0` route
- Update exam page to call Judge0 route for additional languages

---

### Video Proctoring

**Status:** Out of scope for V1. Privacy complexity + infrastructure cost.

---

### Bulk Candidate Import via CSV

**Status:** Candidates currently self-register. CSV import is a V2 feature.

---

### Multi-Tenant / SaaS Billing

**Status:** Single-org deployment for V1. Multi-tenancy is post-GA.
