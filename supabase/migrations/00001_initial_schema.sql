-- CodeAssess Initial Schema
-- ─── Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ─────────────────────────────────────────────────────────────────
CREATE TYPE user_role         AS ENUM ('admin', 'candidate');
CREATE TYPE round_type        AS ENUM ('output_prediction', 'live_coding');
CREATE TYPE question_type     AS ENUM ('output_prediction', 'coding');
CREATE TYPE session_status    AS ENUM ('invited', 'started', 'completed', 'timed_out', 'disqualified');
CREATE TYPE submission_status AS ENUM ('pending', 'running', 'accepted', 'wrong_answer', 'time_limit_exceeded', 'memory_limit_exceeded', 'runtime_error', 'compile_error', 'internal_error');
CREATE TYPE invite_status     AS ENUM ('pending', 'accepted', 'expired');
CREATE TYPE audit_event_type  AS ENUM ('session_start', 'session_end', 'fullscreen_exit', 'fullscreen_enter', 'tab_switch', 'paste_detected', 'copy_detected', 'submission', 'disqualified', 'admin_action');

-- ─── users ─────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT,
  role        user_role NOT NULL DEFAULT 'candidate',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── rounds ────────────────────────────────────────────────────────────────
CREATE TABLE rounds (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                        TEXT NOT NULL,
  description                  TEXT,
  type                         round_type NOT NULL,
  duration_minutes             INT NOT NULL CHECK (duration_minutes > 0),
  allowed_languages            INT[],
  pass_score                   INT NOT NULL DEFAULT 0,
  fullscreen_violation_limit   INT NOT NULL DEFAULT 3,
  tab_switch_limit             INT NOT NULL DEFAULT 5,
  is_published                 BOOLEAN NOT NULL DEFAULT FALSE,
  is_active                    BOOLEAN NOT NULL DEFAULT FALSE,
  results_released             BOOLEAN NOT NULL DEFAULT FALSE,
  created_by                   UUID NOT NULL REFERENCES users(id),
  starts_at                    TIMESTAMPTZ,
  ends_at                      TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── questions ─────────────────────────────────────────────────────────────
CREATE TABLE questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id         UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  sequence_order   INT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  type             question_type NOT NULL,
  code_snippet     TEXT,
  expected_output  TEXT,
  starter_code     TEXT,
  test_cases       JSONB,
  time_limit_s     INT NOT NULL DEFAULT 5,
  memory_limit_mb  INT NOT NULL DEFAULT 128,
  points           INT NOT NULL DEFAULT 10,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, sequence_order)
);

-- ─── invitations ───────────────────────────────────────────────────────────
CREATE TABLE invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token       TEXT UNIQUE NOT NULL,
  status      invite_status NOT NULL DEFAULT 'pending',
  expires_at  TIMESTAMPTZ NOT NULL,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, email)
);

-- ─── candidate_sessions ────────────────────────────────────────────────────
CREATE TABLE candidate_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  round_id                UUID NOT NULL REFERENCES rounds(id),
  status                  session_status NOT NULL DEFAULT 'invited',
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  fullscreen_violations   INT NOT NULL DEFAULT 0,
  tab_switch_violations   INT NOT NULL DEFAULT 0,
  ip_address              TEXT,
  user_agent              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, round_id)
);

