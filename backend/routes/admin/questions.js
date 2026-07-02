import { db } from '../../lib/db.js'
import { requireAdmin } from '../../middleware/auth.js'

export default async function adminQuestionRoutes(app) {
  // POST /api/admin/questions — create question (with test cases)
  app.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const {
      round_id, title, description, question_type,
      points, starter_code, expected_output, order_index,
      test_cases,
    } = request.body

    if (!round_id || !title) {
      return reply.status(400).send({ error: 'round_id and title are required' })
    }

    const { data: question, error } = await db
      .from('questions')
      .insert({
        round_id, title, description, question_type: question_type || 'coding',
        points: points || 100, starter_code, expected_output,
        order_index: order_index || 0,
      })
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })

    // Insert test cases if provided
    if (test_cases && test_cases.length > 0) {
      const tcRows = test_cases.map((tc, i) => ({
        question_id: question.id,
        input: tc.input || '',
        expected_output: tc.expected_output || '',
        is_hidden: tc.is_hidden || false,
        points: tc.points || 0,
        order_index: tc.order_index ?? i,
      }))
      await db.from('test_cases').insert(tcRows)
    }

    // Return full question with test cases
    const { data: full } = await db
      .from('questions')
      .select('*, test_cases(*)')
      .eq('id', question.id)
      .single()

    return reply.status(201).send(full)
  })

  // PUT /api/admin/questions/:id — update question
  app.put('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params
    const {
      title, description, question_type, points,
      starter_code, expected_output, order_index,
      test_cases,
    } = request.body

    const { data: question, error } = await db
      .from('questions')
      .update({ title, description, question_type, points, starter_code, expected_output, order_index })
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.status(400).send({ error: error.message })

    // Replace test cases if provided
    if (test_cases !== undefined) {
      await db.from('test_cases').delete().eq('question_id', id)
      if (test_cases.length > 0) {
        const tcRows = test_cases.map((tc, i) => ({
          question_id: id,
          input: tc.input || '',
          expected_output: tc.expected_output || '',
          is_hidden: tc.is_hidden || false,
          points: tc.points || 0,
          order_index: tc.order_index ?? i,
        }))
        await db.from('test_cases').insert(tcRows)
      }
    }

    const { data: full } = await db
      .from('questions')
      .select('*, test_cases(*)')
      .eq('id', id)
      .single()

    return reply.send(full)
  })

  // DELETE /api/admin/questions/:id
  app.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params
    // Cascade: delete test cases first
    await db.from('test_cases').delete().eq('question_id', id)
    const { error } = await db.from('questions').delete().eq('id', id)
    if (error) return reply.status(400).send({ error: error.message })
    return reply.send({ success: true })
  })
}
