import { useState, useCallback, useRef, useEffect } from 'react'
import type { LocalInstallStep } from '../server/services/local-installer.js'
import type { EnvironmentInfo } from '../server/services/env-detect.js'

export interface InstallLogEntry {
  message: string
  isStderr: boolean
  step: LocalInstallStep
  timestamp: number
}

interface InstallStreamState {
  connected: boolean
  step: LocalInstallStep
  logs: InstallLogEntry[]
  envInfo: EnvironmentInfo | null
  error: string | null
  serverId: string | null
  isComplete: boolean
  isFailed: boolean
}

export function useInstallStream() {
  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<InstallStreamState>({
    connected: false,
    step: 'idle',
    logs: [],
    envInfo: null,
    error: null,
    serverId: null,
    isComplete: false,
    isFailed: false,
  })

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/install`
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

  const reset = useCallback(() => {
    setState({
      connected: wsRef.current?.readyState === WebSocket.OPEN,
      step: 'idle',
      logs: [],
      envInfo: null,
      error: null,
      serverId: null,
      isComplete: false,
      isFailed: false,
    })
  }, [])

  function handleEvent(event: any) {
    switch (event.type) {
      case 'status':
        // 초기 상태 동기화
        setState((s) => ({
          ...s,
          step: event.step || 'idle',
          envInfo: event.envInfo || s.envInfo,
          serverId: event.serverId || s.serverId,
          isComplete: event.step === 'complete',
          isFailed: event.step === 'failed',
        }))
        break

      case 'step':
        setState((s) => ({
          ...s,
          step: event.step,
          isComplete: event.step === 'complete',
          isFailed: event.step === 'failed',
        }))
        break

      case 'log':
        setState((s) => ({
          ...s,
          logs: [
            ...s.logs,
            {
              message: event.message || '',
              isStderr: event.isStderr || false,
              step: event.step || s.step,
              timestamp: event.timestamp || Date.now(),
            },
          ],
        }))
        break

      case 'env_info':
        setState((s) => ({
          ...s,
          envInfo: event.data,
        }))
        break

      case 'complete':
        setState((s) => ({
          ...s,
          step: 'complete',
          isComplete: true,
          serverId: event.data?.serverId || s.serverId,
        }))
        break

      case 'error':
        setState((s) => ({
          ...s,
          step: 'failed',
          isFailed: true,
          error: event.message || '알 수 없는 오류',
        }))
        break
    }
  }

  // NOTE: WS lifecycle는 caller가 disconnect()로 관리.
  // useEffect cleanup에서 자동 close하면 React 18 dev mode
  // double-invocation 시 WS가 예기치 않게 닫힘.

  return {
    ...state,
    connect,
    disconnect,
    reset,
  }
}
