-- Migration: Candidate Registration Support
-- Adds session token auth, candidate info fields, and round cutoff score

-- 1. Add session_token for token-based auth during tests
ALTER TABLE candidate_sessions
  ADD COLUMN session_token TEXT UNIQUE;

-- 2. Add candidate info fields
ALTER TABLE candidate_sessions
  ADD COLUMN candidate_name TEXT,
  ADD COLUMN candidate_email TEXT,
  ADD COLUMN college_name TEXT,
  ADD COLUMN roll_no TEXT,
  ADD COLUMN branch TEXT;

-- 3. Make user_id nullable (public candidates may not have a Supabase auth user)
ALTER TABLE candidate_sessions
  ALTER COLUMN user_id DROP NOT NULL;

-- 4. Create index on session_token for fast lookups
CREATE INDEX idx_candidate_sessions_session_token
  ON candidate_sessions (session_token);

-- 5. Add cutoff_score to rounds
ALTER TABLE rounds
  ADD COLUMN cutoff_score INT NOT NULL DEFAULT 0;
