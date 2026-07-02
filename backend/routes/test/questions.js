import { db } from '../../lib/db.js'

export default async function testQuestionsRoutes(app) {
  // GET /api/test/:roundId/questions — fetch questions for an active session
  app.get('/:roundId/questions', async (request, reply) => {
    const { roundId } = request.params
    const { token, include_hidden } = request.query

    if (!token) return reply.status(400).send({ error: 'token required' })

    // Verify session is active
    const { data: session, error: sErr } = await db
      .from('candidate_sessions')
      .select('id, status, started_at, rounds(duration_minutes)')
      .eq('session_token', token)
      .eq('round_id', roundId)
      .eq('status', 'started')
      .single()

    if (sErr || !session) {
      return reply.status(403).send({ error: 'No active session found' })
    }

    // Check time not expired
    const expiresAt = new Date(
      new Date(session.started_at).getTime() +
      session.rounds.duration_minutes * 60000
    )
    if (new Date() > expiresAt) {
      return reply.status(403).send({ error: 'Session expired' })
    }

    const { data: questions, error: qErr } = await db
      .from('questions')
      .select(`
        id, title, description, question_type, points, starter_code,
        expected_output, order_index,
        test_cases(id, input, expected_output, is_hidden, points, order_index)
      `)
      .eq('round_id', roundId)
      .order('order_index', { ascending: true })

    if (qErr) return reply.status(500).send({ error: qErr.message })

    const qs = questions || []

    // Filter out hidden test cases unless explicitly requested
    const showHidden = include_hidden === 'true'
    qs.forEach(q => {
      if (!showHidden && q.test_cases) {
        q.test_cases = q.test_cases.filter(tc => !tc.is_hidden)
      }
      q.test_cases?.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    })

    return reply.send(qs)
  })
}
