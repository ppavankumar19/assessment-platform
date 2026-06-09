export type UserRole = 'admin' | 'candidate';
export type RoundType = 'output_prediction' | 'live_coding';
export type QuestionType = 'output_prediction' | 'coding';
export type SessionStatus = 'invited' | 'started' | 'completed' | 'timed_out' | 'disqualified';
export type SubmissionStatus = 'pending' | 'running' | 'accepted' | 'wrong_answer' | 'time_limit_exceeded' | 'memory_limit_exceeded' | 'runtime_error' | 'compile_error' | 'internal_error';
export type InviteStatus = 'pending' | 'accepted' | 'expired';
export type AuditEventType = 'session_start' | 'session_end' | 'fullscreen_exit' | 'fullscreen_enter' | 'tab_switch' | 'paste_detected' | 'copy_detected' | 'submission' | 'disqualified' | 'admin_action';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Round {
  id: string;
  title: string;
  description: string | null;
  type: RoundType;
  duration_minutes: number;
  allowed_languages: number[] | null;
  pass_score: number;
  fullscreen_violation_limit: number;
  tab_switch_limit: number;
  is_published: boolean;
  is_active: boolean;
  results_released: boolean;
  created_by: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  round_id: string;
  sequence_order: number;
  title: string;
  description: string | null;
  type: QuestionType;
  code_snippet: string | null;
  expected_output: string | null;
  starter_code: string | null;
  test_cases: TestCase[] | null;
  time_limit_s: number;
  memory_limit_mb: number;
  points: number;
  created_at: string;
}

export interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
}

export interface Invitation {
  id: string;
  round_id: string;
  email: string;
  token: string;
  status: InviteStatus;
  expires_at: string;
  created_by: string;
  created_at: string;
}

export interface CandidateSession {
  id: string;
  user_id: string;
  round_id: string;
  status: SessionStatus;
  started_at: string | null;
  completed_at: string | null;
  fullscreen_violations: number;
  tab_switch_violations: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Submission {
  id: string;
  session_id: string;
  question_id: string;
  user_id: string;
  code: string | null;
  language_id: number | null;
  predicted_out: string | null;
  judge0_token: string | null;
  status: SubmissionStatus;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  test_results: TestCaseResult[] | null;
  time_ms: number | null;
  memory_kb: number | null;
  score: number;
  is_final: boolean;
  attempt_count: number;
  submitted_at: string;
}

export interface TestCaseResult {
  case_id: string;
  passed: boolean;
  score: number;
  stdout: string | null;
  stderr: string | null;
  time_ms: number;
  memory_kb: number;
  status: string;
}

export interface SpeedMetrics {
  id: string;
  submission_id: string;
  session_id: string;
  question_id: string;
  total_keystrokes: number;
  paste_count: number;
  delete_count: number;
  time_to_first_key_ms: number | null;
  total_active_time_ms: number;
  idle_periods: IdlePeriod[] | null;
  chars_per_minute: number | null;
  wpm_equivalent: number | null;
  keystroke_sample: any | null;
  created_at: string;
}

export interface IdlePeriod {
  start_ms: number;
  end_ms: number;
}

export interface AuditLog {
  id: string;
  user_id: string;
  session_id: string | null;
  event_type: AuditEventType;
  event_data: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SpeedMetricsPayload {
  total_keystrokes: number;
  paste_count: number;
  delete_count: number;
  time_to_first_key_ms: number | null;
  total_active_time_ms: number;
  idle_periods: IdlePeriod[];
  chars_per_minute: number;
}
