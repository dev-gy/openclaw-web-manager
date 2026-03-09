import type { FastifyPluginAsync } from 'fastify'
import { detectEnvironment } from '../services/env-detect.js'
import { LocalInstaller, type LocalInstallConfig } from '../services/local-installer.js'

const installRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.requireAuth)

  // GET /api/install/environment — 환경 정보 반환
  fastify.get('/environment', async () => {
    const env = await detectEnvironment()
    return env
  })

  // POST /api/install/start — 로컬 설치 파이프라인 시작 (비동기)
  fastify.post('/start', async (request, reply) => {
    const config = request.body as LocalInstallConfig

    // 검증
    if (!config.serverName) {
      config.serverName = 'localhost'
    }
    if (!config.gatewayPort) {
      config.gatewayPort = 18789
    }
    if (!config.gatewayToken) {
      return reply.status(400).send({ success: false, error: 'Gateway 토큰이 필요합니다' })
    }

    const installer = LocalInstaller.getInstance()

    if (installer.isRunning()) {
      return reply.status(409).send({
        success: false,
        error: '설치가 이미 진행 중입니다',
        status: installer.getStatus(),
      })
    }

    // 비동기로 파이프라인 시작 (응답은 즉시 반환)
    installer.start(config).catch((err) => {
      fastify.log.error(`Install pipeline error: ${err.message}`)
    })

    return { success: true, message: '설치가 시작되었습니다' }
  })

  // GET /api/install/status — 현재 설치 상태
  fastify.get('/status', async () => {
    const installer = LocalInstaller.getInstance()
    return installer.getStatus()
  })

  // POST /api/install/abort — 설치 중단
  fastify.post('/abort', async () => {
    const installer = LocalInstaller.getInstance()

    if (!installer.isRunning()) {
      return { success: false, message: '진행 중인 설치가 없습니다' }
    }

    installer.abort()
    return { success: true, message: '설치가 중단되었습니다' }
  })
}

export default installRoutes
