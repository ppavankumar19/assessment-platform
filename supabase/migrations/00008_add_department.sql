-- Add department column to candidate_sessions
-- Separates "Branch" (discipline code) from "Department" (full department name)
ALTER TABLE candidate_sessions ADD COLUMN IF NOT EXISTS department TEXT;
