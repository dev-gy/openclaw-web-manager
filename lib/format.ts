/**
 * 공유 포맷 유틸리티
 *
 * 여러 페이지에서 중복 사용하던 formatUptime, formatTime 등을 통합.
 */

/** 초 단위 가동 시간을 사람이 읽을 수 있는 한국어 문자열로 변환 */
export function formatUptime(seconds?: number): string {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}초`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}시간 ${Math.floor((seconds % 3600) / 60)}분`
  return `${Math.floor(seconds / 86400)}일 ${Math.floor((seconds % 86400) / 3600)}시간`
}

/** 타임스탬프를 HH:MM:SS 형식으로 변환 */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** 메모리 + CPU 상태 문자열 */
export function formatResourceDetail(
  health?: {
    memoryUsage?: { rss: number; heapUsed: number; heapTotal: number }
    cpuUsage?: number
  } | null
): string {
  if (!health?.memoryUsage) return '—'
  const memMB = Math.round(health.memoryUsage.rss / 1024 / 1024)
  return `RAM ${memMB}MB${health.cpuUsage !== undefined ? ` · CPU ${Math.round(health.cpuUsage)}%` : ''}`
}

/** 메모리 사용률 기반 상태 판단 */
export function getResourceStatus(
  mem?: { rss: number; heapUsed: number; heapTotal: number }
): 'connected' | 'warning' | 'unknown' {
  if (!mem) return 'unknown'
  const usage = mem.heapUsed / mem.heapTotal
  if (usage > 0.85) return 'warning'
  return 'connected'
}

/** 상대 시간 표시 (예: "3분 전"). string(ISO 날짜) 또는 number(타임스탬프 ms) 입력 가능 */
export function formatRelative(input?: string | number): string {
  if (input === undefined || input === null) return '—'
  const ts = typeof input === 'number' ? input : new Date(input).getTime()
  const diff = Date.now() - ts
  if (diff < 60000) return '방금 전'
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return `${Math.floor(hr / 24)}일 전`
}

/** 밀리초 또는 초 단위를 짧은 시간 형식으로. ms=true이면 밀리초 입력 */
export function formatDuration(value?: number, ms = false): string {
  if (!value) return '—'
  const seconds = ms ? Math.floor(value / 1000) : value
  if (seconds < 60) return `${seconds}초`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}분 ${seconds % 60}초`
  const hours = Math.floor(minutes / 60)
  return `${hours}시간 ${minutes % 60}분`
}
