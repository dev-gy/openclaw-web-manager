import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyWebsocket from '@fastify/websocket'
import fastifyRateLimit from '@fastify/rate-limit'
import vike from 'vike-node/fastify'
import { ensureDefaultAdmin, validateSession, cleanExpiredSessions } from './db/index.js'
import { detectEnvironment } from './services/env-detect.js'
import { tryAutoConnect } from './services/auto-connect.js'

startServer()

async function startServer() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  // --- DB 초기화 ---

  await ensureDefaultAdmin()

  // Guard/Data에서 server/db를 직접 import하면 Rollup 빌드 에러 발생 → globalThis로 공유
  ;(globalThis as any).__owmValidateSession = validateSession

  // --- Plugins ---

  await app.register(fastifyCookie, {
    secret: process.env.OWM_COOKIE_SECRET || 'change-me-in-production',
  })

  if (process.env.NODE_ENV === 'production') {
    await app.register(fastifyRateLimit, {
      max: 100,
      timeWindow: '1 minute',
    })
  }

  // WebSocket 플러그인: 우리 WS 라우트만 Fastify가 처리, 나머지(Vite HMR 등) 패스
  await app.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576,
      verifyClient: (info: { req: { url?: string } }) => {
        const url = info.req.url || ''
        // /ws/ 경로만 Fastify WebSocket으로 처리
        return url.startsWith('/ws/')
      },
    },
  })

  // --- Auth Decorator ---

  app.decorate(
    'requireAuth',
    async function (request: any, reply: any) {
      const token = request.cookies.owm_session
      if (!token) {
        return reply.status(401).send({ message: 'Unauthorized' })
      }
      const session = await validateSession(token)
      if (!session) {
        return reply.status(401).send({ message: 'Unauthorized' })
      }
      request.user = session
    },
  )

  // --- Health Check (인증 불필요) ---

  app.get('/api/health', async () => ({ status: 'ok', uptime: process.uptime() }))

  // --- API Routes ---

  await app.register(import('./routes/auth.js'), { prefix: '/api/auth' })
  await app.register(import('./routes/connection.js'), { prefix: '/api/connection' })
  await app.register(import('./routes/config.js'), { prefix: '/api/config' })
  await app.register(import('./routes/install.js'), { prefix: '/api/install' })
  await app.register(import('./routes/server.js'), { prefix: '/api/server' })

  // --- WebSocket Routes ---

  await app.register(import('./routes/ws.js'))

  // --- Vike SSR ---

  app.all('/*', vike())

  // --- 세션 정리 (1시간 간격) ---

  setInterval(async () => {
    const cleaned = await cleanExpiredSessions()
    if (cleaned > 0) app.log.info(`Cleaned ${cleaned} expired sessions`)
  }, 60 * 60 * 1000)

  // --- Start ---

  const port = parseInt(process.env.PORT || '3000', 10)
  const host = process.env.HOST || '0.0.0.0'

  await app.listen({ port, host })
  app.log.info(`OWM server running at http://${host}:${port}`)

  // --- 환경 정보 로깅 ---
  try {
    const env = await detectEnvironment()
    app.log.info(`[환경] runtime=${env.runtime}, platform=${env.platform}, node=${env.nodeVersion}`)
    app.log.info(`[환경] openclaw=${env.openclawInstalled ? env.openclawVersion : '미설치'}, root=${env.isRoot}`)
  } catch (err: any) {
    app.log.warn(`환경 감지 실패: ${err.message}`)
  }

  // --- Zero-Touch 자동 연결 ---
  // 서버 시작 후 비동기로 Gateway 감지 및 자동 연결 시도
  // 실패해도 서버 동작에 영향 없음
  setImmediate(async () => {
    try {
      await tryAutoConnect({
        info: (msg) => app.log.info(msg),
        warn: (msg) => app.log.warn(msg),
      })
    } catch (err: any) {
      app.log.warn(`자동 연결 실패: ${err.message}`)
    }
  })
}
