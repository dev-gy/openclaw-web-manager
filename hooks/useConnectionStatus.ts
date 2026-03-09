import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from './useWebSocket'

// ─── 타입 ───

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

export interface GatewayInfo {
  version?: string
  uptime?: number
  channels?: string[]
  sessionsActive?: number
}

export interface ConnectionStatus {
  state: ConnectionState
  config: { type: string; url: string; token: string } | null
  gatewayInfo: GatewayInfo | null
  connectedAt: number | null
  reconnectAttempt: number
  maxReconnectAttempts: number
  lastError: string | null
}

interface UseConnectionStatusReturn {
  // 상태
  status: ConnectionStatus
  isConnected: boolean
  isLoading: boolean

  // 액션
  connect: (url: string, token: string) => Promise<boolean>
  disconnect: () => Promise<void>
  reconnect: () => Promise<boolean>
  detect: () => Promise<DiscoveryResult>
  testConnection: (url: string, token: string) => Promise<TestResult>

  // 실시간 구독 상태
  wsConnected: boolean
}

export interface DiscoveryResult {
  found: boolean
  source: string | null
  url: string | null
  token: string | null
  info: GatewayInfo | null
  candidates: Array<{
    url: string
    source: string
    reachable: boolean
    needsToken: boolean
    info?: GatewayInfo
    error?: string
  }>
  duration: number
}

interface TestResult {
  success: boolean
  info?: any
  error?: string
}

// ─── 기본 상태 ───

const DEFAULT_STATUS: ConnectionStatus = {
  state: 'disconnected',
  config: null,
  gatewayInfo: null,
  connectedAt: null,
  reconnectAttempt: 0,
  maxReconnectAttempts: 10,
  lastError: null,
}

/**
 * useConnectionStatus: Gateway 연결 상태 관리 훅
 *
 * - /api/connection REST API로 연결/해제/테스트
 * - /ws/events WebSocket으로 실시간 상태 변화 수신
 * - 대시보드, 헤더, 연결 마법사에서 사용
 */
export function useConnectionStatus(): UseConnectionStatusReturn {
  const [status, setStatus] = useState<ConnectionStatus>(DEFAULT_STATUS)
  const [isLoading, setIsLoading] = useState(true)
  const initialFetchDone = useRef(false)

  // ─ WebSocket 실시간 구독 ─
  const { connected: wsConnected, send } = useWebSocket({
    url: '/ws/events',
    onMessage: (data) => {
      if (data.channel === 'connection') {
        if (data.type === 'state-change') {
          setStatus((prev) => ({
            ...prev,
            state: data.state,
            lastError: data.error || prev.lastError,
            reconnectAttempt: data.reconnectAttempt ?? prev.reconnectAttempt,
            connectedAt: data.state === 'connected' ? Date.now() : prev.connectedAt,
          }))
        }
        if (data.type === 'gateway-info' && data.gatewayInfo) {
          setStatus((prev) => ({
            ...prev,
            gatewayInfo: data.gatewayInfo,
          }))
        }
      }
    },
    autoConnect: true,
  })

  // WebSocket 연결 시 connection 채널 구독
  useEffect(() => {
    if (wsConnected) {
      send({ type: 'subscribe', channel: 'connection' })
    }
  }, [wsConnected, send])

  // ─ 초기 상태 로드 ─
  useEffect(() => {
    if (initialFetchDone.current) return
    initialFetchDone.current = true

    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/connection')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (err) {
      setStatus(prev => ({
        ...prev,
        lastError: err instanceof Error ? err.message : '네트워크 오류'
      }))
    } finally {
      setIsLoading(false)
    }
  }

  // ─ 액션 ─

  const connect = useCallback(async (url: string, token: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token }),
      })
      const data = await res.json()
      if (data.success && data.status) {
        setStatus(data.status)
      }
      return data.success || false
    } catch {
      return false
    }
  }, [])

  const disconnect = useCallback(async () => {
    try {
      await fetch('/api/connection', { method: 'DELETE' })
      setStatus((prev) => ({
        ...prev,
        state: 'disconnected',
        gatewayInfo: null,
        connectedAt: null,
      }))
    } catch {
      // 에러 무시
    }
  }, [])

  const reconnect = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/connection/reconnect', { method: 'POST' })
      const data = await res.json()
      if (data.success && data.status) {
        setStatus(data.status)
      }
      return data.success || false
    } catch {
      return false
    }
  }, [])

  const detect = useCallback(async (): Promise<DiscoveryResult> => {
    const res = await fetch('/api/connection/detect', { method: 'POST' })
    return res.json()
  }, [])

  const testConnection = useCallback(async (url: string, token: string): Promise<TestResult> => {
    try {
      const res = await fetch('/api/connection/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token }),
      })
      return res.json()
    } catch {
      return { success: false, error: '네트워크 오류' }
    }
  }, [])

  return {
    status,
    isConnected: status.state === 'connected',
    isLoading,
    connect,
    disconnect,
    reconnect,
    detect,
    testConnection,
    wsConnected,
  }
}
