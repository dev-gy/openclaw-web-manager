import type { FastifyPluginAsync } from 'fastify'
import {
  verifyUser,
  createSession,
  validateSession,
  deleteSession,
  changePassword,
} from '../db/index.js'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body as {
      username: string
      password: string
    }

    if (!username || !password) {
      return reply.status(400).send({ message: 'Username and password required' })
    }

    const user = await verifyUser(username, password)
    if (!user) {
      return reply.status(401).send({ message: 'Invalid credentials' })
    }

    const token = await createSession(user.id)

    reply.setCookie('owm_session', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
    })

    return { success: true }
  })

  // POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    const token = request.cookies.owm_session
    if (token) {
      await deleteSession(token)
    }
    reply.clearCookie('owm_session', { path: '/' })
    return { success: true }
  })

  // GET /api/auth/me
  fastify.get('/me', async (request, reply) => {
    const token = request.cookies.owm_session
    if (!token) {
      return reply.status(401).send({ authenticated: false })
    }

    const session = await validateSession(token)
    if (!session) {
      reply.clearCookie('owm_session', { path: '/' })
      return reply.status(401).send({ authenticated: false })
    }

    return {
      authenticated: true,
      userId: session.userId,
      username: session.username,
    }
  })

  // POST /api/auth/change-password
  fastify.post('/change-password', async (request, reply) => {
    const token = request.cookies.owm_session
    if (!token) {
      return reply.status(401).send({ message: 'Unauthorized' })
    }

    const session = await validateSession(token)
    if (!session) {
      return reply.status(401).send({ message: 'Unauthorized' })
    }

    const { currentPassword, newPassword } = request.body as {
      currentPassword: string
      newPassword: string
    }

    if (!currentPassword || !newPassword) {
      return reply.status(400).send({ message: 'Current and new password required' })
    }

    if (newPassword.length < 4) {
      return reply.status(400).send({ message: 'Password must be at least 4 characters' })
    }

    const changed = await changePassword(session.userId, currentPassword, newPassword)
    if (!changed) {
      return reply.status(400).send({ message: 'Current password is incorrect' })
    }

    return { success: true }
  })
}

export default authRoutes
