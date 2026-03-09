import type { FastifyPluginAsync } from 'fastify'
import { getConnectionManager } from '../services/connection-manager.js'
import {
  listSnapshots,
  getSnapshot,
  createSnapshot,
  deleteSnapshot,
  compareConfigs,
} from '../services/config-snapshot.js'

const configRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.requireAuth)

  // GET /api/config/schema
  fastify.get('/schema', async (request, reply) => {
    try {
      const cm = getConnectionManager()
      const schema = await cm.rpc('config.schema')
      return schema
    } catch (err) {
      return reply.status(503).send({ error: 'Gateway에 연결되어 있지 않습니다' })
    }
  })

  // GET /api/config/current
  fastify.get('/current', async (request, reply) => {
    try {
      const cm = getConnectionManager()
      const config = await cm.rpc('config.get')
      return config
    } catch (err) {
      return reply.status(503).send({ error: 'Gateway에 연결되어 있지 않습니다' })
    }
  })

  // PATCH /api/config — config.patch (base-hash 포함)
  fastify.patch('/', async (request, reply) => {
    try {
      const cm = getConnectionManager()
      const result = await cm.rpc('config.patch', request.body)
      return result
    } catch (err: any) {
      if (err.message?.includes('base-hash') || err.message?.includes('conflict')) {
        // 충돌 시 서버 측 최신 설정도 포함하여 반환
        let serverConfig = null
        let serverHash = null
        try {
          const current = await getConnectionManager().rpc('config.get')
          serverConfig = current?.config || current || null
          serverHash = current?.hash || current?.baseHash || null
        } catch {
          // 최신 설정 가져오기 실패해도 409 응답은 보냄
        }

        return reply.status(409).send({
          error: '설정 충돌',
          details: err.message,
          serverConfig,
          serverHash,
        })
      }
      return reply.status(503).send({ error: 'Gateway에 연결되어 있지 않습니다' })
    }
  })

  // POST /api/config/force — 충돌 무시하고 강제 저장
  fastify.post('/force', async (request, reply) => {
    try {
      const cm = getConnectionManager()
      const { config } = request.body as { config: Record<string, unknown> }
      const result = await cm.rpc('config.set', { config })
      return result
    } catch (err: any) {
      return reply.status(503).send({ error: err.message || '강제 저장 실패' })
    }
  })

  // PUT /api/config/update (하위 호환)
  fastify.put('/update', async (request, reply) => {
    try {
      const cm = getConnectionManager()
      const result = await cm.rpc('config.set', request.body)
      return result
    } catch (err: any) {
      if (err.message?.includes('base-hash') || err.message?.includes('conflict')) {
        return reply.status(409).send({ error: '설정 충돌', details: err.message })
      }
      return reply.status(503).send({ error: 'Gateway에 연결되어 있지 않습니다' })
    }
  })

  // POST /api/config/apply
  fastify.post('/apply', async (request, reply) => {
    try {
      const cm = getConnectionManager()
      const result = await cm.rpc('config.apply')
      return result
    } catch (err) {
      return reply.status(503).send({ error: 'Gateway에 연결되어 있지 않습니다' })
    }
  })

  // ─── 스냅샷 API ───

  // GET /api/config/snapshots
  fastify.get('/snapshots', async (request, reply) => {
    try {
      const { type } = request.query as { type?: 'auto' | 'manual' }
      const snapshots = await listSnapshots(type)
      // config 본문은 목록에서 제외 (용량 절약)
      const list = snapshots.map(({ config, ...rest }) => rest)
      return { snapshots: list }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || '스냅샷 조회 실패' })
    }
  })

  // POST /api/config/snapshots — 수동 스냅샷 생성
  fastify.post('/snapshots', async (request, reply) => {
    try {
      const { label } = request.body as { label?: string }
      if (!label) {
        return reply.status(400).send({ error: '스냅샷 이름을 입력하세요' })
      }

      // 현재 설정 가져오기
      const cm = getConnectionManager()
      const configData = await cm.rpc('config.get')
      const currentConfig = configData?.config || configData || {}
      const hash = configData?.hash || configData?.baseHash || undefined

      const id = await createSnapshot(currentConfig, label, 'manual', hash)
      return { id, message: '스냅샷이 생성되었습니다' }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || '스냅샷 생성 실패' })
    }
  })

  // POST /api/config/snapshots/:id/restore — 스냅샷 복원
  fastify.post('/snapshots/:id/restore', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const snapshot = await getSnapshot(id)
      if (!snapshot) {
        return reply.status(404).send({ error: '스냅샷을 찾을 수 없습니다' })
      }

      // 복원 전 현재 설정 자동 스냅샷
      const cm = getConnectionManager()
      const currentData = await cm.rpc('config.get').catch(() => null)
      if (currentData) {
        const currentConfig = currentData?.config || currentData || {}
        await createSnapshot(currentConfig, `복원 전 자동 저장`, 'auto')
      }

      // 스냅샷 설정 적용
      await cm.rpc('config.set', { config: snapshot.config })
      await cm.rpc('config.apply')

      return { message: '설정이 복원되었습니다' }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || '복원 실패' })
    }
  })

  // GET /api/config/snapshots/:id/diff — 현재 설정과 비교
  fastify.get('/snapshots/:id/diff', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const snapshot = await getSnapshot(id)
      if (!snapshot) {
        return reply.status(404).send({ error: '스냅샷을 찾을 수 없습니다' })
      }

      const cm = getConnectionManager()
      const currentData = await cm.rpc('config.get')
      const currentConfig = currentData?.config || currentData || {}

      const diff = compareConfigs(snapshot.config, currentConfig)
      return { diff }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || '비교 실패' })
    }
  })

  // DELETE /api/config/snapshots/:id
  fastify.delete('/snapshots/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await deleteSnapshot(id)
      return { message: '스냅샷이 삭제되었습니다' }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || '삭제 실패' })
    }
  })
}

export default configRoutes
