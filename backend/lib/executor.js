/**
 * Code execution engine — Python 3 and C (gcc).
 *
 * Security measures:
 *  - Code written to temp file (not passed as shell arg)
 *  - Subprocess runs with a sanitised minimal environment
 *    (no SUPABASE_* keys, no API tokens accessible to user code)
 *  - Resource limits applied via ulimit: CPU time + virtual memory
 *  - 5-second wall-clock timeout (separate from CPU limit)
 *  - Output capped at 100 KB to prevent memory exhaustion
 *  - /tmp working directory (no access to project files)
 *  - Temp files cleaned up in finally blocks
 *
 * NOTE: For a fully hardened production environment, consider wrapping
 * execution in nsjail or bubblewrap for proper filesystem/network isolation.
 */

import { exec, spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { normalizeOutput } from './scoring.js'

// ── Sanitised environment for subprocesses ───────────────────────────────────
// Explicitly allowlisted vars only — prevents user code from reading
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or any other server secret.
const SAFE_ENV = Object.freeze({
  PATH:    '/usr/local/bin:/usr/bin:/bin',
  HOME:    '/tmp',
  TMPDIR:  '/tmp',
  LANG:    'en_US.UTF-8',
  TERM:    'dumb',
})

const MAX_OUTPUT_BYTES = 100_000   // 100 KB
const WALL_TIMEOUT_MS  = 6_000    // 6 s wall clock (slightly longer than CPU limit)
const CPU_LIMIT_S      = 5        // ulimit -t: CPU seconds
const MEM_LIMIT_KB     = 262_144  // ulimit -v: 256 MB virtual memory

// ── Availability checks (cached after first call) ────────────────────────────

let _gccAvailable    = null
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

// ── Low-level sandboxed process runner ───────────────────────────────────────
// Always spawns via `sh -c 'ulimit ...; exec <cmd>'` to enforce resource limits.
// Args must not contain shell-special chars — caller is responsible for safe paths.

function spawnSandboxed(cmd, args, input, timeoutMs = WALL_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const start = Date.now()

    // Build ulimit prefix; suppress errors if ulimit flags aren't supported
    const limits  = `ulimit -v ${MEM_LIMIT_KB} -t ${CPU_LIMIT_S} 2>/dev/null`
    const execStr = [cmd, ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')
    const shellCmd = `${limits}; exec ${execStr}`

    const child = spawn('/bin/sh', ['-c', shellCmd], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env:   SAFE_ENV,
      cwd:   '/tmp',
    })

    let stdout = '', stderr = '', killed = false

    const timer = setTimeout(() => {
      killed = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout.on('data', d => {
      stdout += d
      if (stdout.length > MAX_OUTPUT_BYTES) { killed = true; child.kill('SIGKILL') }
    })
    child.stderr.on('data', d => { stderr += d.toString().slice(0, 4_000) })

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
  if (code.length > 65_536) {
    return { error: 'Code exceeds maximum size (64 KB)' }
  }

  // Write to temp file — avoids argument-length limits and is easier to sandbox
  const srcFile = join(tmpdir(), `ap_${randomUUID()}.py`)
  await writeFile(srcFile, code, 'utf8')

  try {
    const results = []
    for (const tc of testCases) {
      const { stdout, stderr, elapsed, killed } = await spawnSandboxed(
        'python3', [srcFile], tc.input || ''
      )
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
  }
}

// ── C execution ───────────────────────────────────────────────────────────────

async function runCAllCases(code, testCases) {
  if (!(await checkGcc())) {
    return {
      error: 'C execution requires gcc which is not installed on this server.',
      results: testCases.map(tc => ({
        case_id: tc.id, passed: false, score: 0, stdout: '',
        stderr:  'gcc not available', status: 'Unsupported', time_ms: 0,
        is_hidden: tc.is_hidden || false, expected_output: tc.expected_output || '',
      })),
    }
  }

  if (code.length > 65_536) {
    return { error: 'Code exceeds maximum size (64 KB)' }
  }

  const id      = randomUUID()
  const srcFile = join(tmpdir(), `ap_${id}.c`)
  const binFile = join(tmpdir(), `ap_${id}`)

  await writeFile(srcFile, code, 'utf8')

  try {
    // Compile once with minimal env
    let compileError = null
    await new Promise(resolve => {
      exec(
        `gcc -o "${binFile}" "${srcFile}" -lm -O2 2>&1`,
        { timeout: 15_000, env: SAFE_ENV },
        (err, output) => {
          if (err) compileError = String(output || err.message)
          resolve()
        }
      )
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

    // Run each test case against the compiled binary
    const results = []
    for (const tc of testCases) {
      const { stdout, stderr, elapsed, killed } = await spawnSandboxed(
        binFile, [], tc.input || ''
      )
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
 * @param {string}         code
 * @param {'python'|'c'}   language
 * @param {Array}          testCases  — rows from test_cases table
 * @returns {{ results, compile_error?, error? }}
 */
export function executeAndScore(code, language, testCases) {
  if (language === 'c') return runCAllCases(code, testCases)
  return runPythonAllCases(code, testCases)
}
