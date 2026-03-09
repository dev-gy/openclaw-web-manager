import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from './useWebSocket'

// ─── 타입 ───

/** 에이전트 활동 상태 */
export type AgentState = 'idle' | 'working' | 'speaking' | 'tool_calling' | 'error' | 'offline'

/** 활동 로그 엔트리 */
export interface ActivityLogEntry {
  id: string
  timestamp: number
  agentId: string
  agentName: string
  avatarSeed: number
  type: 'session.started' | 'session.updated' | 'session.ended'
  message: string
}

/** 에이전트 위치 (오피스 내) */
export type AgentLocation = 'desk' | 'bookshelf' | 'meeting' | 'lounge' | 'entrance'

/** 에이전트 활동 정보 */
export interface AgentActivity {
  id: string
  name: string
  platform: string
  state: AgentState
  location: AgentLocation
  /** 마지막 활동 메시지 */
  lastAction: string
  /** 메시지 수 (경험치) */
  messageCount: number
  /** 세션 시작 시간 */
  startedAt: number
  /** 마지막 활동 시간 */
  lastActivity: number
  /** 아바타 시드 (결정론적 색상 생성용) */
  avatarSeed: number
}

// ─── 상태 추론 ───

/** 세션 데이터에서 에이전트 상태 추론 */
function inferState(session: any): AgentState {
  if (!session) return 'offline'

  const now = Date.now()
  const lastActivity = session.lastActivity || session.updatedAt || now
  const idleMs = now - lastActivity

  // 5분 이상 비활성 → idle
  if (idleMs > 5 * 60 * 1000) return 'idle'
  // 최근 활동 → working
  return 'working'
}

/** 상태에 따른 위치 결정 */
function inferLocation(state: AgentState, platform: string): AgentLocation {
  switch (state) {
    case 'working': return 'desk'
    case 'speaking': return 'meeting'
    case 'tool_calling': return 'bookshelf'
    case 'idle': return 'lounge'
    case 'error': return 'entrance'
    default: return 'entrance'
  }
}

/** 문자열에서 결정론적 해시 (아바타 시드) */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/** 세션 → 에이전트 활동 변환 */
function sessionToAgent(session: any): AgentActivity {
  const state = inferState(session)
  const platform = session.platform || 'unknown'
  const id = session.id || session.sessionId || ''
  const name = session.userName || session.user?.name || `Agent-${id.slice(0, 6)}`

  return {
    id,
    name,
    platform,
    state,
    location: inferLocation(state, platform),
    lastAction: getLastActionText(state, platform),
    messageCount: session.messageCount || 0,
    startedAt: session.startedAt || session.createdAt || Date.now(),
    lastActivity: session.lastActivity || session.updatedAt || Date.now(),
    avatarSeed: hashString(id),
  }
}

function getLastActionText(state: AgentState, platform: string): string {
  switch (state) {
    case 'working': return `${platform}에서 작업 중`
    case 'speaking': return '대화 중'
    case 'tool_calling': return '도구 실행 중'
    case 'idle': return '대기 중'
    case 'error': return '오류 발생'
    default: return '오프라인'
  }
}

// ─── 훅 ───

/**
 * useAgentActivity: 에이전트 활동 모니터링 훅
 *
 * 세션 데이터를 기반으로 에이전트의 상태, 위치, 활동을 추적.
 * WebSocket으로 실시간 업데이트 수신.
 */
export function useAgentActivity() {
  const [agents, setAgents] = useState<AgentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const updateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // WebSocket 실시간 세션 이벤트 수신
  const { connected: wsConnected, send } = useWebSocket({
    url: '/ws/events',
    onMessage: (msg) => {
      if (msg.channel !== 'sessions') return

      if (msg.type === 'session.started' && msg.session) {
        const agent = sessionToAgent(msg.session)
        setAgents((prev) => {
          const exists = prev.find((a) => a.id === agent.id)
          if (exists) return prev
          return [agent, ...prev]
        })
        setActivityLogs((prev) => {
          const entry: ActivityLogEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            timestamp: Date.now(),
            agentId: agent.id,
            agentName: agent.name,
            avatarSeed: agent.avatarSeed,
            type: 'session.started',
            message: '세션 시작',
          }
          const next = [entry, ...prev]
          return next.length > 50 ? next.slice(0, 50) : next
        })
      }

      if (msg.type === 'session.ended') {
        // 에이전트 이름을 배열 제거 전에 캡처
        let endedAgentName = msg.sessionId?.slice(0, 6) || 'unknown'
        let endedAvatarSeed = hashString(msg.sessionId || '')
        setAgents((prev) => {
          const found = prev.find((a) => a.id === msg.sessionId)
          if (found) {
            endedAgentName = found.name
            endedAvatarSeed = found.avatarSeed
          }
          return prev.filter((a) => a.id !== msg.sessionId)
        })
        setActivityLogs((prev) => {
          const entry: ActivityLogEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            timestamp: Date.now(),
            agentId: msg.sessionId,
            agentName: endedAgentName,
            avatarSeed: endedAvatarSeed,
            type: 'session.ended',
            message: '세션 종료',
          }
          const next = [entry, ...prev]
          return next.length > 50 ? next.slice(0, 50) : next
        })
      }

      if (msg.type === 'session.updated' && msg.session) {
        const agent = sessionToAgent(msg.session)
        setAgents((prev) =>
          prev.map((a) => (a.id === agent.id ? agent : a))
        )
        setActivityLogs((prev) => {
          const entry: ActivityLogEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            timestamp: Date.now(),
            agentId: agent.id,
            agentName: agent.name,
            avatarSeed: agent.avatarSeed,
            type: 'session.updated',
            message: agent.lastAction,
          }
          const next = [entry, ...prev]
          return next.length > 50 ? next.slice(0, 50) : next
        })
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

  // 초기 로드
  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/server/sessions')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const sessions = data.sessions || []
      setAgents(sessions.map(sessionToAgent))
    } catch (err: any) {
      setError(err.message || '에이전트 정보 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  // 10초 간격으로 상태 재평가 (idle 판단 갱신)
  useEffect(() => {
    updateTimerRef.current = setInterval(() => {
      setAgents((prev) =>
        prev.map((agent) => {
          const newState = inferState({
            lastActivity: agent.lastActivity,
          })
          if (newState !== agent.state) {
            return {
              ...agent,
              state: newState,
              location: inferLocation(newState, agent.platform),
              lastAction: getLastActionText(newState, agent.platform),
            }
          }
          return agent
        })
      )
    }, 10000)

    return () => {
      if (updateTimerRef.current) clearInterval(updateTimerRef.current)
    }
  }, [])

  return {
    agents,
    loading,
    error,
    wsConnected,
    refresh: fetchAgents,
    totalSessions: agents.length,
    activeSessions: agents.filter((a) => a.state === 'working' || a.state === 'speaking' || a.state === 'tool_calling').length,
    activityLogs,
  }
}
