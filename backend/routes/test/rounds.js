import { db } from '../../lib/db.js'

export default async function testRoundRoutes(app) {
  // GET /api/test/rounds — list published rounds for candidates
  app.get('/', async (request, reply) => {
    const { data, error } = await db
      .from('rounds')
      .select('id, title, description, round_type, duration_minutes, is_active')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (error) return reply.status(500).send({ error: error.message })
    return reply.send(data)
  })
}
