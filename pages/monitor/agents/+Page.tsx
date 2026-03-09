import React, { useState, useEffect, useRef } from 'react'
import { Badge, Button, Alert, AgentAvatar, LoadingSkeleton, SetupRequired, Tooltip } from '../../../components/ui'
import {
  useAgentActivity,
  type AgentActivity,
  type AgentLocation,
  type AgentState,
  type ActivityLogEntry,
} from '../../../hooks/useAgentActivity'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'
import { cn, seedToColors } from '../../../lib/utils'

// ─── 배치 상수 ───

const ZONE_CONFIG: Record<AgentLocation, { startLeft: number; stepLeft: number; bottom: string }> = {
  entrance:  { startLeft: 3,  stepLeft: 4, bottom: '21%' },
  lounge:    { startLeft: 17, stepLeft: 4, bottom: '21%' },
  desk:      { startLeft: 38, stepLeft: 4, bottom: '25%' },
  meeting:   { startLeft: 70, stepLeft: 4, bottom: '21%' },
  bookshelf: { startLeft: 85, stepLeft: 4, bottom: '21%' },
}

function getAgentPosition(
  agent: AgentActivity,
  indexInZone: number
): { left: string; bottom: string } {
  const config = ZONE_CONFIG[agent.location]
  return {
    left: `${config.startLeft + indexInZone * config.stepLeft}%`,
    bottom: config.bottom,
  }
}

function groupByZone(agents: AgentActivity[]): Record<AgentLocation, AgentActivity[]> {
  const groups: Record<AgentLocation, AgentActivity[]> = {
    entrance: [], lounge: [], desk: [], meeting: [], bookshelf: [],
  }
  agents.forEach(a => groups[a.location].push(a))
  return groups
}

// ─── 가구 데이터 ───

interface FurnitureData {
  id: string
  left: string
  bottom: string
  width: number
  height: number
  viewBox: string
  children: React.ReactNode
}

