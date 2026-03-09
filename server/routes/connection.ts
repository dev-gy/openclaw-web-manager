import type { FastifyPluginAsync } from 'fastify'
import { getConnectionManager } from '../services/connection-manager.js'
import { discoverGateway } from '../services/auto-discovery.js'

/**
 * 연결 관리 API 라우트
 *
 * GET    /api/connection         — 현재 연결 정보
 * POST   /api/connection         — 연결 설정
 * DELETE /api/connection         — 연결 해제
 * POST   /api/connection/detect  — 자동 감지 실행
 * POST   /api/connection/test    — 연결 테스트
 * POST   /api/connection/reconnect — 수동 재연결
 */
const connectionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.requireAuth)

  // GET /api/connection — 현재 연결 상태
  fastify.get('/', async () => {
    const cm = getConnectionManager()
    return cm.getStatus()
  })

  // POST /api/connection — Gateway에 연결
  fastify.post('/', async (request, reply) => {
    const { url, token } = request.body as {
      url?: string
      token?: string
    }

    if (!url || !token) {
      return reply.status(400).send({
        error: 'url과 token이 필요합니다',
      })
    }

    try {
      const cm = getConnectionManager()
      await cm.connect({ type: 'websocket', url, token })

      return {
        success: true,
        status: cm.getStatus(),
      }
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || '연결 실패',
      })
    }
  })

  // DELETE /api/connection — 연결 해제
  fastify.delete('/', async () => {
    const cm = getConnectionManager()
    await cm.disconnect()
    return { success: true }
  })

  // POST /api/connection/detect — Gateway 자동 감지
  fastify.post('/detect', async () => {
    const result = await discoverGateway()
    return result
  })

  // POST /api/connection/test — 연결 테스트 (연결하고 즉시 해제)
  fastify.post('/test', async (request, reply) => {
    const { url, token } = request.body as {
      url?: string
      token?: string
    }

    if (!url || !token) {
      return reply.status(400).send({
        error: 'url과 token이 필요합니다',
      })
    }

    try {
      // 임시 WebSocket으로 테스트
      // @ts-ignore — ws 타입 선언 없음
      const WS = (await import('ws')).default
      const testResult = await new Promise<{ success: boolean; info?: any; error?: string }>(
        (resolve) => {
          const ws = new WS(url, {
            headers: { Authorization: `Bearer ${token}` },
          })

          const timeout = setTimeout(() => {
            ws.close()
            resolve({ success: false, error: '연결 타임아웃 (5초)' })
          }, 5000)

          ws.on('open', async () => {
            clearTimeout(timeout)
            // health RPC 시도
            try {
              ws.send(JSON.stringify({ id: 'test-1', method: 'health' }))

              const healthTimeout = setTimeout(() => {
                ws.close()
                resolve({ success: true, info: { rpcAvailable: false } })
              }, 3000)

              ws.on('message', (data: any) => {
                clearTimeout(healthTimeout)
                try {
                  const msg = JSON.parse(data.toString())
                  ws.close()
                  resolve({
                    success: true,
                    info: msg.result || msg,
                  })
                } catch {
                  ws.close()
                  resolve({ success: true })
                }
              })
            } catch {
              ws.close()
              resolve({ success: true })
            }
          })

          ws.on('error', (err: any) => {
            clearTimeout(timeout)
            resolve({
              success: false,
              error: err.message || '연결 실패',
            })
          })
        }
      )

      if (testResult.success) {
        return { ...testResult }
      } else {
        return reply.status(400).send(testResult)
      }
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || '테스트 실패',
      })
    }
  })

  // POST /api/connection/reconnect — 수동 재연결
  fastify.post('/reconnect', async (request, reply) => {
    try {
      const cm = getConnectionManager()
      await cm.reconnect()
      return { success: true, status: cm.getStatus() }
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || '재연결 실패',
      })
    }
  })
}

export default connectionRoutes
