import type { FastifyPluginAsync } from 'fastify'
import { GatewayClient } from '../services/gateway-client.js'

const serverRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/server/status
  fastify.get('/status', async (request, reply) => {
    const gateway = GatewayClient.getInstance()
    return {
      gatewayConnected: gateway.isConnected(),
    }
  })

  // GET /api/server/info
  fastify.get('/info', async (request, reply) => {
    try {
      const gateway = GatewayClient.getInstance()
      const [status, health, models] = await Promise.all([
        gateway.rpc('status'),
        gateway.rpc('health'),
        gateway.rpc('models.list'),
      ])
      return { status, health, models }
    } catch (err) {
      return reply.status(503).send({ error: 'Gateway not connected' })
    }
  })

  // POST /api/server/connect
  fastify.post('/connect', async (request, reply) => {
    const { gatewayHost, gatewayPort, gatewayToken } = request.body as {
      gatewayHost: string
      gatewayPort: number
      gatewayToken: string
    }

    try {
      const gateway = GatewayClient.getInstance()
      await gateway.connect({
        host: gatewayHost || 'localhost',
        port: gatewayPort || 18789,
        token: gatewayToken,
      })
      return { success: true }
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || 'Connection failed',
      })
    }
  })
}

export default serverRoutes
