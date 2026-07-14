import { db } from '../../lib/db.js'
import { exec, spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

function compileC(srcFile, binFile) {
  return new Promise((resolve, reject) => {
    exec(`gcc -o "${binFile}" "${srcFile}" -lm -O2 2>&1`, { timeout: 15000 }, (err, output) => {
      if (err) reject(String(output || err.message))
      else resolve()
    })
  })
}

function runBinary(binFile, input) {
  return new Promise((resolve) => {
    const start = Date.now()
    const child = spawn(binFile, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let killed = false

    const timer = setTimeout(() => {
      killed = true
      child.kill('SIGKILL')
    }, 5000)

    child.stdout.on('data', d => {
      stdout += d
      if (stdout.length > 100000) { killed = true; child.kill('SIGKILL') }
    })
    child.stderr.on('data', d => { stderr += d })
    child.stdin.write(input || '')
    child.stdin.end()

    child.on('close', () => {
      clearTimeout(timer)
      resolve({ stdout, stderr: stderr.trim(), elapsed: Date.now() - start, killed })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ stdout: '', stderr: String(err), elapsed: Date.now() - start, killed: false })
    })
  })
}

function normalizeOutput(raw) {
  return String(raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

// Check once at startup whether gcc is available on this machine
let gccAvailable = null
function checkGcc() {
  if (gccAvailable !== null) return Promise.resolve(gccAvailable)
  return new Promise(resolve => {
    exec('which gcc', (err) => {
      gccAvailable = !err
      resolve(gccAvailable)
    })
  })
}

export default async function testExecuteCRoutes(app) {
  // POST /api/test/execute-c — compile & run C code server-side
  app.post('/execute-c', async (request, reply) => {
    const { session_token, code, test_cases } = request.body

    if (!session_token || !code) {
      return reply.status(400).send({ error: 'session_token and code are required' })
    }

    // Vercel / serverless environments don't have gcc — return a clear error
    if (!(await checkGcc())) {
      return reply.status(501).send({
        error: 'C code execution requires a self-hosted server with gcc installed. It is not available in this cloud deployment.',
        results: (test_cases || []).map(tc => ({
          case_id: tc.id, passed: false, stdout: '', score: 0,
          stderr: 'C execution not supported in this environment (gcc not found).',
          status: 'Unsupported', time_ms: 0,
          is_hidden: tc.is_hidden || false, expected_output: tc.expected_output || '',
        })),
      })
    }

    // Verify active session
    const { data: session, error: sErr } = await db
      .from('candidate_sessions')
      .select('id, status')
      .eq('session_token', session_token)
      .eq('status', 'started')
      .single()

    if (sErr || !session) {
      return reply.status(403).send({ error: 'No active session' })
    }

    const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const srcFile = join(tmpdir(), `ap_${uid}.c`)
    const binFile = join(tmpdir(), `ap_${uid}`)

    try {
      await writeFile(srcFile, code, 'utf8')

      // Compile
      try {
        await compileC(srcFile, binFile)
      } catch (compileErr) {
        const errMsg = String(compileErr)
        return reply.send({
          compile_error: errMsg,
          results: (test_cases || []).map(tc => ({
            case_id: tc.id,
            passed: false,
            stdout: '',
            stderr: errMsg,
            status: 'Compilation Error',
            time_ms: 0,
            score: 0,
            is_hidden: tc.is_hidden || false,
            expected_output: tc.expected_output || '',
          })),
        })
      }

      // Run each test case
      const results = []
      for (const tc of (test_cases || [])) {
        const { stdout, stderr, elapsed, killed } = await runBinary(binFile, tc.input || '')
        const got      = normalizeOutput(stdout)
        const expected = normalizeOutput(tc.expected_output || '')
        const passed   = got === expected && !killed
        results.push({
          case_id:         tc.id,
          passed,
          stdout:          stdout.trim(),
          stderr,
          status:          killed ? 'TLE' : passed ? 'Accepted' : 'Wrong Answer',
          time_ms:         elapsed,
          score:           passed ? (tc.points || 0) : 0,
          is_hidden:       tc.is_hidden || false,
          expected_output: tc.expected_output || '',
        })
      }

      return reply.send({ results })
    } finally {
      await unlink(srcFile).catch(() => {})
      await unlink(binFile).catch(() => {})
    }
  })
}
