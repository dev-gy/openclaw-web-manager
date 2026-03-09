import React, { useState, useRef, useEffect } from 'react'
import { Card, Select, Badge, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { useLogs, type LogEntry, type LogLevel } from '../../../hooks/useLogs'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'

export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()
  const [level, setLevel] = useState<LogLevel>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const { logs, loading, paused, bufferedCount, wsConnected, pause, resume, clear } = useLogs({ level })

  // 에러 카운트 (컨텍스트 액션용)
  const errorCount = logs.filter((log) => log.level === 'error').length

  // 필터링된 로그
  const filteredLogs = searchQuery
    ? logs.filter((log) => log.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : logs

  // 자동 스크롤
  useEffect(() => {
    if (autoScroll && scrollRef.current && !paused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filteredLogs, autoScroll, paused])

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="block" lines={1} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="실시간 로그" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="실시간 로그"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="실시간 로그" variant="disconnected" />
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-text-primary">실시간 로그</h2>
          {wsConnected ? (
            <Badge variant="success" size="sm">연결됨</Badge>
          ) : (
            <Badge variant="error" size="sm">연결 끊김</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 검색 */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="로그 검색..."
            className="w-48 px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
          />

          {/* 레벨 필터 */}
          <Select
            value={level}
            onChange={(e) => setLevel(e.target.value as LogLevel)}
            options={[
              { value: 'all', label: '전체' },
              { value: 'error', label: 'Error' },
              { value: 'warn', label: 'Warn' },
              { value: 'info', label: 'Info' },
              { value: 'debug', label: 'Debug' },
            ]}
            className="w-28"
          />

          {/* 일시정지/재개 */}
          <button
            onClick={paused ? resume : pause}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              paused
                ? 'bg-warning/10 text-warning hover:bg-warning/20'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            {paused ? `재개 (${bufferedCount})` : '일시정지'}
          </button>

          {/* 자동 스크롤 */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              autoScroll
                ? 'bg-accent/10 text-accent'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            자동 스크롤: {autoScroll ? 'ON' : 'OFF'}
          </button>

          {/* 초기화 */}
          <button
            onClick={clear}
            className="px-3 py-1.5 bg-bg-secondary text-text-secondary hover:text-text-primary rounded-lg text-sm transition-colors"
          >
            지우기
          </button>
        </div>
      </div>

      {/* 에러 컨텍스트 액션 바 */}
      {errorCount > 0 && (
        <div className="mb-3 p-3 bg-error/5 border border-error/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-error text-sm font-medium">
              {errorCount}개 에러 감지
            </span>
            <span className="text-xs text-text-secondary">
              최근 {logs.length}줄 중
            </span>
          </div>
          <div className="flex gap-1.5">
            <a
              href="/config/channels"
              className="px-2.5 py-1 bg-bg-secondary hover:bg-border text-xs text-text-primary rounded-lg transition-colors"
            >
              📡 채널 확인
            </a>
            <a
              href="/server/connection"
              className="px-2.5 py-1 bg-bg-secondary hover:bg-border text-xs text-text-primary rounded-lg transition-colors"
            >
              🔌 연결 설정
            </a>
            <button
              onClick={() => { setLevel('error'); setSearchQuery('') }}
              className="px-2.5 py-1 bg-error/10 hover:bg-error/20 text-xs text-error rounded-lg transition-colors"
            >
              에러만 보기
            </button>
          </div>
        </div>
      )}

      {/* 로그 터미널 */}
      <Card className="flex-1 overflow-hidden bg-[#0d0d0d]">
        {/* 터미널 헤더 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs text-gray-500 font-mono">gateway.log</span>
          </div>
          <span className="text-xs text-gray-600">
            {filteredLogs.length}줄
            {searchQuery && ` (검색: "${searchQuery}")`}
          </span>
        </div>

        {/* 로그 내용 */}
        <div
          ref={scrollRef}
          className="p-4 overflow-auto font-mono text-xs leading-relaxed"
          style={{ maxHeight: 'calc(100vh - 240px)' }}
        >
          {loading && filteredLogs.length === 0 ? (
            <span className="text-gray-600">로그를 불러오는 중...</span>
          ) : filteredLogs.length === 0 ? (
            <span className="text-gray-600">
              {searchQuery ? '검색 결과가 없습니다' : '로그가 없습니다. Gateway 연결 후 로그가 표시됩니다.'}
            </span>
          ) : (
            filteredLogs.map((log, i) => (
              <LogLine key={`${log.timestamp}-${i}`} log={log} highlight={searchQuery} />
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

// ─── 로그 라인 ───

const levelColors: Record<string, string> = {
  debug: 'text-gray-500',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
}

const levelLabels: Record<string, string> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
}

function LogLine({ log, highlight }: { log: LogEntry; highlight: string }) {
  const time = new Date(log.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const color = levelColors[log.level] || 'text-gray-300'
  const label = levelLabels[log.level] || 'INF'

  return (
    <div className="flex gap-2 py-0.5 hover:bg-white/[0.02]">
      <span className="text-gray-600 flex-shrink-0">{time}</span>
      <span className={`flex-shrink-0 w-8 ${color} font-semibold`}>{label}</span>
      {log.source && (
        <span className="text-gray-500 flex-shrink-0">[{log.source}]</span>
      )}
      <span className={color}>
        {highlight ? highlightText(log.text, highlight) : log.text}
      </span>
    </div>
  )
}

// ─── 유틸 ───

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text

  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={i} className="bg-warning/30 text-white rounded px-0.5">
        {part}
      </span>
    ) : (
      part
    )
  )
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
