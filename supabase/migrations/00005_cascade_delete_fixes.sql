-- ════════════════════════════════════════════════════════════════
-- Assessment Platform — Migration 00005
-- Fix: add ON DELETE CASCADE to submissions.question_id and
--      speed_metrics.question_id so deleting a round/question
--      no longer raises a foreign key violation.
-- Run this in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ── submissions.question_id ───────────────────────────────────────────────────
ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS submissions_question_id_fkey;

ALTER TABLE submissions
  ADD CONSTRAINT submissions_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

-- ── speed_metrics.question_id ────────────────────────────────────────────────
ALTER TABLE speed_metrics
  DROP CONSTRAINT IF EXISTS speed_metrics_question_id_fkey;

ALTER TABLE speed_metrics
  ADD CONSTRAINT speed_metrics_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL;
