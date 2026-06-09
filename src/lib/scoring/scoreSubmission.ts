import { normalizeOutput } from './normalizeOutput';
import type { TestCase, TestCaseResult, SubmissionStatus } from '@/types/database';

interface Judge0Result {
  status: { id: number; description: string };
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null;
  memory: number | null;
}

export function mapJudge0Status(statusId: number): SubmissionStatus {
  switch (statusId) {
    case 1: case 2: return 'running';
    case 3: return 'accepted';
    case 4: return 'wrong_answer';
    case 5: return 'time_limit_exceeded';
    case 6: return 'compile_error';
    case 7: case 8: case 9: case 10: case 11: case 12: return 'runtime_error';
    case 13: return 'internal_error';
    case 14: return 'memory_limit_exceeded';
    default: return 'internal_error';
  }
}

export function evaluateTestCases(
  testCases: TestCase[],
  results: Judge0Result[]
): { totalScore: number; testResults: TestCaseResult[]; worstStatus: SubmissionStatus } {
  const testResults: TestCaseResult[] = [];
  let worstStatus: SubmissionStatus = 'accepted';

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const exec = results[i];

    if (!exec) {
      testResults.push({ case_id: tc.id, passed: false, score: 0, stdout: null, stderr: 'No execution result', time_ms: 0, memory_kb: 0, status: 'internal_error' });
      worstStatus = 'internal_error';
      continue;
    }

    const passed = exec.status.id === 3 && normalizeOutput(exec.stdout ?? '') === normalizeOutput(tc.expected_output);

    testResults.push({
      case_id: tc.id, passed, score: passed ? tc.points : 0,
      stdout: exec.stdout, stderr: exec.stderr,
      time_ms: parseFloat(exec.time ?? '0') * 1000,
      memory_kb: exec.memory ?? 0, status: exec.status.description,
    });

    if (!passed && exec.status.id !== 3) worstStatus = mapJudge0Status(exec.status.id);
    else if (!passed) worstStatus = 'wrong_answer';
  }

  const totalScore = testResults.reduce((sum, r) => sum + r.score, 0);
  return { totalScore, testResults, worstStatus };
}
