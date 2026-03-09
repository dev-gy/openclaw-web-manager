import { useState, useEffect, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'

// ─── 타입 ───

export interface Session {
  id: string
  platform: string
  channel: string
  userId?: string
  userName?: string
  startedAt: number
  lastActivity: number
  messageCount: number
  metadata?: Record<string, unknown>
}

export interface SessionDetail extends Session {
  messages?: SessionMessage[]
  context?: Record<string, unknown>
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

// ─── 훅 ───

/**
 * useSessions: 세션 관리 훅
 *
 * REST API로 세션 목록/상세 조회, WebSocket으로 실시간 업데이트 수신.
 */
export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // WebSocket 실시간 세션 이벤트 수신
  const { connected: wsConnected, send } = useWebSocket({
    url: '/ws/events',
    onMessage: (msg) => {
      if (msg.channel === 'sessions') {
        if (msg.type === 'session.started') {
          // 새 세션 추가
          if (msg.session) {
            setSessions((prev) => [normalizeSession(msg.session), ...prev])
          } else {
            // 상세 정보 없으면 전체 새로고침
            fetchSessions()
          }
        }
        if (msg.type === 'session.ended') {
          // 세션 제거
          setSessions((prev) => prev.filter((s) => s.id !== msg.sessionId))
        }
        if (msg.type === 'session.updated') {
          // 세션 업데이트
          if (msg.session) {
            setSessions((prev) =>
              prev.map((s) => (s.id === msg.session.id ? normalizeSession(msg.session) : s))
            )
          }
        }
      }
    },
    autoConnect: true,
  })

  // 세션 채널 구독
  useEffect(() => {
    if (wsConnected) {
      send({ type: 'subscribe', channel: 'sessions' })
    }
  }, [wsConnected, send])

  // REST API 세션 목록 조회
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/server/sessions')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setSessions((data.sessions || []).map(normalizeSession))
    } catch (err: any) {
      setError(err.message || '세션 목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  // 세션 상세 조회
  const getSession = useCallback(async (id: string): Promise<SessionDetail | null> => {
    try {
      const res = await fetch(`/api/server/sessions/${encodeURIComponent(id)}`)
      if (!res.ok) return null
      const data = await res.json()
      return data.session ? normalizeSession(data.session) as SessionDetail : null
    } catch {
      return null
    }
  }, [])

  // 세션 종료
  const killSession = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/server/sessions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id))
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  // 초기 로드
  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  return {
    sessions,
    loading,
    error,
    refresh: fetchSessions,
    getSession,
    killSession,
  }
}

// ─── 유틸 ───

function normalizeSession(raw: any): Session {
  return {
    id: raw.id || raw.sessionId || '',
    platform: raw.platform || raw.channel?.split('/')[0] || 'unknown',
    channel: raw.channel || raw.channelName || '',
    userId: raw.userId || raw.user?.id,
    userName: raw.userName || raw.user?.name,
    startedAt: raw.startedAt || raw.createdAt || Date.now(),
    lastActivity: raw.lastActivity || raw.updatedAt || Date.now(),
    messageCount: raw.messageCount || raw.messages?.length || 0,
    metadata: raw.metadata,
  }
}
