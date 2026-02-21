import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifyWebsocket from '@fastify/websocket'
import fastifyRateLimit from '@fastify/rate-limit'
import { renderPage } from 'vike/server'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProduction = process.env.NODE_ENV === 'production'

export default async function startServer() {
  const app = Fastify({
    logger: {
      level: isProduction ? 'info' : 'debug',
    },
  })

  // --- Plugins ---

  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  })

  await app.register(fastifyCookie, {
    secret: process.env.OWM_COOKIE_SECRET || 'change-me-in-production',
  })

  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  await app.register(fastifyWebsocket, {
    options: { maxPayload: 1048576 },
  })

  // --- API Routes ---

  await app.register(import('./routes/auth.js'), { prefix: '/api/auth' })
  await app.register(import('./routes/config.js'), { prefix: '/api/config' })
  await app.register(import('./routes/install.js'), { prefix: '/api/install' })
  await app.register(import('./routes/server.js'), { prefix: '/api/server' })

  // --- WebSocket Routes ---

  await app.register(import('./routes/ws.js'))

  // --- Static Assets (production) ---

  if (isProduction) {
    await app.register(fastifyStatic, {
      root: path.join(__dirname, '..', 'client'),
      prefix: '/',
    })
  }

  // --- Vike SSR Catch-all ---

  app.get('*', async (req, reply) => {
    const pageContext = await renderPage({
      urlOriginal: req.url,
      headersOriginal: req.headers,
    })

    const { httpResponse } = pageContext

    if (!httpResponse) {
      return reply.callNotFound()
    }

    const { body, statusCode, headers } = httpResponse
    headers.forEach(([name, value]) => reply.header(name, value))
    return reply.status(statusCode).send(body)
  })

  // --- Start ---

  const port = parseInt(process.env.PORT || '3000', 10)
  const host = process.env.HOST || '0.0.0.0'

  await app.listen({ port, host })
  app.log.info(`OWM server running at http://${host}:${port}`)
}

startServer()
