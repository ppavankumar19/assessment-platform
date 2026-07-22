import { db } from '../../lib/db.js'
import { requireAdmin } from '../../middleware/auth.js'
import { stringify } from 'csv-stringify/sync'

export default async function adminRoundRoutes(app) {
  const pre = [{ preHandler: requireAdmin }]

  // GET /api/admin/rounds — list all rounds with session stats
  app.get('/', { preHandler: requireAdmin }, async (request, reply) => {
    const { data: rounds, error } = await db
      .from('rounds')
      .select(`
        id, title, description, round_type, duration_minutes,
        is_published, is_active, cutoff_score, created_at,
        candidate_sessions(count)
      `)
      .order('created_at', { ascending: false })

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(rounds)
  })

  // POST /api/admin/rounds — create round
  app.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const { title, description, round_type, duration_minutes, cutoff_score } = request.body
    if (!title || !round_type || !duration_minutes) {
      return reply.status(400).send({ error: 'title, round_type, duration_minutes are required' })
    }

    const { data, error } = await db
      .from('rounds')
      .insert({ title, description, round_type, duration_minutes, cutoff_score: cutoff_score || null })
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // GET /api/admin/rounds/:id — get round with questions and sessions
  app.get('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params
    const { data: round, error } = await db
      .from('rounds')
      .select(`
        id, title, description, round_type, duration_minutes,
        is_published, is_active, cutoff_score, created_at,
        questions(
          id, title, description, question_type, points, starter_code, language, expected_output, order_index,
          test_cases(id, input, expected_output, is_hidden, points, order_index)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !round) return reply.status(404).send({ error: 'Round not found' })

    // Order questions and test cases
    round.questions?.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    round.questions?.forEach(q => {
      q.test_cases?.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    })

    return reply.send(round)
  })

  // PUT /api/admin/rounds/:id — update round
  app.put('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params
    const { title, description, round_type, duration_minutes, cutoff_score } = request.body

    const { data, error } = await db
      .from('rounds')
      .update({ title, description, round_type, duration_minutes, cutoff_score })
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    return reply.send(data)
  })

  // DELETE /api/admin/rounds/:id
  app.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { error } = await db.from('rounds').delete().eq('id', request.params.id)
    if (error) return reply.status(400).send({ error: error.message })
    return reply.send({ success: true })
  })

  // POST /api/admin/rounds/:id/publish
  app.post('/:id/publish', { preHandler: requireAdmin }, async (request, reply) => {
    const { data, error } = await db
      .from('rounds')
      .update({ is_published: true, is_active: true })
      .eq('id', request.params.id)
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    await db.from('audit_logs').insert({
      event_type: 'admin_publish_round',
      event_data: { admin_id: request.user.id, admin_email: request.user.email, round_id: request.params.id, round_title: data.title },
    })
    return reply.send(data)
  })

  // POST /api/admin/rounds/:id/unpublish
  app.post('/:id/unpublish', { preHandler: requireAdmin }, async (request, reply) => {
    const { data, error } = await db
      .from('rounds')
      .update({ is_published: false, is_active: false })
      .eq('id', request.params.id)
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    await db.from('audit_logs').insert({
      event_type: 'admin_unpublish_round',
      event_data: { admin_id: request.user.id, admin_email: request.user.email, round_id: request.params.id, round_title: data.title },
    })
    return reply.send(data)
  })

  // POST /api/admin/rounds/:id/pause
  app.post('/:id/pause', { preHandler: requireAdmin }, async (request, reply) => {
    const { data, error } = await db
      .from('rounds')
      .update({ is_active: false })
      .eq('id', request.params.id)
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    await db.from('audit_logs').insert({
      event_type: 'admin_pause_round',
      event_data: { admin_id: request.user.id, admin_email: request.user.email, round_id: request.params.id, round_title: data.title },
    })
    return reply.send(data)
  })

  // GET /api/admin/rounds/:id/sessions — sessions for a round
  app.get('/:id/sessions', { preHandler: requireAdmin }, async (request, reply) => {
    const { data, error } = await db
      .from('candidate_sessions')
      .select(`
        id, candidate_name, candidate_email, college_name, roll_no, branch,
        status, score, created_at, started_at, completed_at,
        submissions(id, question_id, score, status, is_final)
      `)
      .eq('round_id', request.params.id)
      .order('created_at', { ascending: false })

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // GET /api/admin/rounds/:id/export — export CSV
  app.get('/:id/export', { preHandler: requireAdmin }, async (request, reply) => {
    const { finalized } = request.query

    const { data: round } = await db
      .from('rounds')
      .select('title, cutoff_score')
      .eq('id', request.params.id)
      .single()

    const { data: sessions, error } = await db
      .from('candidate_sessions')
      .select('candidate_name, candidate_email, college_name, roll_no, branch, status, score, completed_at')
      .eq('round_id', request.params.id)
      .order('score', { ascending: false })

    if (error) return reply.status(500).send({ error: error.message })

    let rows = sessions || []
    if (finalized === 'true' && round?.cutoff_score != null) {
      rows = rows.filter(s => (s.score || 0) >= round.cutoff_score)
    }

    const csvData = rows.map(s => ({
      Name:        s.candidate_name || '',
      Email:       s.candidate_email || '',
      College:     s.college_name || '',
      RollNo:      s.roll_no || '',
      Branch:      s.branch || '',
      Status:      s.status,
      Score:       s.score ?? 0,
      CompletedAt: s.completed_at || '',
    }))

    const csv = stringify(csvData, { header: true })
    const filename = `${(round?.title || 'round').replace(/\s+/g,'-')}-results.csv`

    reply.header('Content-Type', 'text/csv')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    return reply.send(csv)
  })
}
