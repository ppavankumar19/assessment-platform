-- ════════════════════════════════════════════════════════════════
-- Assessment Platform — Migration 00006
-- Adds: coding round type, coding question type, language column
-- ════════════════════════════════════════════════════════════════

-- ── 1. Add 'coding' to round_type constraint ──────────────────
ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_round_type_check;
ALTER TABLE rounds ADD CONSTRAINT rounds_round_type_check
  CHECK (round_type IN ('output_prediction', 'mcq', 'coding'));

-- ── 2. Add 'coding' to question_type constraint ───────────────
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_question_type_check
  CHECK (question_type IN ('output_prediction', 'mcq', 'coding'));

-- ── 3. Add language column to questions ───────────────────────
--  'python' — candidates must write Python
--  'c'      — candidates must write C
--  'any'    — candidates choose their language (Python or C)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'python'
  CHECK (language IN ('python', 'c', 'any'));