const FURNITURE_ITEMS: FurnitureData[] = [
  {
    id: 'door',
    left: '1%', bottom: '20%', width: 30, height: 60, viewBox: '0 0 30 60',
    children: (
      <>
        <rect x="2" y="0" width="4" height="60" rx="1" />
        <rect x="2" y="0" width="26" height="3" rx="1" />
        <rect x="6" y="3" width="22" height="54" rx="1" />
        <circle cx="10" cy="32" r="2" />
      </>
    ),
  },
  {
    id: 'umbrella-stand',
    left: '5%', bottom: '20%', width: 12, height: 28, viewBox: '0 0 12 28',
    children: (
      <>
        <rect x="2" y="8" width="8" height="20" rx="2" />
        <line x1="4" y1="0" x2="4" y2="10" />
        <line x1="8" y1="2" x2="8" y2="10" />
      </>
    ),
  },
  {
    id: 'sofa',
    left: '14%', bottom: '42%', width: 60, height: 32, viewBox: '0 0 60 32',
    children: (
      <>
        <rect x="0" y="8" width="60" height="24" rx="4" />
        <rect x="0" y="0" width="8" height="32" rx="3" />
        <rect x="52" y="0" width="8" height="32" rx="3" />
        <rect x="8" y="2" width="44" height="10" rx="3" />
      </>
    ),
  },
  {
    id: 'coffee-table',
    left: '16%', bottom: '24%', width: 32, height: 20, viewBox: '0 0 32 20',
    children: (
      <>
        <rect x="2" y="0" width="28" height="4" rx="1" />
        <rect x="4" y="4" width="3" height="16" rx="1" />
        <rect x="25" y="4" width="3" height="16" rx="1" />
      </>
    ),
  },
  {
    id: 'plant',
    left: '26%', bottom: '20%', width: 14, height: 24, viewBox: '0 0 14 24',
    children: (
      <>
        <path d="M3 10 L1 24 L13 24 L11 10 Z" />
        <circle cx="7" cy="6" r="5" />
        <line x1="7" y1="10" x2="7" y2="11" />
      </>
    ),
  },
  {
    id: 'desk-a',
    left: '33%', bottom: '28%', width: 48, height: 40, viewBox: '0 0 48 40',
    children: (
      <>
        <rect x="0" y="16" width="48" height="4" rx="1" />
        <rect x="2" y="20" width="4" height="20" rx="1" />
        <rect x="42" y="20" width="4" height="20" rx="1" />
        <rect x="14" y="2" width="20" height="14" rx="2" />
        <rect x="22" y="16" width="4" height="2" />
      </>
    ),
  },
  {
    id: 'chair-a',
    left: '36%', bottom: '20%', width: 20, height: 24, viewBox: '0 0 20 24',
    children: (
      <>
        <rect x="4" y="0" width="12" height="12" rx="2" />
        <rect x="2" y="12" width="16" height="4" rx="1" />
        <rect x="8" y="16" width="4" height="4" />
        <ellipse cx="10" cy="22" rx="8" ry="2" />
      </>
    ),
  },
  {
    id: 'desk-b',
    left: '49%', bottom: '28%', width: 48, height: 40, viewBox: '0 0 48 40',
    children: (
      <>
        <rect x="0" y="16" width="48" height="4" rx="1" />
        <rect x="2" y="20" width="4" height="20" rx="1" />
        <rect x="42" y="20" width="4" height="20" rx="1" />
        <rect x="14" y="2" width="20" height="14" rx="2" />
        <rect x="22" y="16" width="4" height="2" />
      </>
    ),
  },
  {
    id: 'chair-b',
    left: '52%', bottom: '20%', width: 20, height: 24, viewBox: '0 0 20 24',
    children: (
      <>
        <rect x="4" y="0" width="12" height="12" rx="2" />
        <rect x="2" y="12" width="16" height="4" rx="1" />
        <rect x="8" y="16" width="4" height="4" />
        <ellipse cx="10" cy="22" rx="8" ry="2" />
      </>
    ),
  },
  {
    id: 'whiteboard',
    left: '64%', bottom: '40%', width: 40, height: 48, viewBox: '0 0 40 48',
    children: (
      <>
        <rect x="4" y="0" width="32" height="36" rx="2" />
        <rect x="6" y="2" width="28" height="30" rx="1" fill="white" opacity="0.1" />
        <rect x="16" y="36" width="3" height="12" />
        <rect x="21" y="36" width="3" height="12" />
      </>
    ),
  },
  {
    id: 'round-table',
    left: '68%', bottom: '24%', width: 36, height: 24, viewBox: '0 0 36 24',
    children: (
      <>
        <ellipse cx="18" cy="4" rx="18" ry="4" />
        <rect x="16" y="4" width="4" height="16" />
        <ellipse cx="18" cy="22" rx="10" ry="2" />
      </>
    ),
  },
  {
    id: 'chairs-set',
    left: '66%', bottom: '20%', width: 50, height: 18, viewBox: '0 0 50 18',
    children: (
      <>
        <rect x="2" y="0" width="10" height="10" rx="2" />
        <rect x="0" y="10" width="14" height="3" rx="1" />
        <rect x="20" y="0" width="10" height="10" rx="2" />
        <rect x="18" y="10" width="14" height="3" rx="1" />
        <rect x="38" y="0" width="10" height="10" rx="2" />
        <rect x="36" y="10" width="14" height="3" rx="1" />
      </>
    ),
  },
  {
    id: 'bookshelf-a',
    left: '82%', bottom: '30%', width: 28, height: 56, viewBox: '0 0 28 56',
    children: (
      <>
        <rect x="0" y="0" width="28" height="56" rx="2" />
        <line x1="2" y1="14" x2="26" y2="14" />
        <line x1="2" y1="28" x2="26" y2="28" />
        <line x1="2" y1="42" x2="26" y2="42" />
        <rect x="4" y="2" width="6" height="10" rx="1" />
        <rect x="12" y="4" width="5" height="8" rx="1" />
        <rect x="19" y="3" width="6" height="9" rx="1" />
      </>
    ),
  },
  {
    id: 'bookshelf-b',
    left: '89%', bottom: '30%', width: 28, height: 56, viewBox: '0 0 28 56',
    children: (
      <>
        <rect x="0" y="0" width="28" height="56" rx="2" />
        <line x1="2" y1="14" x2="26" y2="14" />
        <line x1="2" y1="28" x2="26" y2="28" />
        <line x1="2" y1="42" x2="26" y2="42" />
        <rect x="4" y="2" width="6" height="10" rx="1" />
        <rect x="12" y="4" width="5" height="8" rx="1" />
        <rect x="19" y="3" width="6" height="9" rx="1" />
      </>
    ),
  },
  {
    id: 'step-ladder',
    left: '93%', bottom: '20%', width: 16, height: 28, viewBox: '0 0 16 28',
    children: (
      <>
        <line x1="2" y1="0" x2="4" y2="28" />
        <line x1="14" y1="0" x2="12" y2="28" />
        <line x1="4" y1="8" x2="12" y2="8" />
        <line x1="4" y1="16" x2="12" y2="16" />
        <line x1="5" y1="24" x2="11" y2="24" />
      </>
    ),
  },
]

