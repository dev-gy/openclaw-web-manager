import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate(
    'requireAuth',
    async function (request: FastifyRequest, reply: FastifyReply) {
      const session = request.cookies.owm_session
      if (session !== 'authenticated') {
        return reply.status(401).send({ message: 'Unauthorized' })
      }
    },
  )
}
