import { db } from '../../lib/db.js'
import { checkPython, executeAndScore } from '../../lib/executor.js'

export default async function testExecutePyRoutes(app) {
  // POST /api/test/execute-py — run Python code against visible test cases
  app.post('/execute-py', {
    config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { session_token, code, test_cases } = request.body

    if (!session_token || !code) {
      return reply.status(400).send({ error: 'session_token and code are required' })
    }

    if (code.length > 65_536) {
      return reply.status(400).send({ error: 'Code exceeds maximum size (64 KB)' })
    }

    if (!(await checkPython())) {
      return reply.status(501).send({
        error: 'Python 3 is not available on this server.',
        results: (test_cases || []).map(tc => ({
          case_id: tc.id, passed: false, stdout: '', score: 0,
          stderr: 'python3 not found', status: 'Unsupported', time_ms: 0,
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

    const { results, error } = await executeAndScore(code, 'python', test_cases || [])
    if (error) return reply.status(503).send({ error, results: results || [] })
    return reply.send({ results })
  })
}
