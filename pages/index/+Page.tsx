import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Card, Alert, Button, SparkLine, MetricGauge, CommandBar, DEFAULT_COMMANDS, LoadingSkeleton, SetupRequired } from '../../components/ui'
import { StatusCard } from '../../components/ui/StatusCard'
import { useHealthData, type DashboardEvent, type ChannelStatus } from '../../hooks/useHealthData'
import { useConnectionStatus } from '../../hooks/useConnectionStatus'
import { formatUptime, formatTime, formatResourceDetail, getResourceStatus } from '../../lib/format'

/** 히스토리 최대 길이 */
const HISTORY_MAX = 30

export default function Page() {
  const {
    health,
    sessions,
    channels,
    events,
    connected,
    loading,
    lastUpdate,
    refresh,
  } = useHealthData()
  const { status, isConnected, isLoading } = useConnectionStatus()

  // 리소스 히스토리 (SparkLine 용)
  const [memHistory, setMemHistory] = useState<number[]>([])
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const prevHealthRef = useRef<string>('')

  useEffect(() => {
    if (!health) return
    const sig = `${health.memoryUsage?.heapUsed}-${health.cpuUsage}`
    if (sig === prevHealthRef.current) return
    prevHealthRef.current = sig

    if (health.memoryUsage) {
      const pct = Math.round((health.memoryUsage.heapUsed / health.memoryUsage.heapTotal) * 100)
      setMemHistory((prev) => [...prev, pct].slice(-HISTORY_MAX))
    }
    if (health.cpuUsage !== undefined) {
      setCpuHistory((prev) => [...prev, Math.round(health.cpuUsage!)].slice(-HISTORY_MAX))
    }
  }, [health])

  // 커맨드 바 액션 핸들러
  const handleCommandAction = useCallback(async (commandId: string) => {
    if (commandId === 'refresh') {
      refresh()
    }
  }, [refresh])

  // ─── 연결 상태 게이트 ───
  if (isLoading) {
    return <LoadingSkeleton variant="grid" lines={3} />
  }
  if (!status.config && !status.lastError) {
    return <SetupRequired pageName="대시보드" variant="setup" />
  }
  if (!status.config && status.lastError) {
    return <SetupRequired pageName="대시보드" variant="error" errorMessage={status.lastError} onRetry={() => window.location.reload()} />
  }
  if (status.config && !isConnected) {
    return <SetupRequired pageName="대시보드" variant="disconnected" />
  }

  const memPct = health?.memoryUsage
    ? Math.round((health.memoryUsage.heapUsed / health.memoryUsage.heapTotal) * 100)
    : 0
  const cpuPct = health?.cpuUsage !== undefined ? Math.round(health.cpuUsage) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-text-primary">대시보드</h2>
        {lastUpdate && (
          <span className="text-xs text-text-secondary">
            마지막 업데이트: {formatTime(lastUpdate)}
          </span>
        )}
      </div>

      {/* 상태 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatusCard
          title="Gateway"
          status={connected ? 'connected' : 'disconnected'}
          detail={
            connected
              ? `v${health?.version || '?'} · 가동 ${formatUptime(health?.uptime)}`
              : '연결되지 않음'
          }
        />
        <StatusCard
          title="세션"
          status={sessions.active > 0 ? 'connected' : 'unknown'}
          detail={`활성 ${sessions.active}개 · 오늘 ${sessions.today}개`}
        />
        <StatusCard
          title="시스템"
          status={getResourceStatus(health?.memoryUsage)}
          detail={formatResourceDetail(health)}
        />
      </div>

      {/* 리소스 게이지 + 트렌드 */}
      {connected && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              메모리 사용률
            </h3>
            <div className="flex items-center gap-4">
              <MetricGauge value={memPct} label="Heap" size={90} thickness={7} />
              <div className="flex-1 min-w-0">
                <SparkLine data={memHistory} width={140} height={40} min={0} max={100} color="var(--color-accent, #7C5CFC)" />
                <p className="text-xs text-text-secondary mt-1">
                  {health?.memoryUsage
                    ? `${Math.round(health.memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(health.memoryUsage.heapTotal / 1024 / 1024)}MB`
                    : '—'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              CPU 사용률
            </h3>
            <div className="flex items-center gap-4">
              <MetricGauge value={cpuPct} label="CPU" size={90} thickness={7} />
              <div className="flex-1 min-w-0">
                <SparkLine data={cpuHistory} width={140} height={40} min={0} max={100} color="var(--color-info, #3B82F6)" />
                <p className="text-xs text-text-secondary mt-1">
                  {health?.cpuUsage !== undefined ? `${Math.round(health.cpuUsage)}% 사용 중` : '—'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              디스크 사용률
            </h3>
            <div className="flex items-center gap-4">
              <MetricGauge
                value={health?.disk ? Math.round((health.disk.used / health.disk.total) * 100) : 0}
                label="Disk"
                size={90}
                thickness={7}
              />
              <div className="flex-1 min-w-0">
                <div className="space-y-1.5">
                  <DiskBar
                    label="사용"
                    value={health?.disk?.used || 0}
                    total={health?.disk?.total || 1}
                    color="bg-warning"
                  />
                  <DiskBar
                    label="여유"
                    value={health?.disk?.free || 0}
                    total={health?.disk?.total || 1}
                    color="bg-success"
                  />
                </div>
                <p className="text-xs text-text-secondary mt-1.5">
                  {health?.disk
                    ? `${formatBytes(health.disk.used)} / ${formatBytes(health.disk.total)}`
                    : '—'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 채널 + 이벤트 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 채널 상태 */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            채널 상태
          </h3>
          {channels.length > 0 ? (
            <div className="space-y-2">
              {channels.map((ch) => (
                <ChannelRow key={ch.name} channel={ch} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary py-4 text-center">
              {connected ? '등록된 채널이 없습니다' : '—'}
            </p>
          )}
        </Card>

        {/* 최근 이벤트 */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            최근 이벤트
          </h3>
          {events.length > 0 ? (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {events.map((event, i) => (
                <EventRow key={`${event.timestamp}-${i}`} event={event} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary py-4 text-center">
              이벤트가 없습니다
            </p>
          )}
        </Card>
      </div>

      {/* 커맨드 퀵슬롯 바 (게임 HUD) */}
      <Card className="mt-4 p-4">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          커맨드 바 <span className="text-[10px] font-normal">(Ctrl+숫자로 실행)</span>
        </h3>
        <CommandBar
          commands={DEFAULT_COMMANDS}
          connected={connected}
          onAction={handleCommandAction}
        />
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

function ChannelRow({ channel }: { channel: ChannelStatus }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${channel.connected ? 'bg-success' : 'bg-error'}`} />
        <span className="text-sm text-text-primary capitalize">{channel.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-secondary">
          {channel.connected ? '연결됨' : channel.error || '연결 끊김'}
        </span>
        {!channel.connected && (
          <a
            href="/config/channels"
            className="text-[10px] text-accent hover:underline"
          >
            설정
          </a>
        )}
      </div>
    </div>
  )
}

function EventRow({ event }: { event: DashboardEvent }) {
  const levelColors = {
    info: 'text-info',
    warning: 'text-warning',
    error: 'text-error',
  }

  return (
    <div className="flex items-start gap-2 text-xs py-1">
      <span className="text-text-secondary whitespace-nowrap font-mono">
        {new Date(event.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <span className={`${levelColors[event.level]} flex-1`}>
        {event.message}
      </span>
    </div>
  )
}

function DiskBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-text-secondary w-6">{label}</span>
      <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-text-secondary w-8 text-right">{pct}%</span>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)}${sizes[i]}`
}

// ─── 유틸은 lib/format.ts 에서 import ───
