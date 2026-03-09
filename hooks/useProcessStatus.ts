import { useState, useCallback, useRef, useEffect } from 'react'
import type { ProcessInfo, ProcessStatus } from '../server/services/process-manager.js'

interface ProcessStreamState {
  connected: boolean
  status: ProcessStatus
  pid: number | null
  uptime: number | null
  restartCount: number
  lastError?: string
  managerType: 'systemd' | 'direct' | null
  logs: string[]
  error: string | null
}

/**
 * useProcessStatus: 프로세스 상태/로그 실시간 스트림
 * /ws/process WebSocket 연결
 */
export function useProcessStatus() {
  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<ProcessStreamState>({
    connected: false,
    status: 'stopped',
    pid: null,
    uptime: null,
    restartCount: 0,
    managerType: null,
    logs: [],
    error: null,
  })

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/process`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setState((s) => ({ ...s, connected: true, error: null }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleEvent(data)
      } catch {
        // Ignore non-JSON messages
      }
    }

    ws.onclose = () => {
      setState((s) => ({ ...s, connected: false }))
      wsRef.current = null
    }

    ws.onerror = () => {
      setState((s) => ({ ...s, error: 'WebSocket 연결 실패' }))
    }

    wsRef.current = ws
  }, [])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setState((s) => ({ ...s, connected: false }))
  }, [])

  function handleEvent(event: any) {
    switch (event.type) {
      case 'status':
        // 초기 상태 동기화
        setState((s) => ({
          ...s,
          status: event.status || s.status,
          pid: event.pid ?? s.pid,
          uptime: event.uptime ?? s.uptime,
          restartCount: event.restartCount ?? s.restartCount,
          lastError: event.lastError,
          managerType: event.managerType || s.managerType,
        }))
        break

      case 'status-change':
        setState((s) => ({
          ...s,
          status: event.status,
        }))
        break

      case 'log':
        setState((s) => ({
          ...s,
          logs: [...s.logs, event.message || ''],
        }))
        break

      case 'error':
        setState((s) => ({
          ...s,
          error: event.message || '알 수 없는 오류',
          lastError: event.message,
        }))
        break

      case 'restart':
        setState((s) => ({
          ...s,
          restartCount: s.restartCount + 1,
        }))
        break
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  return {
    ...state,
    connect,
    disconnect,
  }
}
