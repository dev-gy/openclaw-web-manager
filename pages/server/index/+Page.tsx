import React, { useState, useEffect } from 'react'
import { Card, Button, Badge, Alert, Terminal, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { StatusCard } from '../../../components/ui/StatusCard'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'
import { useProcessStatus } from '../../../hooks/useProcessStatus'
import { formatUptime } from '../../../lib/format'

interface ServerInfo {
  status: {
    version?: string
    sessionsActive?: number
    sessionsToday?: number
    channels?: string[]
  } | null
  health: {
    uptime?: number
    memoryUsage?: { rss: number; heapUsed: number; heapTotal: number }
    cpuUsage?: number
  } | null
  processStatus: {
    running: boolean
    pid?: number
    uptime?: number
    lastError?: string
    environment?: {
      os: string
      distro: string
      nodeVersion: string
      runtime: string
      openclawVersion?: string
    }
  } | null
}

export default function Page() {
  const { status, isConnected, isLoading: connectionLoading } = useConnectionStatus()
  const [serverInfo, setServerInfo] = useState<ServerInfo>({
    status: null,
    health: null,
    processStatus: null,
  })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchInfo = async () => {
    setLoading(true)
    try {
      const [infoRes, processRes] = await Promise.all([
        fetch('/api/server/info').catch(() => null),
        fetch('/api/server/process/status').catch(() => null),
      ])

      const info = infoRes?.ok ? await infoRes.json() : {}
      const process = processRes?.ok ? await processRes.json() : null

      setServerInfo({
        status: info.status || null,
        health: info.health || null,
        processStatus: process,
      })
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInfo()
  }, [])

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="list" lines={4} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="서버" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="서버"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="서버" variant="disconnected" />
  }

  const handleProcessAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/server/process/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'start' ? JSON.stringify({ configPath: 'data/openclaw-config.json' }) : '{}',
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(data.message || `${action} 성공`)
        setTimeout(() => fetchInfo(), 2000)
      } else {
        setError(data.error || `${action} 실패`)
      }
    } catch (err: any) {
      setError(err.message || '작업 실패')
    } finally {
      setActionLoading(null)
      setTimeout(() => setSuccess(null), 3000)
    }
  }

  const env = serverInfo.processStatus?.environment
  const gatewayInfo = status.gatewayInfo

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-text-primary">서버 정보</h2>
        <Button variant="secondary" onClick={fetchInfo} size="sm">
          새로고침
        </Button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" className="mb-4">{success}</Alert>}

      {/* 상태 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatusCard
          title="Gateway 연결"
          status={isConnected ? 'connected' : 'disconnected'}
          detail={isConnected ? status.config?.url || '연결됨' : '연결되지 않음'}
        />
        <StatusCard
          title="프로세스"
          status={serverInfo.processStatus?.running ? 'connected' : 'disconnected'}
          detail={
            serverInfo.processStatus?.running
              ? `PID ${serverInfo.processStatus.pid || '?'}`
              : '실행 중이지 않음'
          }
        />
        <StatusCard
          title="버전"
          status={gatewayInfo?.version ? 'connected' : 'unknown'}
          detail={gatewayInfo?.version || serverInfo.status?.version || '—'}
        />
      </div>

      <div className="space-y-4">
        {/* 서버 상세 정보 */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            서버 상세
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="운영체제" value={env?.os || '—'} />
            <InfoRow label="배포판" value={env?.distro || '—'} />
            <InfoRow label="Node.js" value={env?.nodeVersion || '—'} />
            <InfoRow label="런타임" value={env?.runtime || '—'} />
            <InfoRow label="OpenClaw" value={env?.openclawVersion || gatewayInfo?.version || '—'} />
            <InfoRow
              label="가동 시간"
              value={formatUptime(serverInfo.health?.uptime || gatewayInfo?.uptime)}
            />
            <InfoRow
              label="메모리"
              value={
                serverInfo.health?.memoryUsage
                  ? `${Math.round(serverInfo.health.memoryUsage.rss / 1024 / 1024)}MB`
                  : '—'
              }
            />
            <InfoRow
              label="CPU"
              value={
                serverInfo.health?.cpuUsage !== undefined
                  ? `${Math.round(serverInfo.health.cpuUsage)}%`
                  : '—'
              }
            />
            <InfoRow
              label="활성 세션"
              value={String(serverInfo.status?.sessionsActive ?? gatewayInfo?.sessionsActive ?? '—')}
            />
            <InfoRow
              label="오늘 세션"
              value={String(serverInfo.status?.sessionsToday ?? '—')}
            />
          </div>

          {serverInfo.status?.channels && serverInfo.status.channels.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-sm text-text-secondary">채널: </span>
              <div className="flex gap-2 mt-1 flex-wrap">
                {serverInfo.status.channels.map((ch) => (
                  <Badge key={typeof ch === 'string' ? ch : (ch as any).name} variant="info" size="sm">
                    {typeof ch === 'string' ? ch : (ch as any).name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* 프로세스 제어 */}
        <ProcessControlCard
          processStatus={serverInfo.processStatus}
          actionLoading={actionLoading}
          onAction={handleProcessAction}
        />

        {/* 업데이트 */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-1">
                업데이트
              </h3>
              <p className="text-xs text-text-secondary">
                OpenClaw 업데이트를 확인하고 설치합니다
              </p>
            </div>
            <a
              href="/server/update"
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
            >
              업데이트 확인
            </a>
          </div>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-text-secondary text-xs">{label}</span>
      <p className="text-text-primary font-mono text-sm">{value}</p>
    </div>
  )
}

// ─── 프로세스 제어 카드 (실시간 로그 포함) ───

function ProcessControlCard({
  processStatus,
  actionLoading,
  onAction,
}: {
  processStatus: any
  actionLoading: string | null
  onAction: (action: 'start' | 'stop' | 'restart') => void
}) {
  const process = useProcessStatus()
  const [showLogs, setShowLogs] = useState(false)
  const [fetchedLogs, setFetchedLogs] = useState<string[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // 실시간 WS 연결 (로그 패널 열 때)
  useEffect(() => {
    if (showLogs) {
      process.connect()
      return () => process.disconnect()
    }
  }, [showLogs])

  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await fetch('/api/server/process/logs?lines=100')
      if (res.ok) {
        const data = await res.json()
        setFetchedLogs(data.logs || [])
      }
    } catch { /* ignore */ }
    setLogsLoading(false)
  }

  const toggleLogs = () => {
    if (!showLogs) {
      fetchLogs()
    }
    setShowLogs(!showLogs)
  }

  // 터미널 라인: 가져온 로그 + 실시간 로그
  const allLogs = showLogs
    ? [...fetchedLogs, ...process.logs]
    : []

  const terminalLines = allLogs.map((line) => ({
    text: line,
    type: (line.startsWith('[stderr]') || line.startsWith('[error]') ? 'stderr' : 'stdout') as 'stdout' | 'stderr',
  }))

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-1">
            프로세스 제어
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`w-2 h-2 rounded-full ${processStatus?.running ? 'bg-success animate-pulse' : 'bg-error'}`}
            />
            <span className="text-xs text-text-secondary">
              {processStatus?.running ? '실행 중' : '중지됨'}
              {process.connected && process.status !== 'stopped' && (
                <> (PID: {process.pid || '?'})</>
              )}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {processStatus?.running ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onAction('restart')}
                loading={actionLoading === 'restart'}
              >
                재시작
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onAction('stop')}
                loading={actionLoading === 'stop'}
              >
                중지
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => onAction('start')}
              loading={actionLoading === 'start'}
            >
              시작
            </Button>
          )}
        </div>
      </div>

      {processStatus?.lastError && (
        <Alert variant="error" className="mt-3">
          마지막 오류: {processStatus.lastError}
        </Alert>
      )}

      {/* 로그 토글 */}
      <div className="mt-4 pt-3 border-t border-border">
        <button
          onClick={toggleLogs}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <span>{showLogs ? '▼' : '▶'}</span>
          <span className="font-medium">프로세스 로그</span>
          {process.connected && showLogs && (
            <Badge variant="success" size="sm">실시간</Badge>
          )}
        </button>

        {showLogs && (
          <div className="mt-3">
            {logsLoading && terminalLines.length === 0 ? (
              <div className="py-4 text-center text-text-secondary text-sm">
                로그를 불러오는 중...
              </div>
            ) : (
              <Terminal
                lines={terminalLines}
                title="OpenClaw Gateway"
                maxHeight="300px"
              />
            )}
            <div className="flex gap-2 mt-2">
              <Button variant="secondary" size="sm" onClick={fetchLogs}>
                새로고침
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
