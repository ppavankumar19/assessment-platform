import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'

import authRoutes          from './routes/auth.js'
import adminRoundRoutes    from './routes/admin/rounds.js'
import adminQuestionRoutes from './routes/admin/questions.js'
import adminSessionRoutes  from './routes/admin/sessions.js'
import testRoundRoutes     from './routes/test/rounds.js'
import testRegisterRoutes  from './routes/test/register.js'
import testQuestionsRoutes from './routes/test/questions.js'
import testSubmitRoutes    from './routes/test/submit.js'
import testExecuteCRoutes  from './routes/test/execute_c.js'
import testSessionRoutes   from './routes/test/session.js'

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || 'warn' },
    trustProxy: true,
  })

  await app.register(cors, {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ error: 'Too many requests. Please slow down.' }),
  })

  await app.register(authRoutes,          { prefix: '/api/auth' })
  await app.register(adminRoundRoutes,    { prefix: '/api/admin/rounds' })
  await app.register(adminQuestionRoutes, { prefix: '/api/admin/questions' })
  await app.register(adminSessionRoutes,  { prefix: '/api/admin/sessions' })
  await app.register(testRoundRoutes,     { prefix: '/api/test/rounds' })
  await app.register(testRegisterRoutes,  { prefix: '/api/test' })
  await app.register(testQuestionsRoutes, { prefix: '/api/test' })
  await app.register(testSubmitRoutes,    { prefix: '/api/test' })
  await app.register(testExecuteCRoutes,  { prefix: '/api/test' })
  await app.register(testSessionRoutes,   { prefix: '/api/test/session' })

  app.get('/api/health', async () => ({ status: 'ok', ts: Date.now() }))

  return app
}
