import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from './useWebSocket'

// ─── 타입 ───

export interface LogEntry {
  text: string
  level: 'debug' | 'info' | 'warn' | 'error'
  timestamp: number
  source?: string
}

export type LogLevel = 'all' | 'debug' | 'info' | 'warn' | 'error'

// ─── 훅 ───

const MAX_LOG_LINES = 2000

/**
 * useLogs: 실시간 로그 스트리밍 훅
 *
 * /ws/events의 logs 채널을 구독하여 실시간 로그를 수신.
 * 초기 로그는 REST API에서 로드.
 */
export function useLogs(options?: { level?: LogLevel; autoScroll?: boolean }) {
  const level = options?.level ?? 'all'
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const bufferRef = useRef<LogEntry[]>([])

  // WebSocket 실시간 로그 수신
  const { connected: wsConnected, send } = useWebSocket({
    url: '/ws/events',
    onMessage: (msg) => {
      if (msg.channel === 'logs' && msg.type === 'log') {
        const entry = normalizeLog(msg)
        if (entry && matchesLevel(entry.level, level)) {
          if (paused) {
            // 일시정지 상태면 버퍼에만 추가
            bufferRef.current.push(entry)
          } else {
            setLogs((prev) => [...prev, entry].slice(-MAX_LOG_LINES))
          }
        }
      }
    },
    autoConnect: true,
  })

  // 로그 채널 구독
  useEffect(() => {
    if (wsConnected) {
      send({ type: 'subscribe', channel: 'logs' })
    }
  }, [wsConnected, send])

  // 초기 로그 REST 로드
  const fetchInitialLogs = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ lines: '200' })
      if (level !== 'all') params.set('level', level)

      const res = await fetch(`/api/server/logs/recent?${params}`)
      if (res.ok) {
        const data = await res.json()
        const entries = (data.logs || []).map(normalizeLog).filter(Boolean) as LogEntry[]
        setLogs(entries)
      }
    } catch {
      // 초기 로그 로드 실패 무시 (WebSocket으로 수신)
    } finally {
      setLoading(false)
    }
  }, [level])

  useEffect(() => {
    fetchInitialLogs()
  }, [fetchInitialLogs])

  // 일시정지 해제 시 버퍼 플러시
  const resume = useCallback(() => {
    setPaused(false)
    if (bufferRef.current.length > 0) {
      setLogs((prev) => [...prev, ...bufferRef.current].slice(-MAX_LOG_LINES))
      bufferRef.current = []
    }
  }, [])

  // 로그 초기화
  const clear = useCallback(() => {
    setLogs([])
    bufferRef.current = []
  }, [])

  // 일시정지
  const pause = useCallback(() => {
    setPaused(true)
  }, [])

  return {
    logs,
    loading,
    paused,
    bufferedCount: bufferRef.current.length,
    wsConnected,
    pause,
    resume,
    clear,
    refresh: fetchInitialLogs,
  }
}

// ─── 유틸 ───

function normalizeLog(raw: any): LogEntry | null {
  if (!raw) return null

  // 문자열이면 바로 변환
  if (typeof raw === 'string') {
    return { text: raw, level: 'info', timestamp: Date.now() }
  }

  return {
    text: raw.text || raw.message || raw.msg || String(raw),
    level: normalizeLevel(raw.level || raw.type || 'info'),
    timestamp: raw.timestamp || Date.now(),
    source: raw.source || raw.module,
  }
}

function normalizeLevel(level: string): LogEntry['level'] {
  const map: Record<string, LogEntry['level']> = {
    debug: 'debug',
    info: 'info',
    warn: 'warn',
    warning: 'warn',
    error: 'error',
    fatal: 'error',
    stderr: 'error',
    stdout: 'info',
  }
  return map[level.toLowerCase()] || 'info'
}

function matchesLevel(entryLevel: string, filterLevel: LogLevel): boolean {
  if (filterLevel === 'all') return true

  const severity: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }

  return (severity[entryLevel] ?? 0) >= (severity[filterLevel] ?? 0)
}
