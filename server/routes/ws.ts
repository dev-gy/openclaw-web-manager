import type { FastifyPluginAsync } from 'fastify'
import { getConnectionManager, type ConnectionEvent } from '../services/connection-manager.js'
import { LocalInstaller, type LocalInstallEvent } from '../services/local-installer.js'
import { getProcessManager } from '../services/process-manager-factory.js'
import type { ProcessEvent } from '../services/process-manager.js'
import { getConfigWatcher } from '../services/config-watcher.js'

const wsRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── ws://host/ws/events — 통합 이벤트 구독 시스템 ───
  //
  // 클라이언트 → 서버:
  //   { type: 'subscribe', channel: 'connection' | 'health' | 'sessions' | 'logs' | 'process' }
  //   { type: 'unsubscribe', channel: '...' }
  //
  // 서버 → 클라이언트:
  //   { channel: '...', ...eventData }
  //
  fastify.get('/ws/events', { websocket: true }, (socket, req) => {
    const subscriptions = new Set<string>()
    const handlers = new Map<string, (...args: any[]) => void>()

    // ─ 연결 상태 구독 ─
    const setupConnectionSub = () => {
      const cm = getConnectionManager()
      const handler = (event: ConnectionEvent) => {
        _send({ channel: 'connection', ...event })
      }
      cm.on('event', handler)
      handlers.set('connection', handler)

      // 구독 시 현재 상태 즉시 전송
      _send({
        channel: 'connection',
        type: 'state-change',
        state: cm.getStatus().state,
        gatewayInfo: cm.getGatewayInfo(),
        timestamp: Date.now(),
      })
    }

    // ─ 프로세스 상태 구독 ─
    const setupProcessSub = async () => {
      try {
        const pm = await getProcessManager()
        const handler = (event: ProcessEvent) => {
          _send({ channel: 'process', ...event })
        }
        pm.on('event', handler)
        handlers.set('process', handler)

        // 현재 상태 즉시 전송
        const status = await pm.getStatus()
        _send({
          channel: 'process',
          type: 'status',
          ...status,
          timestamp: Date.now(),
        })
      } catch (err: any) {
        _send({
          channel: 'process',
          type: 'error',
          message: `ProcessManager 초기화 실패: ${err.message}`,
          timestamp: Date.now(),
        })
      }
    }

    // ─ 설치 진행 구독 ─
    const setupInstallSub = () => {
      const installer = LocalInstaller.getInstance()
      const handler = (event: LocalInstallEvent) => {
        _send({ channel: 'install', ...event })
      }
      installer.on('event', handler)
      handlers.set('install', handler)

      // 현재 상태 즉시 전송
      const status = installer.getStatus()
      _send({
        channel: 'install',
        type: 'status',
        ...status,
        timestamp: Date.now(),
      })
    }

    // ─ health 폴링 구독 (5초 간격) ─
    let healthInterval: ReturnType<typeof setInterval> | null = null
    const setupHealthSub = () => {
      const pollHealth = async () => {
        const cm = getConnectionManager()
        if (!cm.isConnected()) {
          _send({
            channel: 'health',
            type: 'health',
            data: null,
            connected: false,
            timestamp: Date.now(),
          })
          return
        }
        try {
          const health = await cm.rpc('health')
          _send({
            channel: 'health',
            type: 'health',
            data: health,
            connected: true,
            timestamp: Date.now(),
          })
        } catch {
          _send({
            channel: 'health',
            type: 'health',
            data: null,
            connected: false,
            error: 'health RPC 실패',
            timestamp: Date.now(),
          })
        }
      }

      // 즉시 1회 + 5초 간격
      pollHealth()
      healthInterval = setInterval(pollHealth, 5000)
    }

    // ─ 세션 이벤트 구독 ─
    const setupSessionsSub = () => {
      // Gateway의 세션 이벤트를 릴레이
      const cm = getConnectionManager()
      const handler = (event: any) => {
        if (event.type?.startsWith('session.')) {
          _send({ channel: 'sessions', ...event })
        }
      }
      cm.on('gateway-event', handler)
      handlers.set('sessions', handler)
    }

    // ─ 로그 스트리밍 구독 ─
    const setupLogsSub = async () => {
      // Gateway의 logs.tail을 구독
      const cm = getConnectionManager()
      if (cm.isConnected()) {
        try {
          await cm.rpc('logs.subscribe')
        } catch {
          // logs.subscribe RPC가 없으면 무시
        }
      }

      const handler = (event: any) => {
        if (event.type === 'log') {
          _send({ channel: 'logs', ...event })
        }
      }
      cm.on('gateway-event', handler)
      handlers.set('logs', handler)
    }

    // ─ 설정 변경 감지 구독 ─
    const setupConfigChangeSub = () => {
      const watcher = getConfigWatcher()
      const handler = (event: any) => {
        _send({ channel: 'config-change', ...event })
      }
      watcher.on('config-changed', handler)
      handlers.set('config-change', handler)

      // 감시 시작 (이미 실행 중이면 무시됨)
      watcher.start()
    }

    // ─ 메시지 수신 처리 ─
    socket.on('message', async (message: any) => {
      try {
        const data = JSON.parse(message.toString())

        if (data.type === 'subscribe' && data.channel) {
          if (subscriptions.has(data.channel)) return
          subscriptions.add(data.channel)

          switch (data.channel) {
            case 'connection':
              setupConnectionSub()
              break
            case 'process':
              await setupProcessSub()
              break
            case 'install':
              setupInstallSub()
              break
            case 'health':
              setupHealthSub()
              break
            case 'sessions':
              setupSessionsSub()
              break
            case 'logs':
              await setupLogsSub()
              break
            case 'config-change':
              setupConfigChangeSub()
              break
            default:
              _send({ channel: data.channel, type: 'error', message: `알 수 없는 채널: ${data.channel}` })
          }
        }

        if (data.type === 'unsubscribe' && data.channel) {
          _teardownChannel(data.channel)
          subscriptions.delete(data.channel)
        }

        // RPC 프록시 (기존 /ws/gateway 호환)
        if (data.method) {
          try {
            const cm = getConnectionManager()
            const result = await cm.rpc(data.method, data.params)
            _send({ id: data.id, result })
          } catch (err: any) {
            _send({ id: data.id, error: err.message || 'RPC 실패' })
          }
        }
      } catch {
        // 파싱 실패 무시
      }
    })

    // ─ 정리 ─
    const cleanup = () => {
      // 모든 채널 핸들러 해제
      for (const channel of subscriptions) {
        _teardownChannel(channel)
      }
      subscriptions.clear()

      if (healthInterval) {
        clearInterval(healthInterval)
        healthInterval = null
      }

      fastify.log.debug('WS client disconnected from /ws/events')
    }

    socket.on('close', cleanup)
    socket.on('error', cleanup)

    // ─ 헬퍼 ─
    function _send(data: any) {
      try {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(data))
        }
      } catch {
        // 전송 실패 무시
      }
    }

    function _teardownChannel(channel: string) {
      const handler = handlers.get(channel)
      if (!handler) return

      switch (channel) {
        case 'connection':
          getConnectionManager().removeListener('event', handler)
          break
        case 'process':
          getProcessManager()
            .then((pm) => pm.removeListener('event', handler))
            .catch(() => {})
          break
        case 'install':
          LocalInstaller.getInstance().removeListener('event', handler)
          break
        case 'sessions':
        case 'logs':
          getConnectionManager().removeListener('gateway-event', handler)
          break
        case 'config-change':
          getConfigWatcher().removeListener('config-changed', handler)
          break
        case 'health':
          if (healthInterval) {
            clearInterval(healthInterval)
            healthInterval = null
          }
          break
      }

      handlers.delete(channel)
    }
  })

  // ─── 하위 호환 엔드포인트 (레거시) ───

  // ws://host/ws/gateway — Gateway RPC 프록시
  fastify.get('/ws/gateway', { websocket: true }, (socket, req) => {
    const cm = getConnectionManager()

    if (!cm.isConnected()) {
      socket.send(JSON.stringify({ error: 'Gateway에 연결되어 있지 않습니다' }))
      socket.close()
      return
    }

    socket.on('message', async (message: any) => {
      try {
        const data = JSON.parse(message.toString())
        const result = await cm.rpc(data.method, data.params)
        socket.send(JSON.stringify({ id: data.id, result }))
      } catch (err: any) {
        socket.send(
          JSON.stringify({ id: null, error: err.message || 'RPC 실패' })
        )
      }
    })

    socket.on('close', () => {
      fastify.log.debug('WS client disconnected from /ws/gateway')
    })
  })

  // ws://host/ws/install — 설치 진행 실시간 스트림 (레거시)
  fastify.get('/ws/install', { websocket: true }, (socket, req) => {
    const installer = LocalInstaller.getInstance()

    const status = installer.getStatus()
    socket.send(JSON.stringify({
      type: 'status',
      ...status,
      timestamp: Date.now(),
    }))

    const handler = (event: LocalInstallEvent) => {
      try {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(event))
        }
      } catch {
        // 전송 실패 무시
      }
    }

    installer.on('event', handler)

    socket.on('close', () => {
      installer.removeListener('event', handler)
      fastify.log.debug('WS client disconnected from /ws/install')
    })

    socket.on('error', () => {
      installer.removeListener('event', handler)
    })
  })

  // ws://host/ws/process — 프로세스 상태/로그 스트림 (레거시)
  fastify.get('/ws/process', { websocket: true }, async (socket, req) => {
    try {
      const pm = await getProcessManager()

      const status = await pm.getStatus()
      socket.send(JSON.stringify({
        type: 'status',
        ...status,
        timestamp: Date.now(),
      }))

      const handler = (event: ProcessEvent) => {
        try {
          if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify(event))
          }
        } catch {
          // 전송 실패 무시
        }
      }

      pm.on('event', handler)

      socket.on('close', () => {
        pm.removeListener('event', handler)
        fastify.log.debug('WS client disconnected from /ws/process')
      })

      socket.on('error', () => {
        pm.removeListener('event', handler)
      })
    } catch (err: any) {
      socket.send(JSON.stringify({
        type: 'error',
        message: `ProcessManager 초기화 실패: ${err.message}`,
        timestamp: Date.now(),
      }))
      socket.close()
    }
  })
}

export default wsRoutes
