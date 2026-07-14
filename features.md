# Assessment Platform — Feature Tracker

## Shipped (Phase 1)

- Admin dashboard: create, edit, publish, pause, unpublish, delete rounds
- Admin: add/edit/delete questions with test cases (Python 3)
- Admin: per-question language selector with Python starter code template
- Admin: cutoff score per round, CSV export (all / finalized)
- Admin: session management — delete, disqualify candidates
- Admin: typing replay / playback page for malpractice detection
- Candidate registration with email, college, roll no, branch
- Exam page: Monaco editor, Python 3 execution via Pyodide (browser WebAssembly)
- Exam page: per-question submit with test-case preview modal before locking
- Exam page: submitted questions locked — cannot be revisited
- Exam page: Finish Assessment button with confirmation modal
- Security: fullscreen enforcement, tab-switch detection, auto-disqualification
- Security: copy/paste logging, right-click/F12 blocked, incognito recommended
- Security: admin audit log for publish/unpublish/pause/disqualify/delete actions
- Deployment: Vercel (frontend + serverless API), Supabase PostgreSQL

---

## Planned / Future

### C Language Support (Self-Hosted Only)

**Status:** Backend implemented, blocked on deployment environment.

**What's built:**
- `POST /api/test/execute-c` endpoint compiles and runs C code server-side using `gcc`
- Compile timeout: 15 seconds; per-test-case run timeout: 5 seconds; output cap: 100 KB
- Returns per-test-case results (pass/fail, stdout, stderr, time_ms, score)
- Admin question form already has C language selector and C starter code template
- Exam page already has language switcher (Python 3 / C) per question
- Language auto-detected from starter code (presence of `#include`)

**Why it's disabled on Vercel:**
Vercel serverless functions do not have `gcc` installed. The endpoint returns HTTP 501
with a clear error. The exam page shows an inline warning instead of a crash.

**To enable C support:**
1. Deploy the backend (`backend/`) on a self-hosted server or VPS (DigitalOcean, Railway, Render, etc.) that has `gcc` installed
2. Set `FRONTEND_URL` to the Vercel frontend URL in the backend env
3. Update the Vercel `BACKEND_URL` rewrite (or proxy) to point to the self-hosted backend
4. C code will then compile and execute automatically — no code changes needed

**Alternative (cloud C execution):**
Integrate [Judge0](https://judge0.com) (supports 60+ languages including C, C++, Java) via their public API or self-hosted instance. Would require:
- A `JUDGE0_API_URL` + `JUDGE0_API_KEY` env var
- A new `/api/test/execute-judge0` route that submits code and polls for results
- Updating the exam page to call the Judge0 route for non-Python languages

---

### Additional Languages via Judge0

Once Judge0 is integrated, the following languages can be added with minimal effort:
- C++ (gcc)
- Java
- JavaScript (Node.js)
- Go
- Rust

---

### MCQ Question Type

**Status:** Round type `mcq` exists in schema and round creation form, but no MCQ question editor or exam UI is built yet.

**To implement:**
- Add MCQ option to question form (question text + 4 options + correct answer)
- Exam page MCQ view: radio buttons instead of code editor
- Auto-score on submission (no code execution needed)

---

### Output Prediction Question Type

**Status:** `output_prediction` round type and question type exist. Partial exam UI may exist.

**To implement / verify:**
- Ensure exam page shows a text input instead of editor for output prediction questions
- Score based on exact string match of candidate's predicted output vs expected output
