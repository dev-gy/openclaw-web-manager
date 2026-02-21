import type { FastifyPluginAsync } from 'fastify'
import { GatewayClient } from '../services/gateway-client.js'

const wsRoutes: FastifyPluginAsync = async (fastify) => {
  // ws://host/ws/gateway — Gateway RPC proxy (bidirectional)
  fastify.get('/ws/gateway', { websocket: true }, (socket, req) => {
    const gateway = GatewayClient.getInstance()

    if (!gateway.isConnected()) {
      socket.send(JSON.stringify({ error: 'Gateway not connected' }))
      socket.close()
      return
    }

    // Forward client messages to Gateway
    socket.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString())
        const result = await gateway.rpc(data.method, data.params)
        socket.send(JSON.stringify({ id: data.id, result }))
      } catch (err: any) {
        socket.send(
          JSON.stringify({ id: null, error: err.message || 'RPC failed' })
        )
      }
    })

    socket.on('close', () => {
      fastify.log.debug('WS client disconnected from /ws/gateway')
    })
  })

  // ws://host/ws/logs — Log tail stream
  fastify.get('/ws/logs', { websocket: true }, (socket, req) => {
    const gateway = GatewayClient.getInstance()

    if (!gateway.isConnected()) {
      socket.send(JSON.stringify({ error: 'Gateway not connected' }))
      socket.close()
      return
    }

    // TODO: Phase 4 — Subscribe to logs.tail and stream events
    socket.send(JSON.stringify({ type: 'info', message: 'Log streaming will be connected in Phase 4' }))

    socket.on('close', () => {
      fastify.log.debug('WS client disconnected from /ws/logs')
    })
  })

  // ws://host/ws/install — Install progress stream (SSH stdout/stderr)
  fastify.get('/ws/install', { websocket: true }, (socket, req) => {
    // TODO: Phase 3 — Stream SSH command output during installation
    socket.send(JSON.stringify({ type: 'info', message: 'Install streaming will be connected in Phase 3' }))

    socket.on('close', () => {
      fastify.log.debug('WS client disconnected from /ws/install')
    })
  })
}

export default wsRoutes
