import type { FastifyPluginAsync } from 'fastify'
import { GatewayClient } from '../services/gateway-client.js'

const configRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/config/schema
  fastify.get('/schema', async (request, reply) => {
    try {
      const gateway = GatewayClient.getInstance()
      const schema = await gateway.rpc('config.schema')
      return schema
    } catch (err) {
      return reply.status(503).send({ error: 'Gateway not connected' })
    }
  })

  // GET /api/config/current
  fastify.get('/current', async (request, reply) => {
    try {
      const gateway = GatewayClient.getInstance()
      const config = await gateway.rpc('config.get')
      return config
    } catch (err) {
      return reply.status(503).send({ error: 'Gateway not connected' })
    }
  })

  // PUT /api/config/update
  fastify.put('/update', async (request, reply) => {
    try {
      const gateway = GatewayClient.getInstance()
      const result = await gateway.rpc('config.set', request.body)
      return result
    } catch (err: any) {
      if (err.message?.includes('base-hash')) {
        return reply.status(409).send({ error: 'Config conflict', details: err.message })
      }
      return reply.status(503).send({ error: 'Gateway not connected' })
    }
  })

  // POST /api/config/apply
  fastify.post('/apply', async (request, reply) => {
    try {
      const gateway = GatewayClient.getInstance()
      const result = await gateway.rpc('config.apply')
      return result
    } catch (err) {
      return reply.status(503).send({ error: 'Gateway not connected' })
    }
  })
}

export default configRoutes