// ─── 존 라벨 데이터 ───

interface ZoneLabelData {
  name: string
  icon: React.ReactNode
  left: string
  location: AgentLocation
}

const ZONE_LABELS: ZoneLabelData[] = [
  {
    name: '입구',
    location: 'entrance',
    left: '3%',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="2" width="14" height="20" rx="2" />
        <circle cx="14" cy="12" r="1.5" fill="currentColor" />
        <path d="M17 2h4v20h-4" />
      </svg>
    ),
  },
  {
    name: '라운지',
    location: 'lounge',
    left: '17%',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 8h1a4 4 0 010 8h-1" />
        <path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" />
        <path d="M6 2v3M10 2v3M14 2v3" />
      </svg>
    ),
  },
  {
    name: '작업 데스크',
    location: 'desk',
    left: '40%',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    name: '미팅 룸',
    location: 'meeting',
    left: '67%',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    name: '도구 창고',
    location: 'bookshelf',
    left: '86%',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
]

// ─── useIsWideScreen ───

function useIsWideScreen() {
  const [isWide, setIsWide] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 1360px)')
    setIsWide(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isWide
}

// ─── 유틸 함수 ───

/**
 * UI 표시용 짧은 상태 텍스트 (말풍선에 표시).
 * hook의 getLastActionText와 별개 — hook 버전은 데이터용 (플랫폼 포함),
 * 이 버전은 말풍선 UI용 (짧고 간결).
 */
function getBubbleText(state: AgentState, _platform: string): string {
  switch (state) {
    case 'working': return '작업 중...'
    case 'speaking': return '대화 중'
    case 'tool_calling': return '도구 실행 중'
    case 'error': return '오류 발생!'
    case 'idle': return '대기 중'
    default: return '오프라인'
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':')
}

function getUptimeText(startedAt: number): string {
  const diff = Date.now() - startedAt
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 시작'
  if (minutes < 60) return `${minutes}분`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 ${minutes % 60}분`
  const days = Math.floor(hours / 24)
  return `${days}일 ${hours % 24}시간`
}

function getTimeAgoText(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 10) return '방금 전'
  if (seconds < 60) return `${seconds}초 전`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}분 전`
  return `${Math.floor(minutes / 60)}시간 전`
}

function getLevel(messageCount: number): number {
  if (messageCount <= 0) return 1
  return Math.min(99, Math.floor(Math.log2(messageCount + 1)) + 1)
}

function getExpPercent(messageCount: number): number {
  if (messageCount <= 0) return 0
  const level = getLevel(messageCount)
  const currentLevelStart = Math.pow(2, level - 1) - 1
  const nextLevelStart = Math.pow(2, level) - 1
  const range = nextLevelStart - currentLevelStart
  const progress = messageCount - currentLevelStart
  return Math.min(100, Math.floor((progress / range) * 100))
}

