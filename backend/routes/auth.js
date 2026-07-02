import { makeUserClient, db } from '../lib/db.js'

export default async function authRoutes(app) {
  // GET /api/auth/user — return current admin profile
  app.get('/user', async (request, reply) => {
    const authHeader = request.headers.authorization
    if (!authHeader) return reply.status(401).send({ error: 'No token' })

    const token = authHeader.slice(7)
    const client = makeUserClient(token)
    const { data: { user }, error } = await client.auth.getUser()

    if (error || !user) return reply.status(401).send({ error: 'Invalid session' })

    const { data: profile } = await db
      .from('users')
      .select('id, email, full_name, role, avatar_url')
      .eq('id', user.id)
      .single()

    if (!profile) return reply.status(404).send({ error: 'User not found' })
    return reply.send(profile)
  })
}
