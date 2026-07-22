/**
 * Code execution utilities — Python 3 and C (gcc).
 * Used by execute endpoints and the answer route for coding submissions.
 */

import { exec, spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { normalizeOutput } from './scoring.js'

// ── Availability checks (cached) ─────────────────────────────────────────────

let _gccAvailable = null
let _pythonAvailable = null

export function checkGcc() {
  if (_gccAvailable !== null) return Promise.resolve(_gccAvailable)
  return new Promise(resolve => {
    exec('which gcc', err => { _gccAvailable = !err; resolve(_gccAvailable) })
  })
}

export function checkPython() {
  if (_pythonAvailable !== null) return Promise.resolve(_pythonAvailable)
  return new Promise(resolve => {
    exec('which python3', err => { _pythonAvailable = !err; resolve(_pythonAvailable) })
  })
}

// ── Low-level process runner ──────────────────────────────────────────────────

function spawnProc(cmd, args, input, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now()
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', killed = false

    const timer = setTimeout(() => { killed = true; child.kill('SIGKILL') }, timeoutMs)
    child.stdout.on('data', d => {
      stdout += d
      if (stdout.length > 100_000) { killed = true; child.kill('SIGKILL') }
    })
    child.stderr.on('data', d => { stderr += d })
    child.stdin.write(input || '')
    child.stdin.end()

    child.on('close', () => {
      clearTimeout(timer)
      resolve({ stdout, stderr: stderr.trim(), elapsed: Date.now() - start, killed })
    })
    child.on('error', err => {
      clearTimeout(timer)
      resolve({ stdout: '', stderr: String(err), elapsed: 0, killed: false })
    })
  })
}

// ── Python execution ──────────────────────────────────────────────────────────

async function runPythonAllCases(code, testCases) {
  const results = []
  for (const tc of testCases) {
    const { stdout, stderr, elapsed, killed } = await spawnProc('python3', ['-c', code], tc.input || '')
    const got      = normalizeOutput(stdout)
    const expected = normalizeOutput(tc.expected_output || '')
    const passed   = got === expected && !killed
    results.push({
      case_id:         tc.id,
      passed,
      stdout:          stdout.trimEnd(),
      stderr,
      status:          killed ? 'TLE' : passed ? 'Accepted' : 'Wrong Answer',
      time_ms:         elapsed,
      score:           passed ? (tc.points || 0) : 0,
      is_hidden:       tc.is_hidden || false,
      expected_output: tc.expected_output || '',
      timed_out:       killed,
    })
  }
  return { results }
}

// ── C execution ───────────────────────────────────────────────────────────────

async function runCAllCases(code, testCases) {
  if (!(await checkGcc())) {
    return {
      error: 'gcc not available on this server',
      results: testCases.map(tc => ({
        case_id: tc.id, passed: false, score: 0, stdout: '',
        stderr: 'C execution requires gcc which is not installed on this server.',
        status: 'Unsupported', time_ms: 0,
        is_hidden: tc.is_hidden || false, expected_output: tc.expected_output || '',
      })),
    }
  }

  const uid     = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const srcFile = join(tmpdir(), `ap_${uid}.c`)
  const binFile = join(tmpdir(), `ap_${uid}`)

  await writeFile(srcFile, code, 'utf8')

  try {
    // Compile once
    let compileError = null
    await new Promise(resolve => {
      exec(`gcc -o "${binFile}" "${srcFile}" -lm -O2 2>&1`, { timeout: 15000 }, (err, output) => {
        if (err) compileError = String(output || err.message)
        resolve()
      })
    })

    if (compileError) {
      return {
        compile_error: compileError,
        results: testCases.map(tc => ({
          case_id: tc.id, passed: false, score: 0, stdout: '',
          stderr: compileError, status: 'Compilation Error', time_ms: 0,
          is_hidden: tc.is_hidden || false, expected_output: tc.expected_output || '',
          compile_error: true,
        })),
      }
    }

    // Run each test case against compiled binary
    const results = []
    for (const tc of testCases) {
      const { stdout, stderr, elapsed, killed } = await spawnProc(binFile, [], tc.input || '')
      const got      = normalizeOutput(stdout)
      const expected = normalizeOutput(tc.expected_output || '')
      const passed   = got === expected && !killed
      results.push({
        case_id:         tc.id,
        passed,
        stdout:          stdout.trimEnd(),
        stderr,
        status:          killed ? 'TLE' : passed ? 'Accepted' : 'Wrong Answer',
        time_ms:         elapsed,
        score:           passed ? (tc.points || 0) : 0,
        is_hidden:       tc.is_hidden || false,
        expected_output: tc.expected_output || '',
        timed_out:       killed,
      })
    }
    return { results }
  } finally {
    await unlink(srcFile).catch(() => {})
    await unlink(binFile).catch(() => {})
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Execute code against test cases and return scored results.
 * @param {string} code
 * @param {'python'|'c'} language
 * @param {Array}  testCases  — rows from test_cases table
 * @returns {{ results, compile_error?, error? }}
 */
export function executeAndScore(code, language, testCases) {
  if (language === 'c') return runCAllCases(code, testCases)
  return runPythonAllCases(code, testCases)
}