// ─── 메인 페이지 ───

export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()
  const {
    agents,
    loading,
    error,
    wsConnected,
    refresh,
    totalSessions,
    activeSessions,
    activityLogs,
  } = useAgentActivity()

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  // Derived state: agents 배열이 업데이트되면 자동으로 최신 데이터 반영
  const selectedAgent = selectedAgentId
    ? agents.find(a => a.id === selectedAgentId) ?? null
    : null

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="grid" lines={3} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="에이전트 오피스" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="에이전트 오피스"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="에이전트 오피스" variant="disconnected" />
  }

  if (loading) {
    return <OfficeSkeleton />
  }

  return (
    <div>
      {/* 헤더 */}
      <OfficeHeader
        wsConnected={wsConnected}
        activeSessions={activeSessions}
        totalSessions={totalSessions}
        onRefresh={refresh}
      />

      {/* 오피스 + 사이드 패널 (flex) */}
      <div className="flex gap-0">
        {/* 오피스 컨테이너 (가로 스크롤 래퍼) */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <OfficeContainer
            agents={agents}
            selectedAgent={selectedAgent}
            onAgentClick={(agent) => setSelectedAgentId(agent.id)}
            onBackgroundClick={() => setSelectedAgentId(null)}
            error={error}
            onRetry={refresh}
          />

          {/* 활동 로그 피드 */}
          <ActivityLogFeed logs={activityLogs} />
        </div>

        {/* 사이드 패널 */}
        {selectedAgent && (
          <AgentSidePanel
            agent={selectedAgent}
            onClose={() => setSelectedAgentId(null)}
          />
        )}
      </div>
    </div>
  )
}

// ─── OfficeSkeleton ───

function OfficeSkeleton() {
  return (
    <div>
      {/* 헤더 스켈레톤 */}
      <div className="flex items-center justify-between mb-4">
        <div className="animate-pulse bg-bg-secondary h-7 w-40 rounded" />
        <div className="flex gap-2">
          <div className="animate-pulse bg-bg-secondary h-6 w-16 rounded" />
          <div className="animate-pulse bg-bg-secondary h-6 w-16 rounded" />
          <div className="animate-pulse bg-bg-secondary h-6 w-16 rounded" />
        </div>
      </div>

      {/* 오피스 스켈레톤 */}
      <div
        className="relative w-full rounded-xl overflow-hidden bg-bg-secondary/30"
        style={{ height: 420 }}
      >
        {/* 바닥선 */}
        <div
          className="absolute left-0 right-0 h-0.5 bg-bg-secondary animate-pulse"
          style={{ bottom: '20%' }}
        />

        {/* 존별 블록 */}
        {[
          { left: '0%', width: '12%', height: '60%', delay: 0 },
          { left: '12%', width: '18%', height: '50%', delay: 100 },
          { left: '30%', width: '32%', height: '70%', delay: 200 },
          { left: '62%', width: '20%', height: '55%', delay: 300 },
          { left: '80%', width: '20%', height: '65%', delay: 400 },
        ].map((zone, i) => (
          <div
            key={i}
            className="absolute bg-bg-secondary/60 animate-pulse rounded"
            style={{
              left: zone.left,
              width: zone.width,
              height: zone.height,
              bottom: '20%',
              animationDelay: `${zone.delay}ms`,
            }}
          />
        ))}
      </div>

      {/* 로그 영역 스켈레톤 */}
      <div
        className="w-full bg-bg-secondary/20 animate-pulse rounded-b-xl"
        style={{ height: 120 }}
      />
    </div>
  )
}

// ─── OfficeHeader ───

