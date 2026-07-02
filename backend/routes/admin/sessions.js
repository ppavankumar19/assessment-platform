import { db } from '../../lib/db.js'
import { requireAdmin } from '../../middleware/auth.js'

export default async function adminSessionRoutes(app) {
  // GET /api/admin/sessions/:id — session detail (for playback)
  app.get('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { data, error } = await db
      .from('candidate_sessions')
      .select(`
        id, candidate_name, candidate_email, college_name, roll_no, branch,
        status, score, created_at, started_at, completed_at, round_id,
        rounds(title, round_type, duration_minutes),
        submissions(
          id, question_id, code, score, status, is_final, test_results, created_at,
          speed_metrics(
            total_keystrokes, paste_count, delete_count, chars_per_minute,
            wpm_equivalent, time_to_first_key_ms, total_active_time_ms,
            idle_periods, keystroke_sample
          )
        )
      `)
      .eq('id', request.params.id)
      .single()

    if (error || !data) return reply.status(404).send({ error: 'Session not found' })
    return reply.send(data)
  })

  // DELETE /api/admin/sessions/:id — delete session
  app.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params
    // Cascade manually (speed_metrics → submissions → audit_logs → session)
    const { data: subs } = await db.from('submissions').select('id').eq('session_id', id)
    if (subs?.length) {
      const subIds = subs.map(s => s.id)
      await db.from('speed_metrics').delete().in('submission_id', subIds)
      await db.from('submissions').delete().eq('session_id', id)
    }
    await db.from('audit_logs').delete().eq('session_id', id)
    const { error } = await db.from('candidate_sessions').delete().eq('id', id)
    if (error) return reply.status(400).send({ error: error.message })
    return reply.send({ success: true })
  })

  // POST /api/admin/sessions/:id/disqualify — disqualify candidate
  app.post('/:id/disqualify', { preHandler: requireAdmin }, async (request, reply) => {
    const { data, error } = await db
      .from('candidate_sessions')
      .update({ status: 'disqualified' })
      .eq('id', request.params.id)
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    return reply.send(data)
  })
}
