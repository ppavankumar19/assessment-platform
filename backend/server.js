import { buildApp } from './app.js'
import staticPlugin from '@fastify/static'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = await buildApp()

// Serve frontend static files
await app.register(staticPlugin, {
  root: join(__dirname, '../frontend'),
  prefix: '/',
  index: 'index.html',
  decorateReply: true,
})

app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/api/')) {
    return reply.status(404).send({ error: 'Not found' })
  }
  return reply.sendFile('index.html')
})

const PORT = Number(process.env.PORT || 4000)
await app.listen({ port: PORT, host: '0.0.0.0' })
console.log(`Server running on http://localhost:${PORT}`)

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Render and other PaaS platforms send SIGTERM before killing the container.
// Close the server cleanly so in-flight requests can finish.

async function shutdown(signal) {
  console.log(`Received ${signal} — shutting down gracefully`)
  try {
    await app.close()
    console.log('Server closed')
    process.exit(0)
  } catch (err) {
    console.error('Error during shutdown:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