function OfficeHeader({
  wsConnected,
  activeSessions,
  totalSessions,
  onRefresh,
}: {
  wsConnected: boolean
  activeSessions: number
  totalSessions: number
  onRefresh: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold text-text-primary">
        에이전트 오피스
      </h2>
      <div className="flex items-center gap-2">
        <Badge variant={wsConnected ? 'success' : 'error'}>
          {wsConnected ? '실시간' : '연결 끊김'}
        </Badge>
        <Badge variant="info">{activeSessions} 활동중</Badge>
        <Badge variant="neutral">{totalSessions} 총원</Badge>
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          새로고침
        </Button>
        <OfficeClock />
      </div>
    </div>
  )
}

// ─── OfficeClock ───

function OfficeClock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null
    // 다음 분 경계까지 잔여 시간 후 정렬된 인터벌 시작
    const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000
    const timeoutId = setTimeout(() => {
      setTime(new Date())
      intervalId = setInterval(() => setTime(new Date()), 60000)
    }, msUntilNextMinute)
    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  const hh = String(time.getHours()).padStart(2, '0')
  const mm = String(time.getMinutes()).padStart(2, '0')

  return (
    <span className="font-mono text-sm text-text-secondary">{hh}:{mm}</span>
  )
}

// ─── OfficeBackground (React.memo) ───

const OfficeBackground = React.memo(function OfficeBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1000 500"
      preserveAspectRatio="none"
      style={{ zIndex: 0 }}
    >
      {/* 벽면 */}
      <rect x="0" y="0" width="1000" height="400" fill="var(--owm-bg-secondary)" />
      {/* 바닥 */}
      <rect x="0" y="400" width="1000" height="100" fill="var(--owm-bg-primary)" opacity="0.5" />
      {/* 바닥선 */}
      <line x1="0" y1="400" x2="1000" y2="400" stroke="var(--owm-border)" strokeWidth="2" />
      {/* 존 구분선 */}
      {[120, 300, 620, 800].map(x => (
        <line
          key={x}
          x1={x} y1="100" x2={x} y2="400"
          stroke="var(--owm-border)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"
        />
      ))}
    </svg>
  )
})

// ─── FurnitureItem (React.memo) ───

const FurnitureItem = React.memo(function FurnitureItem({
  left, bottom, width, height, viewBox, children,
}: Omit<FurnitureData, 'id'>) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left, bottom, width, height, zIndex: 10 }}
    >
      <svg
        width={width}
        height={height}
        viewBox={viewBox}
        stroke="var(--owm-text-secondary)"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        fill="var(--owm-bg-card)"
        fillOpacity="0.3"
      >
        {children}
      </svg>
    </div>
  )
})

// ─── OfficeFurniture (React.memo) ───

const OfficeFurniture = React.memo(function OfficeFurniture() {
  return (
    <>
      {FURNITURE_ITEMS.map(item => (
        <FurnitureItem
          key={item.id}
          left={item.left}
          bottom={item.bottom}
          width={item.width}
          height={item.height}
          viewBox={item.viewBox}
        >
          {item.children}
        </FurnitureItem>
      ))}
    </>
  )
})

// ─── ZoneLabel ───

function ZoneLabel({
  name,
  icon,
  left,
  agentCount,
}: {
  name: string
  icon: React.ReactNode
  left: string
  agentCount: number
}) {
  return (
    <div
      className="absolute flex items-center gap-1"
      style={{ left, top: 8, zIndex: 10 }}
    >
      <span className="flex items-center gap-1 bg-card/80 px-2 py-0.5 rounded text-[11px] font-semibold text-text-secondary">
        {icon}
        {name}
      </span>
      {agentCount > 0 && <Badge variant="neutral" size="sm">{agentCount}</Badge>}
    </div>
  )
}

// ─── SpeechBubble ───

/** 상태별 아이콘 (모듈 수준 상수 — 렌더마다 재생성 방지) */
const SPEECH_BUBBLE_ICONS: Record<string, React.ReactNode> = {
  working: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="6" y1="8" x2="6" y2="8" />
      <line x1="10" y1="8" x2="10" y2="8" />
      <line x1="14" y1="8" x2="14" y2="8" />
      <line x1="18" y1="8" x2="18" y2="8" />
      <line x1="6" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="18" y2="12" />
      <line x1="8" y1="16" x2="16" y2="16" />
    </svg>
  ),
  speaking: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  tool_calling: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
}

