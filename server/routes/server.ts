import type { FastifyPluginAsync } from 'fastify'
import { getConnectionManager } from '../services/connection-manager.js'
import { getProcessManager, getEnvironmentInfo } from '../services/process-manager-factory.js'

const serverRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.requireAuth)

  // GET /api/server/status — 연결 + 프로세스 통합 상태
  fastify.get('/status', async () => {
    const cm = getConnectionManager()
    return {
      connection: cm.getStatus(),
      gatewayConnected: cm.isConnected(), // 하위 호환
    }
  })

  // GET /api/server/info — Gateway 상세 정보
  fastify.get('/info', async (request, reply) => {
    try {
      const cm = getConnectionManager()
      const [status, health, models] = await Promise.all([
        cm.rpc('status'),
        cm.rpc('health'),
        cm.rpc('models.list').catch(() => null),
      ])
      return { status, health, models }
    } catch (err) {
      return reply.status(503).send({ error: 'Gateway에 연결되어 있지 않습니다' })
    }
  })

  // POST /api/server/connect — 하위 호환 (→ /api/connection 사용 권장)
  fastify.post('/connect', async (request, reply) => {
    const { gatewayHost, gatewayPort, gatewayToken } = request.body as {
      gatewayHost?: string
      gatewayPort?: number
      gatewayToken?: string
    }

    try {
      const cm = getConnectionManager()
      const host = gatewayHost || 'localhost'
      const port = gatewayPort || 18789
      await cm.connect({
        type: 'websocket',
        url: `ws://${host}:${port}`,
        token: gatewayToken || '',
      })
      return { success: true }
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message || '연결 실패',
      })
    }
  })

  // --- 프로세스 관리 API ---

  // GET /api/server/process/status
  fastify.get('/process/status', async (request, reply) => {
    try {
      const pm = await getProcessManager()
      const status = await pm.getStatus()
      const env = getEnvironmentInfo()
      return { ...status, environment: env }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // GET /api/server/process/logs
  fastify.get('/process/logs', async (request, reply) => {
    const { lines } = request.query as { lines?: string }

    try {
      const pm = await getProcessManager()
      const logs = await pm.getLogs(lines ? parseInt(lines, 10) : 100)
      return { logs }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // POST /api/server/process/start
  fastify.post('/process/start', async (request, reply) => {
    const { configPath } = request.body as { configPath: string }

    if (!configPath) {
      return reply.status(400).send({ error: '설정 파일 경로가 필요합니다' })
    }

    try {
      const pm = await getProcessManager()
      await pm.start(configPath)
      return { success: true, message: '프로세스가 시작되었습니다' }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || '프로세스 시작 실패',
      })
    }
  })

  // POST /api/server/process/stop
  fastify.post('/process/stop', async (request, reply) => {
    try {
      const pm = await getProcessManager()
      await pm.stop()
      return { success: true, message: '프로세스가 중지되었습니다' }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || '프로세스 중지 실패',
      })
    }
  })

  // POST /api/server/process/restart
  fastify.post('/process/restart', async (request, reply) => {
    try {
      const pm = await getProcessManager()
      await pm.restart()
      return { success: true, message: '프로세스가 재시작되었습니다' }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || '프로세스 재시작 실패',
      })
    }
  })

  // POST /api/server/restart — Gateway 재시작 (ProcessManager 사용)
  fastify.post('/restart', async (request, reply) => {
    try {
      const pm = await getProcessManager()
      await pm.restart()
      return { success: true, message: 'Gateway가 재시작되었습니다' }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || 'Gateway 재시작 실패',
      })
    }
  })

  // --- 세션 관리 API (Gateway RPC 프록시) ---

  // GET /api/server/sessions — 세션 목록
  fastify.get('/sessions', async (request, reply) => {
    try {
      const cm = getConnectionManager()
      if (!cm.isConnected()) {
        return reply.status(503).send({ error: 'Gateway에 연결되어 있지 않습니다' })
      }
      const sessions = await cm.rpc('sessions.list')
      return { sessions: sessions || [] }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || '세션 목록 조회 실패' })
    }
  })

  // GET /api/server/sessions/:id — 세션 상세
  fastify.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const cm = getConnectionManager()
      if (!cm.isConnected()) {
        return reply.status(503).send({ error: 'Gateway에 연결되어 있지 않습니다' })
      }
      const session = await cm.rpc('sessions.get', { id })
      if (!session) {
        return reply.status(404).send({ error: '세션을 찾을 수 없습니다' })
      }
      return { session }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || '세션 조회 실패' })
    }
  })

  // DELETE /api/server/sessions/:id — 세션 종료
  fastify.delete('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const cm = getConnectionManager()
      if (!cm.isConnected()) {
        return reply.status(503).send({ error: 'Gateway에 연결되어 있지 않습니다' })
      }
      await cm.rpc('sessions.kill', { id })
      return { success: true, message: '세션이 종료되었습니다' }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || '세션 종료 실패' })
    }
  })

  // --- 로그 API (Gateway RPC 프록시) ---

  // GET /api/server/logs/recent — 최근 로그 조회
  fastify.get('/logs/recent', async (request, reply) => {
    const { lines, level } = request.query as { lines?: string; level?: string }
    try {
      const cm = getConnectionManager()
      if (!cm.isConnected()) {
        return reply.status(503).send({ error: 'Gateway에 연결되어 있지 않습니다' })
      }
      const logs = await cm.rpc('logs.recent', {
        lines: lines ? parseInt(lines, 10) : 100,
        level: level || 'all',
      })
      return { logs: logs || [] }
    } catch (err: any) {
      // logs.recent RPC가 없으면 프로세스 로그로 폴백
      try {
        const pm = await getProcessManager()
        const processLogs = await pm.getLogs(lines ? parseInt(lines, 10) : 100)
        return { logs: processLogs.map((text: string) => ({ text, level: 'info', timestamp: Date.now() })) }
      } catch {
        return reply.status(500).send({ error: err.message || '로그 조회 실패' })
      }
    }
  })
}

export default serverRoutes
