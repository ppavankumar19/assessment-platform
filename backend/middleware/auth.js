import { makeUserClient, db } from '../lib/db.js'

// In-memory token → profile cache. Avoids 2 DB round-trips per admin request.
// Entries expire after TTL_MS; stale entries cleaned on each read.
const TOKEN_CACHE     = new Map()
const TTL_MS          = 5 * 60 * 1000   // 5 minutes
const MAX_CACHE_SIZE  = 500              // bound memory usage

function cacheGet(token) {
  const entry = TOKEN_CACHE.get(token)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { TOKEN_CACHE.delete(token); return null }
  return entry.user
}

function cacheSet(token, user) {
  // Evict oldest entry if at capacity
  if (TOKEN_CACHE.size >= MAX_CACHE_SIZE) {
    TOKEN_CACHE.delete(TOKEN_CACHE.keys().next().value)
  }
  TOKEN_CACHE.set(token, { user, expiresAt: Date.now() + TTL_MS })
}

/**
 * Fastify preHandler: requires a valid Supabase access token in Authorization header
 * and that the user has role='admin' in the users table.
 */
export async function requireAdmin(request, reply) {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Authorization header required' })
  }

  const token  = authHeader.slice(7)
  const cached = cacheGet(token)
  if (cached) {
    request.user = cached
    return
  }

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

  const merged = { ...user, ...profile }
  cacheSet(token, merged)
  request.user = merged
}

/** Call after logout or role change to invalidate the cache entry immediately. */
export function invalidateAdminToken(token) {
  TOKEN_CACHE.delete(token)
}
