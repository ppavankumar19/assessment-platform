import { makeUserClient, db } from '../lib/db.js'

/**
 * Fastify preHandler: requires a valid Supabase access token in Authorization header
 * and that the user has role='admin' in the users table.
 */
export async function requireAdmin(request, reply) {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Authorization header required' })
  }

  const token = authHeader.slice(7)
  const client = makeUserClient(token)
  const { data: { user }, error } = await client.auth.getUser()

  if (error || !user) {
    return reply.status(401).send({ error: 'Invalid or expired session' })
  }

  const { data: profile, error: profileErr } = await db
    .from('users')
    .select('id, role, full_name, email')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile || profile.role !== 'admin') {
    return reply.status(403).send({ error: 'Admin access required' })
  }

  request.user = { ...user, ...profile }
}
