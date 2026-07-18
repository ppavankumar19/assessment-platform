-- ════════════════════════════════════════════════════════════════
-- Assessment Platform — Reset & Correct Schema
-- Run this in Supabase Dashboard → SQL Editor
-- WARNING: Drops all existing tables and recreates them.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Drop everything ──────────────────────────────────────────
DROP TABLE IF EXISTS audit_logs         CASCADE;
DROP TABLE IF EXISTS speed_metrics      CASCADE;
DROP TABLE IF EXISTS submissions        CASCADE;
DROP TABLE IF EXISTS candidate_sessions CASCADE;
DROP TABLE IF EXISTS invitations        CASCADE;
DROP TABLE IF EXISTS test_cases         CASCADE;
DROP TABLE IF EXISTS questions          CASCADE;
DROP TABLE IF EXISTS rounds             CASCADE;
DROP TABLE IF EXISTS users              CASCADE;

DROP TRIGGER  IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at();

DROP TYPE IF EXISTS user_role         CASCADE;
DROP TYPE IF EXISTS round_type        CASCADE;
DROP TYPE IF EXISTS question_type     CASCADE;
DROP TYPE IF EXISTS session_status    CASCADE;
DROP TYPE IF EXISTS submission_status CASCADE;
DROP TYPE IF EXISTS invite_status     CASCADE;
DROP TYPE IF EXISTS audit_event_type  CASCADE;

-- ── 2. Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 3. Tables ───────────────────────────────────────────────────

CREATE TABLE users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        UNIQUE NOT NULL,
  full_name   TEXT,
  role        TEXT        NOT NULL DEFAULT 'candidate' CHECK (role IN ('admin', 'candidate')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rounds (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT        NOT NULL,
  description      TEXT,
  round_type       TEXT        NOT NULL CHECK (round_type IN ('live_coding', 'output_prediction', 'c_programming', 'mcq')),
  duration_minutes INT         NOT NULL CHECK (duration_minutes > 0),
  is_published     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN     NOT NULL DEFAULT FALSE,
  cutoff_score     INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        UUID        NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  description     TEXT,
  question_type   TEXT        NOT NULL DEFAULT 'coding' CHECK (question_type IN ('coding', 'output_prediction')),
  points          INT         NOT NULL DEFAULT 100,
  starter_code    TEXT,
  expected_output TEXT,
  order_index     INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE test_cases (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID    NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  input           TEXT    NOT NULL DEFAULT '',
  expected_output TEXT    NOT NULL DEFAULT '',
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  points          INT     NOT NULL DEFAULT 0,
  order_index     INT     NOT NULL DEFAULT 0
);

CREATE TABLE candidate_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        UUID        NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id         UUID,
  session_token   TEXT        UNIQUE,
  candidate_name  TEXT,
  candidate_email TEXT,
  college_name    TEXT,
  roll_no         TEXT,
  branch          TEXT,
  status          TEXT        NOT NULL DEFAULT 'registered'
                              CHECK (status IN ('registered','started','completed','disqualified')),
  score           INT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE submissions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES candidate_sessions(id) ON DELETE CASCADE,
  question_id  UUID        NOT NULL REFERENCES questions(id),
  user_id      UUID,
  code         TEXT,
  language_id  INT,
  score        INT         NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'pending',
  is_final     BOOLEAN     NOT NULL DEFAULT FALSE,
  test_results JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE speed_metrics (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id        UUID        NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  session_id           UUID        REFERENCES candidate_sessions(id) ON DELETE CASCADE,
  question_id          UUID        REFERENCES questions(id),
  total_keystrokes     INT         NOT NULL DEFAULT 0,
  paste_count          INT         NOT NULL DEFAULT 0,
  delete_count         INT         NOT NULL DEFAULT 0,
  chars_per_minute     FLOAT,
  wpm_equivalent       FLOAT,
  time_to_first_key_ms INT,
  total_active_time_ms INT         NOT NULL DEFAULT 0,
  idle_periods         JSONB,
  keystroke_sample     JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        REFERENCES candidate_sessions(id) ON DELETE CASCADE,
  event_type TEXT        NOT NULL,
  event_data JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_rounds_published     ON rounds(is_published);
CREATE INDEX idx_questions_round      ON questions(round_id);
CREATE INDEX idx_tc_question          ON test_cases(question_id);
CREATE INDEX idx_sessions_round       ON candidate_sessions(round_id);
CREATE INDEX idx_sessions_token       ON candidate_sessions(session_token);
CREATE INDEX idx_sessions_email       ON candidate_sessions(candidate_email);
CREATE INDEX idx_submissions_session  ON submissions(session_id);
CREATE INDEX idx_submissions_question ON submissions(question_id);
CREATE INDEX idx_audit_session        ON audit_logs(session_id);

-- ── 5. RLS — enabled, backend uses service role which bypasses it ─
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds             ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;

-- ── 6. Trigger: auto-create user profile on Google/email login ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url',
    'candidate'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = COALESCE(EXCLUDED.full_name, users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 7. Migrate existing Supabase auth users into the users table ─
INSERT INTO public.users (id, email, full_name, avatar_url, role)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
  raw_user_meta_data->>'avatar_url',
  'candidate'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ── 8. Fix round_type constraint if upgrading an existing install ─
-- If you already ran an earlier version of this migration (before c_programming
-- was added), run these two statements to update the live constraint:
--
-- ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_round_type_check;
-- ALTER TABLE rounds ADD CONSTRAINT rounds_round_type_check
--   CHECK (round_type IN ('live_coding', 'output_prediction', 'c_programming', 'mcq'));

-- ── 9. Set admin account ─────────────────────────────────────────
-- Only this email gets admin access; everyone else is 'candidate'.
-- Replace the email below with the exact Google/magic-link email used to sign in.
UPDATE users SET role = 'admin' WHERE email = '029pavankumar.ponnuri@gmail.com';
