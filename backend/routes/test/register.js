import { db } from '../../lib/db.js'
import { v4 as uuid } from 'uuid'

export default async function testRegisterRoutes(app) {
  // POST /api/test/:roundId/register — register a candidate
  app.post('/:roundId/register', async (request, reply) => {
    const { roundId } = request.params
    const { candidate_name, candidate_email, college_name, roll_no, branch } = request.body

    if (!candidate_name || !candidate_email) {
      return reply.status(400).send({ error: 'candidate_name and candidate_email are required' })
    }

    // Verify round is published
    const { data: round, error: rErr } = await db
      .from('rounds')
      .select('id, is_published, duration_minutes')
      .eq('id', roundId)
      .single()

    if (rErr || !round || !round.is_published) {
      return reply.status(404).send({ error: 'Round not found or not published' })
    }

    // Check for existing session for this email + round
    const { data: existing } = await db
      .from('candidate_sessions')
      .select('id, session_token, status')
      .eq('round_id', roundId)
      .eq('candidate_email', candidate_email.toLowerCase())
      .single()

    if (existing) {
      return reply.send({
        session_id: existing.id,
        session_token: existing.session_token,
        round_id: roundId,
        already_registered: true,
        status: existing.status,
      })
    }

    const session_token = uuid()

    const { data: session, error } = await db
      .from('candidate_sessions')
      .insert({
        round_id: roundId,
        session_token,
        candidate_name: candidate_name.trim(),
        candidate_email: candidate_email.toLowerCase().trim(),
        college_name: college_name?.trim() || null,
        roll_no: roll_no?.trim() || null,
        branch: branch?.trim() || null,
        status: 'registered',
      })
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })

    return reply.status(201).send({
      session_id: session.id,
      session_token: session.session_token,
      round_id: roundId,
      already_registered: false,
    })
  })

  // POST /api/test/:roundId/start — start the exam session
  app.post('/:roundId/start', async (request, reply) => {
    const { roundId } = request.params
    const { session_token } = request.body

    if (!session_token) return reply.status(400).send({ error: 'session_token required' })

    const { data: session, error: sErr } = await db
      .from('candidate_sessions')
      .select('id, status, started_at, rounds(id, title, round_type, duration_minutes, is_active, is_published)')
      .eq('session_token', session_token)
      .eq('round_id', roundId)
      .single()

    if (sErr || !session) return reply.status(404).send({ error: 'Session not found' })

    const round = session.rounds

    if (!round.is_published) {
      return reply.status(403).send({ error: 'This assessment is no longer available' })
    }

    // If already started, return existing start info
    if (session.status === 'started' && session.started_at) {
      const expiresAt = new Date(
        new Date(session.started_at).getTime() + round.duration_minutes * 60000
      )
      return reply.send({
        session_id: session.id,
        session_token,
        round_id: roundId,
        round_title: round.title,
        round_type: round.round_type,
        duration_minutes: round.duration_minutes,
        expires_at: expiresAt.toISOString(),
        started_at: session.started_at,
      })
    }

    if (['completed', 'disqualified'].includes(session.status)) {
      return reply.status(403).send({ error: `Session is already ${session.status}` })
    }

    if (!round.is_active) {
      return reply.status(403).send({ error: 'This assessment is currently paused' })
    }

    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + round.duration_minutes * 60000)

    const { error: upErr } = await db
      .from('candidate_sessions')
      .update({ status: 'started', started_at: startedAt.toISOString() })
      .eq('id', session.id)

    if (upErr) return reply.status(500).send({ error: upErr.message })

    return reply.send({
      session_id: session.id,
      session_token,
      round_id: roundId,
      round_title: round.title,
      round_type: round.round_type,
      duration_minutes: round.duration_minutes,
      expires_at: expiresAt.toISOString(),
      started_at: startedAt.toISOString(),
    })
  })
}
