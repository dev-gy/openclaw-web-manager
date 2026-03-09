import React from 'react'
import { Card, Badge, Alert, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { StatusCard } from '../../../components/ui/StatusCard'
import { useHealthData } from '../../../hooks/useHealthData'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'
import { formatUptime, formatResourceDetail, getResourceStatus } from '../../../lib/format'

export default function Page() {
  const { health, sessions, channels, connected, loading } = useHealthData()
  const { status, isConnected, isLoading } = useConnectionStatus()

  // ─── 연결 상태 게이트 ───
  if (isLoading) {
    return <LoadingSkeleton variant="grid" lines={3} />
  }
  if (!status.config && !status.lastError) {
    return <SetupRequired pageName="모니터링" variant="setup" />
  }
  if (!status.config && status.lastError) {
    return <SetupRequired pageName="모니터링" variant="error" errorMessage={status.lastError} onRetry={() => window.location.reload()} />
  }

  const isDisconnected = status.config && !isConnected

  return (
    <div>
      <h2 className="text-2xl font-bold text-text-primary mb-6">모니터링</h2>

      {/* 연결 끊김 경고 배너 */}
      {isDisconnected && (
        <Alert variant="warning" title="Gateway 연결이 끊어졌습니다" className="mb-6">
          실시간 모니터링을 이용하려면 Gateway에 다시 연결해야 합니다.{' '}
          <a href="/server/connection" className="underline font-medium">재연결 설정</a>
        </Alert>
      )}

      {/* 상태 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatusCard
          title="Gateway"
          status={isDisconnected ? 'disconnected' : connected ? 'connected' : 'unknown'}
          detail={
            connected
              ? `v${health?.version || '?'} · 가동 ${formatUptime(health?.uptime)}`
              : isDisconnected ? '연결 끊김' : '확인 중...'
          }
        />
        <StatusCard
          title="세션"
          status={isDisconnected ? 'unknown' : sessions.active > 0 ? 'connected' : 'unknown'}
          detail={isDisconnected ? '확인 불가' : `활성 ${sessions.active}개`}
        />
        <StatusCard
          title="시스템"
          status={isDisconnected ? 'unknown' : getResourceStatus(health?.memoryUsage)}
          detail={isDisconnected ? '확인 불가' : formatResourceDetail(health)}
        />
      </div>

      {/* 채널 상태 */}
      {!isDisconnected && channels.length > 0 && (
        <Card className="p-4 mb-6">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            채널 상태
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {channels.map((ch) => (
              <div key={ch.name} className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 py-2">
                <span className={`w-2 h-2 rounded-full ${ch.connected ? 'bg-success' : 'bg-error'}`} />
                <span className="text-sm text-text-primary capitalize">{ch.name}</span>
                <Badge variant={ch.connected ? 'success' : 'error'} size="sm" className="ml-auto">
                  {ch.connected ? '연결' : '끊김'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 빠른 링크 */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-6${isDisconnected ? ' opacity-50 pointer-events-none' : ''}`}>
        <a href="/monitor/agents" className="block">
          <Card className="p-5 hover:border-accent/30 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text-primary">🏢 에이전트 오피스</h3>
                <p className="text-sm text-text-secondary mt-1">에이전트 활동 실시간 감시</p>
              </div>
              <span className="text-2xl">🎮</span>
            </div>
          </Card>
        </a>

        <a href="/monitor/sessions" className="block">
          <Card className="p-5 hover:border-accent/30 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text-primary">📊 세션 관리</h3>
                <p className="text-sm text-text-secondary mt-1">활성 세션 조회 및 관리</p>
              </div>
              <div className="text-2xl font-bold text-text-primary">
                {sessions.active}
              </div>
            </div>
          </Card>
        </a>

        <a href="/monitor/logs" className="block">
          <Card className="p-5 hover:border-accent/30 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text-primary">📜 실시간 로그</h3>
                <p className="text-sm text-text-secondary mt-1">Gateway 로그 실시간 스트리밍</p>
              </div>
              <Badge variant={connected ? 'success' : 'neutral'}>
                {connected ? 'LIVE' : 'OFF'}
              </Badge>
            </div>
          </Card>
        </a>
      </div>

      {/* 빠른 액션 */}
      <Card className={`p-4${isDisconnected ? ' opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          빠른 액션
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MonitorAction
            icon="🔄"
            label="Gateway 재연결"
            onClick={async () => {
              await fetch('/api/connection/reconnect', { method: 'POST' })
            }}
          />
          <MonitorAction
            icon="⚡"
            label="프로세스 재시작"
            onClick={async () => {
              await fetch('/api/server/restart', { method: 'POST' })
            }}
          />
          <MonitorAction
            icon="📡"
            label="채널 설정"
            href="/config/channels"
          />
          <MonitorAction
            icon="🎮"
            label="캐릭터 시트"
            href="/config/agents"
          />
        </div>
      </Card>

      {loading && (
        <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg px-3 py-2 text-xs text-text-secondary shadow-lg">
          데이터 로딩 중...
        </div>
      )}
    </div>
  )
}

// ─── 서브 컴포넌트 ───

function MonitorAction({
  icon,
  label,
  onClick,
  href,
}: {
  icon: string
  label: string
  onClick?: () => Promise<void>
  href?: string
}) {
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleClick = async () => {
    if (href) {
      window.location.href = href
      return
    }
    if (!onClick) return
    setStatus('loading')
    try {
      await onClick()
      setStatus('done')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  const statusIcon =
    status === 'loading' ? '\u23F3' :
    status === 'done' ? '\u2705' :
    status === 'error' ? '\u274C' : icon

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        status === 'done'
          ? 'bg-success/10 text-success border border-success/30'
          : status === 'error'
          ? 'bg-error/10 text-error border border-error/30'
          : 'bg-bg-secondary hover:bg-border text-text-primary border border-transparent'
      }`}
    >
      <span>{statusIcon}</span>
      <span>{label}</span>
    </button>
  )
}

// ─── 유틸은 lib/format.ts 에서 import ───
