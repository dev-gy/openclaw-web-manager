import type { FastifyPluginAsync } from 'fastify'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body as {
      username: string
      password: string
    }

    // TODO: Phase 2 — Validate against SQLite DB with bcrypt
    // For now, use env-based default credentials
    const defaultUser = process.env.OWM_ADMIN_USER || 'admin'
    const defaultPass = process.env.OWM_ADMIN_PASS || 'admin'

    if (username === defaultUser && password === defaultPass) {
      reply.setCookie('owm_session', 'authenticated', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24 hours
      })
      return { success: true }
    }

    return reply.status(401).send({ message: 'Invalid credentials' })
  })

  // POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('owm_session', { path: '/' })
    return { success: true }
  })

  // GET /api/auth/me
  fastify.get('/me', async (request, reply) => {
    const session = request.cookies.owm_session
    if (session === 'authenticated') {
      return { authenticated: true, username: 'admin' }
    }
    return reply.status(401).send({ authenticated: false })
  })
}

export default authRoutes
