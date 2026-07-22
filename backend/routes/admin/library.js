import { db } from '../../lib/db.js'
import { requireAdmin } from '../../middleware/auth.js'

export default async function adminLibraryRoutes(app) {
  // GET /api/admin/library — list all library questions
  app.get('/', { preHandler: requireAdmin }, async (request, reply) => {
    const { type, search } = request.query
    let query = db.from('library_questions').select('*').order('created_at', { ascending: false })
    if (type) query = query.eq('question_type', type)
    if (search) query = query.ilike('title', `%${search}%`)
    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })

  // POST /api/admin/library — create library question
  app.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const { title, description, question_type, points, starter_code, mcq_options, tags } = request.body
    if (!title) return reply.status(400).send({ error: 'title is required' })

    const { data, error } = await db
      .from('library_questions')
      .insert({
        title, description,
        question_type: question_type || 'output_prediction',
        points: points || 10,
        starter_code: starter_code || null,
        mcq_options: mcq_options || null,
        tags: tags || [],
      })
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // PUT /api/admin/library/:id — update library question
  app.put('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { title, description, question_type, points, starter_code, mcq_options, tags } = request.body

    const { data, error } = await db
      .from('library_questions')
      .update({
        title, description, question_type, points,
        starter_code: starter_code || null,
        mcq_options: mcq_options || null,
        tags: tags || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.params.id)
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })
    return reply.send(data)
  })

  // DELETE /api/admin/library/:id
  app.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { error } = await db.from('library_questions').delete().eq('id', request.params.id)
    if (error) return reply.status(400).send({ error: error.message })
    return reply.send({ success: true })
  })

  // POST /api/admin/library/:id/import — copy library question into a round
  app.post('/:id/import', { preHandler: requireAdmin }, async (request, reply) => {
    const { round_id, order_index } = request.body
    if (!round_id) return reply.status(400).send({ error: 'round_id is required' })

    const { data: lq, error: lErr } = await db
      .from('library_questions')
      .select('*')
      .eq('id', request.params.id)
      .single()

    if (lErr || !lq) return reply.status(404).send({ error: 'Library question not found' })

    const { data: question, error: qErr } = await db
      .from('questions')
      .insert({
        round_id,
        title:         lq.title,
        description:   lq.description,
        question_type: lq.question_type,
        points:        lq.points,
        starter_code:  lq.starter_code,
        mcq_options:   lq.mcq_options,
        order_index:   order_index || 0,
      })
      .select()
      .single()

    if (qErr) return reply.status(400).send({ error: qErr.message })

    const { data: full } = await db
      .from('questions')
      .select('*, test_cases(*)')
      .eq('id', question.id)
      .single()

    return reply.status(201).send(full)
  })
}
