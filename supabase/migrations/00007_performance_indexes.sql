-- Performance indexes for high-traffic query paths
-- Run via: Supabase Dashboard → SQL Editor

-- Submissions: most queries filter by session + is_final
CREATE INDEX IF NOT EXISTS idx_submissions_session_final
  ON submissions (session_id, is_final);

-- Candidate sessions: status filter used heavily in polling + admin views
CREATE INDEX IF NOT EXISTS idx_sessions_status
  ON candidate_sessions (status);

-- Sessions per round: admin "list sessions for round" query
CREATE INDEX IF NOT EXISTS idx_sessions_round_created
  ON candidate_sessions (round_id, created_at DESC);

-- Questions: ordered by round + index for exam rendering
CREATE INDEX IF NOT EXISTS idx_questions_round_order
  ON questions (round_id, order_index);

-- Audit logs: session-scoped event lookups (playback page)
CREATE INDEX IF NOT EXISTS idx_audit_session
  ON audit_logs (session_id);

-- Speed metrics: per-session lookup for playback
CREATE INDEX IF NOT EXISTS idx_speed_session
  ON speed_metrics (session_id);

-- Sessions: token lookup is the hottest read path (every API call)
-- This is likely already a unique index from session_token column definition,
-- but make it explicit in case it was added without one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token
  ON candidate_sessions (session_token)
  WHERE session_token IS NOT NULL;
