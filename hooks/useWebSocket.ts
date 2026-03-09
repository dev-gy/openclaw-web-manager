import { useEffect, useRef, useState, useCallback } from 'react'

interface UseWebSocketOptions {
  url: string
  onMessage?: (data: any) => void
  autoConnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function useWebSocket({
  url,
  onMessage,
  autoConnect = true,
  reconnectInterval = 5000,
  maxReconnectAttempts = 10,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)
  const reconnectCountRef = useRef(0)
  const unmountedRef = useRef(false)

  // onMessage를 ref로 관리하여 connect 의존성에서 제외
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}${url}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setConnected(true)
      setError(null)
      reconnectCountRef.current = 0 // 성공 시 카운터 리셋
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current?.(data)
      } catch {
        onMessageRef.current?.(event.data)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null

      // Auto-reconnect (최대 횟수 제한, 컴포넌트 언마운트 시 중단)
      if (unmountedRef.current) return
      if (reconnectInterval > 0 && reconnectCountRef.current < maxReconnectAttempts) {
        reconnectCountRef.current++
        const backoff = Math.min(reconnectInterval * Math.pow(1.5, reconnectCountRef.current - 1), 30000)
        reconnectTimerRef.current = setTimeout(connect, backoff)
      }
    }

    ws.onerror = () => {
      setError('WebSocket connection failed')
    }

    wsRef.current = ws
  }, [url, reconnectInterval, maxReconnectAttempts])

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    wsRef.current?.close()
    wsRef.current = null
    setConnected(false)
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    if (autoConnect) connect()
    return () => {
      unmountedRef.current = true
      disconnect()
    }
  }, [autoConnect]) // eslint-disable-line react-hooks/exhaustive-deps

  return { connected, error, send, connect, disconnect }
}
