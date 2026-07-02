import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import staticPlugin from '@fastify/static'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import authRoutes         from './routes/auth.js'
import adminRoundRoutes   from './routes/admin/rounds.js'
import adminQuestionRoutes from './routes/admin/questions.js'
import adminSessionRoutes from './routes/admin/sessions.js'
import testRoundRoutes    from './routes/test/rounds.js'
import testRegisterRoutes from './routes/test/register.js'
import testQuestionsRoutes from './routes/test/questions.js'
import testSubmitRoutes   from './routes/test/submit.js'
import testSessionRoutes  from './routes/test/session.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  trustProxy: true,
})

// CORS
await app.register(cors, {
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
})

// Rate limiting
await app.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({ error: 'Too many requests. Please slow down.' }),
})

// Serve frontend static files
await app.register(staticPlugin, {
  root: join(__dirname, '../frontend'),
  prefix: '/',
  index: 'index.html',
  decorateReply: true,
})

// API routes
await app.register(authRoutes,          { prefix: '/api/auth' })
await app.register(adminRoundRoutes,    { prefix: '/api/admin/rounds' })
await app.register(adminQuestionRoutes, { prefix: '/api/admin/questions' })
await app.register(adminSessionRoutes,  { prefix: '/api/admin/sessions' })
await app.register(testRoundRoutes,     { prefix: '/api/test/rounds' })
await app.register(testRegisterRoutes,  { prefix: '/api/test' })
await app.register(testQuestionsRoutes, { prefix: '/api/test' })
await app.register(testSubmitRoutes,    { prefix: '/api/test' })
await app.register(testSessionRoutes,   { prefix: '/api/test/session' })

// Health check
app.get('/api/health', async () => ({ status: 'ok', ts: Date.now() }))

// 404 fallback for SPA-style navigation
app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/api/')) {
    return reply.status(404).send({ error: 'Not found' })
  }
  // Serve frontend index for non-API routes
  return reply.sendFile('index.html')
})

const PORT = Number(process.env.PORT || 4000)
await app.listen({ port: PORT, host: '0.0.0.0' })