-- ─── submissions ───────────────────────────────────────────────────────────
CREATE TABLE submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES candidate_sessions(id),
  question_id     UUID NOT NULL REFERENCES questions(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  code            TEXT,
  language_id     INT,
  predicted_out   TEXT,
  judge0_token    TEXT,
  status          submission_status NOT NULL DEFAULT 'pending',
  stdout          TEXT,
  stderr          TEXT,
  compile_output  TEXT,
  test_results    JSONB,
  time_ms         FLOAT,
  memory_kb       INT,
  score           INT NOT NULL DEFAULT 0,
  is_final        BOOLEAN NOT NULL DEFAULT FALSE,
  attempt_count   INT NOT NULL DEFAULT 1,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── speed_metrics ─────────────────────────────────────────────────────────
CREATE TABLE speed_metrics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id         UUID NOT NULL REFERENCES submissions(id) UNIQUE,
  session_id            UUID NOT NULL REFERENCES candidate_sessions(id),
  question_id           UUID NOT NULL REFERENCES questions(id),
  total_keystrokes      INT NOT NULL DEFAULT 0,
  paste_count           INT NOT NULL DEFAULT 0,
  delete_count          INT NOT NULL DEFAULT 0,
  time_to_first_key_ms  INT,
  total_active_time_ms  INT NOT NULL DEFAULT 0,
  idle_periods          JSONB,
  chars_per_minute      FLOAT,
  wpm_equivalent        FLOAT,
  keystroke_sample      JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── audit_logs ────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  session_id   UUID REFERENCES candidate_sessions(id),
  event_type   audit_event_type NOT NULL,
  event_data   JSONB NOT NULL DEFAULT '{}',
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX idx_candidate_sessions_user    ON candidate_sessions(user_id);
CREATE INDEX idx_candidate_sessions_round   ON candidate_sessions(round_id);
CREATE INDEX idx_candidate_sessions_status  ON candidate_sessions(status);
CREATE INDEX idx_submissions_session        ON submissions(session_id);
CREATE INDEX idx_submissions_question       ON submissions(question_id);
CREATE INDEX idx_submissions_user           ON submissions(user_id);
CREATE INDEX idx_audit_logs_session         ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_user            ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at      ON audit_logs(created_at DESC);
CREATE INDEX idx_invitations_email          ON invitations(email);
CREATE INDEX idx_invitations_round          ON invitations(round_id);

-- ─── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds               ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_metrics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ─────────────────────────────────────────────────────────
-- Users
CREATE POLICY "users_read_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_admin_read" ON users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);

-- Rounds
CREATE POLICY "rounds_admin_all" ON rounds FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "rounds_candidate_read" ON rounds FOR SELECT USING (
  is_published = true AND EXISTS (
    SELECT 1 FROM invitations WHERE round_id = rounds.id AND email = (
      SELECT email FROM users WHERE id = auth.uid()
    ) AND status IN ('pending', 'accepted')
  )
);

-- Questions
CREATE POLICY "questions_admin_all" ON questions FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "questions_candidate_read" ON questions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM candidate_sessions cs
    WHERE cs.round_id = questions.round_id
      AND cs.user_id = auth.uid()
      AND cs.status = 'started'
  )
);

-- Invitations
CREATE POLICY "invitations_admin_all" ON invitations FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "invitations_candidate_read" ON invitations FOR SELECT USING (
  email = (SELECT email FROM users WHERE id = auth.uid())
);

-- Candidate Sessions
CREATE POLICY "sessions_admin_read" ON candidate_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "sessions_candidate_own" ON candidate_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sessions_candidate_update" ON candidate_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Submissions
CREATE POLICY "submissions_admin_read" ON submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "submissions_candidate_own_read" ON submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "submissions_candidate_insert" ON submissions FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM candidate_sessions cs
    WHERE cs.id = session_id AND cs.user_id = auth.uid() AND cs.status = 'started'
  )
);

-- Speed Metrics
CREATE POLICY "speed_metrics_admin_read" ON speed_metrics FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "speed_metrics_candidate_insert" ON speed_metrics FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM submissions s WHERE s.id = submission_id AND s.user_id = auth.uid()
  )
);

-- Audit Logs
CREATE POLICY "audit_admin_read" ON audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "audit_insert_own" ON audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── Function: handle new user from auth ────────────────────────────────────
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
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auto-create user profile on auth signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Function: update timestamp ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_rounds_updated_at BEFORE UPDATE ON rounds FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Enable Realtime ───────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE candidate_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