function SpeechBubble({ state, message }: { state: 'working' | 'speaking' | 'tool_calling' | 'error'; message: string }) {
  return (
    <div
      className={cn(
        'absolute left-1/2 animate-speech-bubble-in',
        'flex items-center gap-1 px-2 py-1 rounded-lg max-w-[120px]',
        'text-[10px] whitespace-nowrap overflow-hidden text-ellipsis',
        state === 'error'
          ? 'bg-error/10 border border-error/30 text-error'
          : 'bg-card border border-border text-text-primary'
      )}
      style={{ top: -40, transform: 'translateX(-50%)', zIndex: 30 }}
    >
      <span className="flex-shrink-0">{SPEECH_BUBBLE_ICONS[state]}</span>
      <span className="truncate">{message}</span>
      {/* tail */}
      <div
        className="absolute left-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px]"
        style={{
          bottom: -5,
          transform: 'translateX(-50%)',
          borderTopColor: state === 'error'
            ? 'color-mix(in srgb, var(--owm-error) 10%, var(--owm-bg-card))'
            : 'var(--owm-bg-card)',
        }}
      />
    </div>
  )
}

// ─── IdleZzz ───

function IdleZzz() {
  return (
    <span
      className="absolute text-[11px] font-semibold text-text-secondary/60 animate-float"
      style={{ top: -20, right: -8, zIndex: 30 }}
    >
      Zzz
    </span>
  )
}

// ─── AgentCharacterOnFloor ───

