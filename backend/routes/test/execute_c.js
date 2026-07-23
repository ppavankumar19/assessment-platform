import { db } from '../../lib/db.js'
import { checkGcc, executeAndScore } from '../../lib/executor.js'

export default async function testExecuteCRoutes(app) {
  // POST /api/test/execute-c — compile & run C code server-side (sandboxed)
  // Tighter rate limit: C compilation is CPU-intensive
  app.post('/execute-c', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { session_token, code, test_cases } = request.body

    if (!session_token || !code) {
      return reply.status(400).send({ error: 'session_token and code are required' })
    }

    if (code.length > 65_536) {
      return reply.status(400).send({ error: 'Code exceeds maximum size (64 KB)' })
    }

    if (!(await checkGcc())) {
      return reply.status(501).send({
        error: 'C execution requires gcc which is not installed on this server.',
        results: (test_cases || []).map(tc => ({
          case_id: tc.id, passed: false, score: 0, stdout: '',
          stderr: 'gcc not available', status: 'Unsupported', time_ms: 0,
          is_hidden: tc.is_hidden || false, expected_output: tc.expected_output || '',
        })),
      })
    }

    const { data: session, error: sErr } = await db
      .from('candidate_sessions')
      .select('id, status')
      .eq('session_token', session_token)
      .eq('status', 'started')
      .single()

    if (sErr || !session) {
      return reply.status(403).send({ error: 'No active session' })
    }

    const { results, compile_error, error } = await executeAndScore(code, 'c', test_cases || [])
    if (error) return reply.status(503).send({ error, results: results || [] })
    return reply.send({ results, compile_error })
  })
}
