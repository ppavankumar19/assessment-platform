import { buildApp } from './app.js'
import staticPlugin from '@fastify/static'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = await buildApp()

// Serve frontend static files in local dev
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