function AgentCharacterOnFloor({
  agent,
  isSelected,
  onClick,
  left,
  bottom,
}: {
  agent: AgentActivity
  isSelected: boolean
  onClick: () => void
  left: string
  bottom: string
}) {
  return (
    <button
      className="absolute flex flex-col items-center"
      style={{
        left,
        bottom,
        zIndex: 20,
        transform: 'translateX(-50%)',
        transition: 'left 400ms ease-out, bottom 400ms ease-out',
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {/* 말풍선 또는 Zzz */}
      <div className="relative">
        {agent.state !== 'idle' && agent.state !== 'offline' && (
          <SpeechBubble state={agent.state as 'working' | 'speaking' | 'tool_calling' | 'error'} message={getBubbleText(agent.state, agent.platform)} />
        )}
        {agent.state === 'idle' && <IdleZzz />}

        {/* 아바타 */}
        <AgentAvatar
          seed={agent.avatarSeed}
          state={agent.state}
          name={agent.name}
          size="md"
        />
      </div>

      {/* 이름 */}
      <span className="text-[10px] font-medium text-text-primary max-w-[52px] truncate text-center">
        {agent.name}
      </span>

      {/* 선택 인디케이터 */}
      {isSelected && (
        <div className="w-6 h-0.5 bg-accent rounded-full mt-0.5" />
      )}
    </button>
  )
}

// ─── OverflowBadge ───

function OverflowBadge({
  hiddenAgents,
  left,
  bottom,
}: {
  hiddenAgents: AgentActivity[]
  left: string
  bottom: string
}) {
  const tooltipContent = hiddenAgents.slice(0, 10).map(a => a.name).join(', ')
    + (hiddenAgents.length > 10 ? ` ...외 ${hiddenAgents.length - 10}명` : '')

  return (
    <Tooltip content={tooltipContent} position="top">
      <div
        className="absolute flex items-center justify-center"
        style={{ left, bottom, zIndex: 20, width: 48, height: 48 }}
      >
        <Badge variant="neutral" size="sm">+{hiddenAgents.length}</Badge>
      </div>
    </Tooltip>
  )
}

// ─── EmptyOfficeOverlay ───

function EmptyOfficeOverlay() {
  return (
    <div
      className="absolute flex flex-col items-center justify-center"
      style={{ left: '40%', bottom: '35%', transform: 'translateX(-50%)', zIndex: 40 }}
    >
      <div className="bg-card/60 backdrop-blur-sm rounded-lg p-4 px-6 text-center">
        <p className="text-sm font-semibold text-text-secondary/60">에이전트를 기다리는 중...</p>
        <p className="text-xs text-text-secondary/50 mt-1">에이전트 세션이 시작되면 오피스에 자동으로 나타납니다</p>
      </div>
    </div>
  )
}

// ─── OfficeContainer ───

function OfficeContainer({
  agents,
  selectedAgent,
  onAgentClick,
  onBackgroundClick,
  error,
  onRetry,
}: {
  agents: AgentActivity[]
  selectedAgent: AgentActivity | null
  onAgentClick: (agent: AgentActivity) => void
  onBackgroundClick: () => void
  error: string | null
  onRetry: () => void
}) {
  const grouped = groupByZone(agents)

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border flex-1 min-w-0"
      style={{ minHeight: 420, maxHeight: 520, height: '50vh', minWidth: 800 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onBackgroundClick()
      }}
    >
      {/* z-0: 배경 SVG */}
      <OfficeBackground />

      {/* z-10: 가구 */}
      <OfficeFurniture />

      {/* z-10: 존 라벨 */}
      {ZONE_LABELS.map(zl => (
        <ZoneLabel
          key={zl.location}
          name={zl.name}
          icon={zl.icon}
          left={zl.left}
          agentCount={grouped[zl.location].length}
        />
      ))}

      {/* z-40: 빈 오피스 안내 */}
      {agents.length === 0 && <EmptyOfficeOverlay />}

      {/* z-50: 에러 배너 */}
      {error && (
        <div className="absolute top-2 left-2 right-2" style={{ zIndex: 50 }}>
          <Alert variant="error" dismissible onDismiss={() => {}}>
            <div className="flex items-center justify-between gap-2">
              <span>세션 데이터 조회 실패: {error}</span>
              <Button variant="secondary" size="sm" onClick={onRetry}>
                재시도
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* z-20: 에이전트 캐릭터 */}
      {(Object.keys(grouped) as AgentLocation[]).map(location => {
        const zoneAgents = grouped[location]
        const visible = zoneAgents.slice(0, 6)
        const hidden = zoneAgents.slice(6)

        return (
          <React.Fragment key={location}>
            {visible.map((agent, idx) => {
              const pos = getAgentPosition(agent, idx)
              return (
                <AgentCharacterOnFloor
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedAgent?.id === agent.id}
                  onClick={() => onAgentClick(agent)}
                  left={pos.left}
                  bottom={pos.bottom}
                />
              )
            })}
            {hidden.length > 0 && (
              <OverflowBadge
                hiddenAgents={hidden}
                left={`${ZONE_CONFIG[location].startLeft + 6 * ZONE_CONFIG[location].stepLeft}%`}
                bottom={ZONE_CONFIG[location].bottom}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── ActivityLogFeed ───

function ActivityLogFeed({ logs }: { logs: ActivityLogEntry[] }) {
  const [collapsed, setCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = 0
    }
  }, [logs, collapsed])

  return (
    <div
      className="w-full bg-card border-t border-border rounded-b-xl overflow-hidden"
      style={{ height: collapsed ? 32 : 120, transition: 'height 200ms ease-out' }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 h-8">
        <span className="text-xs font-semibold text-text-secondary">활동 로그</span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          {collapsed ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </button>
      </div>

      {/* 로그 목록 (펼친 상태) */}
      {!collapsed && (
        <div
          ref={scrollRef}
          className="overflow-y-auto px-3 pb-2"
          style={{ height: 'calc(120px - 32px)' }}
        >
          {logs.length === 0 ? (
            <p className="text-xs text-text-secondary/60 italic text-center py-4">
              아직 활동 기록이 없습니다. 에이전트가 활동하면 여기에 표시됩니다.
            </p>
          ) : (
            logs.map(log => <LogEntry key={log.id} log={log} />)
          )}
        </div>
      )}

      {/* 접힌 상태: 마지막 1건만 */}
      {collapsed && logs.length > 0 && (
        <div className="px-3 truncate">
          <LogEntry log={logs[0]} />
        </div>
      )}
    </div>
  )
}

// ─── LogEntry ───

function LogEntry({ log }: { log: ActivityLogEntry }) {
  return (
    <div className="flex items-center gap-2 h-6 text-[11px] font-mono">
      <span className="text-text-secondary">
        [{formatTime(log.timestamp)}]
      </span>
      <span style={{ color: seedToColors(log.avatarSeed).body }}>
        {log.agentName}:
      </span>
      <span className="text-text-primary truncate">
        {log.message}
      </span>
    </div>
  )
}

// ─── AgentSidePanel ───

function AgentSidePanel({
  agent,
  onClose,
}: {
  agent: AgentActivity
  onClose: () => void
}) {
  const isWide = useIsWideScreen()

  // ESC 키 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const panelContent = (
    <div className="p-5 relative">
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
        aria-label="닫기"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* 아바타 (중앙 정렬) */}
      <div className="flex flex-col items-center gap-2 mb-4 pt-2">
        <AgentAvatar
          seed={agent.avatarSeed}
          state={agent.state}
          name={agent.name}
          size="lg"
        />
        <StateBadge state={agent.state} />
      </div>

      {/* 이름 + 활동 */}
      <h3 className="text-lg font-bold text-text-primary text-center mb-1">{agent.name}</h3>
      <p className="text-sm text-text-secondary text-center mb-4">{agent.lastAction}</p>

      {/* RPG 스탯 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatItem label="플랫폼" value={agent.platform} icon="🌐" />
        <StatItem label="메시지 (EXP)" value={String(agent.messageCount)} icon="💬" />
        <StatItem label="가동 시간" value={getUptimeText(agent.startedAt)} icon="⏱️" />
        <StatItem label="마지막 활동" value={getTimeAgoText(agent.lastActivity)} icon="👀" />
      </div>

      {/* 경험치 바 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-secondary">경험치 (메시지 수)</span>
          <span className="text-xs font-mono text-text-primary">
            LV.{getLevel(agent.messageCount)}
          </span>
        </div>
        <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-info rounded-full transition-all duration-500"
            style={{ width: `${getExpPercent(agent.messageCount)}%` }}
          />
        </div>
      </div>
    </div>
  )

  // 데스크탑 (>= 1360px): 인라인 사이드 패널
  if (isWide) {
    return (
      <div
        className="flex-shrink-0 w-[320px] bg-card border-l border-border overflow-y-auto transition-transform duration-200 ease-out"
        style={{ zIndex: 10 }}
      >
        {panelContent}
      </div>
    )
  }

  // 모바일 (< 1360px): 오버레이 모달
  return (
    <>
      <div
        className="fixed inset-0 bg-black/50"
        style={{ zIndex: 40 }}
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 bottom-0 w-[320px] bg-card border-l border-border overflow-y-auto transition-transform duration-200 ease-out"
        style={{ zIndex: 50 }}
      >
        {panelContent}
      </div>
    </>
  )
}

// ─── StatItem ───

function StatItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-2.5">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-xs">{icon}</span>
        <span className="text-[10px] text-text-secondary uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium text-text-primary truncate">{value}</p>
    </div>
  )
}

// ─── StateBadge ───

function StateBadge({ state }: { state: AgentState }) {
  const map: Record<AgentState, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
    working: { label: '작업 중', variant: 'success' },
    speaking: { label: '대화 중', variant: 'info' },
    tool_calling: { label: '도구 실행', variant: 'warning' },
    idle: { label: '대기 중', variant: 'neutral' },
    error: { label: '오류', variant: 'error' },
    offline: { label: '오프라인', variant: 'neutral' },
  }
  const { label, variant } = map[state] || map.offline
  return <Badge variant={variant} size="sm">{label}</Badge>
}
