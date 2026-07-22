import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'

import authRoutes          from './routes/auth.js'
import adminRoundRoutes    from './routes/admin/rounds.js'
import adminQuestionRoutes from './routes/admin/questions.js'
import adminSessionRoutes  from './routes/admin/sessions.js'
import adminLibraryRoutes  from './routes/admin/library.js'
import testRoundRoutes     from './routes/test/rounds.js'
import testRegisterRoutes  from './routes/test/register.js'
import testQuestionsRoutes from './routes/test/questions.js'
import testSubmitRoutes    from './routes/test/submit.js'
import testAnswerRoutes    from './routes/test/answer.js'
import testExecuteCRoutes  from './routes/test/execute_c.js'
import testExecutePyRoutes from './routes/test/execute_py.js'
import testSessionRoutes   from './routes/test/session.js'

const ALLOWED_ORIGINS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : ['http://localhost:4000']

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || 'warn' },
    trustProxy: true,
  })

  // Maintenance mode — return 503 for all API requests
  if (process.env.MAINTENANCE_MODE === 'true') {
    app.addHook('onRequest', async (_req, reply) => {
      reply.status(503).send({ error: 'Assessment platform is under maintenance. Please try again later.' })
    })
  }

  await app.register(cors, {
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ error: 'Too many requests. Please slow down.' }),
  })

  // Global error handler — never expose stack traces to clients
  app.setErrorHandler((err, _request, reply) => {
    app.log.error(err)
    const status = err.statusCode || 500
    if (status >= 500) {
      return reply.status(500).send({ error: 'An unexpected error occurred. Please try again.' })
    }
    return reply.status(status).send({ error: err.message })
  })

  await app.register(authRoutes,          { prefix: '/api/auth' })
  await app.register(adminRoundRoutes,    { prefix: '/api/admin/rounds' })
  await app.register(adminQuestionRoutes, { prefix: '/api/admin/questions' })
  await app.register(adminSessionRoutes,  { prefix: '/api/admin/sessions' })
  await app.register(adminLibraryRoutes,  { prefix: '/api/admin/library' })
  await app.register(testRoundRoutes,     { prefix: '/api/test/rounds' })
  await app.register(testRegisterRoutes,  { prefix: '/api/test' })
  await app.register(testQuestionsRoutes, { prefix: '/api/test' })
  await app.register(testSubmitRoutes,    { prefix: '/api/test' })
  await app.register(testAnswerRoutes,    { prefix: '/api/test' })
  await app.register(testExecuteCRoutes,  { prefix: '/api/test' })
  await app.register(testExecutePyRoutes, { prefix: '/api/test' })
  await app.register(testSessionRoutes,   { prefix: '/api/test/session' })

  app.get('/api/health', async () => ({ status: 'ok', ts: Date.now() }))

  return app
}
