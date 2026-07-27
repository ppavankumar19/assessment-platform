# Disaster Recovery Procedures

> Covers the three most likely failure scenarios for the Assessment Platform.
> Each section includes: what went wrong, how to detect it, how to recover, and how long it should take.

---

## Scenario 1 — Database Corruption or Accidental Data Deletion

### Symptoms
- API returns 500 errors or unexpected empty results
- Admin dashboard shows zero rounds or sessions where data existed before
- Supabase logs show constraint violations or missing tables

### Detection
- `/api/health` returns `{ "db": "error" }` (health check queries `rounds` table)
- Render logs show repeated Supabase errors
- Admin reports missing data

### Recovery Steps

1. **Stop accepting writes immediately** — set `MAINTENANCE_MODE=true` in Render environment variables. This causes all API requests to return 503 without touching the database.

2. **Identify the scope** — log into [Supabase Dashboard](https://supabase.com/dashboard) → your project → Table Editor. Check which tables are affected.

3. **Restore from Supabase backup:**
   - Supabase Dashboard → Settings → Backups
   - Select the most recent backup before the incident
   - Click **Restore** (note: this restores the entire database — all tables)
   - Restoration typically takes 5–15 minutes depending on database size

4. **Verify restoration:**
   ```sql
   -- Run in Supabase SQL Editor to check counts
   SELECT 'rounds' AS tbl, COUNT(*) FROM rounds
   UNION ALL
   SELECT 'candidate_sessions', COUNT(*) FROM candidate_sessions
   UNION ALL
   SELECT 'submissions', COUNT(*) FROM submissions;
   ```

5. **Re-enable the service** — set `MAINTENANCE_MODE=false` in Render dashboard.

### Target Recovery Time
- RTO: 30 minutes (detection + Supabase restore + verification)
- RPO: Up to 24 hours (Supabase free tier: daily backups; pro tier: point-in-time)

### Prevention
- Enable Supabase Pro plan for point-in-time recovery (PITR) before large assessment events
- Never run `DELETE` or `DROP` on production tables without a prior backup confirmation
- Test restore procedure on a dev Supabase project at least once per quarter

---

## Scenario 2 — Environment Variables Lost or Corrupted

### Symptoms
- All API requests fail with 500 or "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required" error
- Server fails to start after a Render redeploy
- Render deploy logs show: `Error: SUPABASE_ANON_KEY is required`

### Detection
- Render dashboard → your service → "Logs" tab shows startup error
- `/api/health` times out or returns 502 (server never started)

### Recovery Steps

1. **Locate your Supabase credentials:**
   - Log into [Supabase Dashboard](https://supabase.com/dashboard) → your project
   - Settings → API
   - Copy: **Project URL**, **anon/public key**, **service_role key**

2. **Re-enter credentials in Render:**
   - [Render Dashboard](https://render.com) → your service → Environment
   - Set/confirm the following:
     | Key | Where to get it |
     |-----|----------------|
     | `SUPABASE_URL` | Supabase → Settings → API → Project URL |
     | `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
     | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
     | `FRONTEND_URL` | Your Render service URL (e.g. `https://assessment-platform.onrender.com`) |

3. **Trigger a redeploy** — Render → your service → Manual Deploy → "Deploy latest commit"

4. **Verify:** Hit `/api/health` — should return `{ "status": "ok", "db": "ok" }`

### Target Recovery Time
- RTO: 10 minutes (find creds + update Render + wait for deploy)

### Prevention
- Store all environment variable values securely in a password manager (1Password, Bitwarden) shared with at least one other team member
- Keep a `backend/.env.example` up to date with all required variable names (already done — never put real values there)
- Ensure at least two people have access to both Render and Supabase dashboards

---

## Scenario 3 — Service Outage / Bad Deployment

### Symptoms
- Render service shows "Deploy Failed" or "Service Unavailable"
- All requests return 502 or 503
- A recent code push broke the server

### Detection
- Render dashboard → service status shows "Failed" or red indicator
- Render logs show crash on startup: unhandled exception, import error, port binding failure

### Recovery Steps

**Option A — Rollback to last working deployment (fastest):**

1. Render Dashboard → your service → Deploys tab
2. Find the last successful deploy (green checkmark)
3. Click the three-dot menu → **Rollback to this deploy**
4. Wait ~2 minutes for the container to restart

**Option B — Fix and redeploy:**

1. Identify the error in Render logs
2. Fix locally:
   ```bash
   cd /home/pavankumar19/assessment-platform/backend
   npm run dev   # verify the fix locally
   ```
3. Commit and push:
   ```bash
   git add -p
   git commit -m "fix: <description of fix>"
   git push origin main
   ```
4. Render auto-deploys on push to `main` (if connected via GitHub)

**Option C — Manual Docker build verification:**
```bash
# Build the Docker image locally to catch build-time errors before pushing
docker build -t assessment-platform-test .
docker run --env-file backend/.env -p 4000:4000 assessment-platform-test
# Test: curl http://localhost:4000/api/health
```

### Target Recovery Time
- Rollback (Option A): 5 minutes
- Fix + redeploy (Option B): 15–30 minutes

### Prevention
- Never force-push to `main`
- Test Docker build locally before pushing large dependency or Dockerfile changes
- Keep `MAINTENANCE_MODE=true` as a fast kill-switch for in-progress incidents
- Monitor the `/api/health` endpoint with an uptime service (UptimeRobot free tier points at `https://your-app.onrender.com/api/health`)

---

## Quick Reference: Key Credentials and Access

| Resource | URL | Who has access |
|----------|-----|---------------|
| Render dashboard | https://render.com | At least 2 team members |
| Supabase dashboard | https://supabase.com/dashboard | At least 2 team members |
| GitHub repo | (your repo URL) | At least 2 team members |
| Domain registrar | (if applicable) | At least 2 team members |

> **Rule:** No single person should be the only one with access to any of the above.
> Before any assessment event, verify that a second person can independently log in and perform each recovery step.
