import { db } from '../../lib/db.js'

export default async function testSessionRoutes(app) {
  // GET /api/test/session/:sessionId/status — poll for disqualification
  app.get('/:sessionId/status', async (request, reply) => {
    const { sessionId } = request.params
    const { token } = request.query

    if (!token) return reply.status(400).send({ error: 'token required' })

    const { data, error } = await db
      .from('candidate_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .eq('session_token', token)
      .single()

    if (error || !data) return reply.status(404).send({ error: 'Session not found' })
    return reply.send({ status: data.status })
  })

  // POST /api/test/session/:sessionId/complete — mark session as completed
  app.post('/:sessionId/complete', async (request, reply) => {
    const { sessionId } = request.params
    const { session_token } = request.body

    if (!session_token) return reply.status(400).send({ error: 'session_token required' })

    // Verify token matches session
    const { data: session, error: sErr } = await db
      .from('candidate_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .eq('session_token', session_token)
      .single()

    if (sErr || !session) return reply.status(404).send({ error: 'Session not found' })
    if (session.status === 'disqualified') return reply.send({ status: 'disqualified' })

    // Compute final score from all final submissions
    const { data: submissions } = await db
      .from('submissions')
      .select('score')
      .eq('session_id', sessionId)
      .eq('is_final', true)

    const totalScore = submissions?.reduce((sum, s) => sum + (s.score || 0), 0) || 0

    const { data, error } = await db
      .from('candidate_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        score: totalScore,
      })
      .eq('id', sessionId)
      .eq('status', 'started') // guard: don't overwrite disqualified status set by admin
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    return reply.send({ status: 'completed', score: totalScore })
  })

  // POST /api/test/session/:sessionId/event — log a security/audit event
  const ALLOWED_EVENTS = new Set([
    'tab_switch', 'fullscreen_exit', 'window_blur', 'tab_close',
    'paste', 'copy', 'right_click', 'key_shortcut',
  ])

  app.post('/:sessionId/event', async (request, reply) => {
    const { sessionId } = request.params
    const { session_token, event_type, event_data } = request.body

    if (!session_token || !event_type) {
      return reply.status(400).send({ error: 'session_token and event_type are required' })
    }
    if (!ALLOWED_EVENTS.has(event_type)) {
      return reply.status(400).send({ error: 'Invalid event_type' })
    }
    const rawEventData = JSON.stringify(event_data || {})
    if (rawEventData.length > 1024) {
      return reply.status(400).send({ error: 'event_data too large' })
    }

    // Verify session
    const { data: session } = await db
      .from('candidate_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('session_token', session_token)
      .single()

    if (!session) return reply.status(404).send({ error: 'Session not found' })

    await db.from('audit_logs').insert({
      session_id: sessionId,
      event_type,
      event_data: event_data || {},
    })

    // Auto-disqualify on severe events
    const AUTO_DQ = ['tab_switch', 'fullscreen_exit', 'window_blur', 'tab_close']
    if (AUTO_DQ.includes(event_type)) {
      await db
        .from('candidate_sessions')
        .update({ status: 'disqualified' })
        .eq('id', sessionId)
        .eq('status', 'started')
    }

    return reply.send({ logged: true })
  })
}
