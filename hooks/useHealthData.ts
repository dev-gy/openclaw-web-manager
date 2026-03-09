import { useState, useEffect } from 'react'
import { useWebSocket } from './useWebSocket'

// ─── 타입 ───

export interface HealthData {
  uptime?: number
  version?: string
  memoryUsage?: {
    rss: number
    heapUsed: number
    heapTotal: number
  }
  cpuUsage?: number
  disk?: {
    total: number
    used: number
    free: number
  }
}

export interface SessionSummary {
  active: number
  today: number
}

export interface ChannelStatus {
  name: string
  connected: boolean
  error?: string
}

export interface DashboardData {
  health: HealthData | null
  sessions: SessionSummary
  channels: ChannelStatus[]
  events: DashboardEvent[]
  connected: boolean
  lastUpdate: number | null
}

export interface DashboardEvent {
  type: string
  message: string
  level: 'info' | 'warning' | 'error'
  timestamp: number
}

// ─── 기본값 ───

const DEFAULT_DATA: DashboardData = {
  health: null,
  sessions: { active: 0, today: 0 },
  channels: [],
  events: [],
  connected: false,
  lastUpdate: null,
}

const MAX_EVENTS = 50

/**
 * useHealthData: 대시보드 실시간 데이터 훅
 *
 * /ws/events의 health 채널을 구독하여 5초 간격으로 health 데이터를 수신.
 * 초기 로딩은 REST API로 fallback.
 */
export function useHealthData() {
  const [data, setData] = useState<DashboardData>(DEFAULT_DATA)
  const [loading, setLoading] = useState(true)

  // ─ WebSocket 실시간 구독 ─
  const { connected: wsConnected, send } = useWebSocket({
    url: '/ws/events',
    onMessage: (msg) => {
      if (msg.channel === 'health') {
        setData((prev) => ({
          ...prev,
          health: msg.data || prev.health,
          connected: msg.connected ?? prev.connected,
          lastUpdate: Date.now(),
        }))
      }

      if (msg.channel === 'connection') {
        if (msg.type === 'state-change') {
          setData((prev) => ({
            ...prev,
            connected: msg.state === 'connected',
          }))
        }
        if (msg.type === 'gateway-info' && msg.gatewayInfo) {
          setData((prev) => ({
            ...prev,
            health: {
              ...prev.health,
              version: msg.gatewayInfo.version,
              uptime: msg.gatewayInfo.uptime,
            },
            sessions: {
              ...prev.sessions,
              active: msg.gatewayInfo.sessionsActive ?? prev.sessions.active,
            },
          }))
        }
      }

      // 이벤트 피드
      if (msg.channel === 'sessions' || msg.channel === 'connection') {
        const event = toEvent(msg)
        if (event) {
          setData((prev) => ({
            ...prev,
            events: [event, ...prev.events].slice(0, MAX_EVENTS),
          }))
        }
      }
    },
    autoConnect: true,
  })

  // 채널 구독
  useEffect(() => {
    if (wsConnected) {
      send({ type: 'subscribe', channel: 'health' })
      send({ type: 'subscribe', channel: 'connection' })
      send({ type: 'subscribe', channel: 'sessions' })
    }
  }, [wsConnected, send])

  // ─ 초기 REST 로드 ─
  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)

      // 연결 상태 확인
      const connRes = await fetch('/api/connection')
      if (connRes.ok) {
        const connData = await connRes.json()
        const isConnected = connData.state === 'connected'

        setData((prev) => ({
          ...prev,
          connected: isConnected,
        }))

        // Gateway 연결 시 상세 정보 로드
        if (isConnected) {
          try {
            const infoRes = await fetch('/api/server/info')
            if (infoRes.ok) {
              const info = await infoRes.json()
              setData((prev) => ({
                ...prev,
                health: {
                  uptime: info.health?.uptime,
                  version: info.status?.version,
                  memoryUsage: info.health?.memoryUsage,
                  cpuUsage: info.health?.cpuUsage,
                  disk: info.health?.disk,
                },
                sessions: {
                  active: info.status?.sessionsActive ?? 0,
                  today: info.status?.sessionsToday ?? 0,
                },
                channels: (info.status?.channels || []).map((ch: any) => ({
                  name: typeof ch === 'string' ? ch : ch.name,
                  connected: typeof ch === 'string' ? true : ch.connected,
                })),
              }))
            }
          } catch {
            // Gateway 정보 로드 실패는 무시
          }
        }
      }
    } catch {
      // 네트워크 에러 무시
    } finally {
      setLoading(false)
    }
  }

  return { ...data, loading, wsConnected, refresh: fetchInitialData }
}

// ─── 이벤트 변환 ───

function toEvent(msg: any): DashboardEvent | null {
  if (msg.channel === 'connection' && msg.type === 'state-change') {
    const stateMessages: Record<string, { message: string; level: DashboardEvent['level'] }> = {
      connected: { message: 'Gateway에 연결되었습니다', level: 'info' },
      disconnected: { message: 'Gateway 연결이 해제되었습니다', level: 'warning' },
      reconnecting: { message: `Gateway 재연결 시도 중 (${msg.reconnectAttempt || 1})`, level: 'warning' },
      error: { message: `Gateway 연결 오류: ${msg.error || ''}`, level: 'error' },
    }

    const info = stateMessages[msg.state]
    if (!info) return null

    return {
      type: 'connection',
      message: info.message,
      level: info.level,
      timestamp: msg.timestamp || Date.now(),
    }
  }

  if (msg.channel === 'sessions') {
    return {
      type: 'session',
      message: msg.type === 'session.started' ? '새 세션 시작' : '세션 종료',
      level: 'info',
      timestamp: msg.timestamp || Date.now(),
    }
  }

  return null
}
