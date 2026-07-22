-- ════════════════════════════════════════════════════════════════
-- Assessment Platform — Migration 00004
-- Adds: MCQ support, Library portal, Draft feature
-- Run this in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ── 1. Add mcq_options and is_draft to questions ──────────────
ALTER TABLE questions ADD COLUMN IF NOT EXISTS mcq_options JSONB;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Update question_type constraint (add 'mcq') ────────────
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_type_check;
UPDATE questions SET question_type = 'output_prediction' WHERE question_type = 'coding';
ALTER TABLE questions ADD CONSTRAINT questions_question_type_check
  CHECK (question_type IN ('output_prediction', 'mcq'));

-- ── 3. Update round_type constraint (remove coding types) ─────
ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_round_type_check;
UPDATE rounds SET round_type = 'output_prediction' WHERE round_type IN ('live_coding', 'c_programming');
ALTER TABLE rounds ADD CONSTRAINT rounds_round_type_check
  CHECK (round_type IN ('output_prediction', 'mcq'));

-- ── 4. Create library_questions table ─────────────────────────
CREATE TABLE IF NOT EXISTS library_questions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  description   TEXT,
  question_type TEXT        NOT NULL DEFAULT 'output_prediction'
                            CHECK (question_type IN ('output_prediction', 'mcq')),
  points        INT         NOT NULL DEFAULT 10,
  starter_code  TEXT,
  mcq_options   JSONB,
  tags          TEXT[]      NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE library_questions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_library_type ON library_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_library_created ON library_questions(created_at DESC);
