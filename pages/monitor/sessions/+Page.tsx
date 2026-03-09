import React, { useState } from 'react'
import { Card, Badge, Button, Alert, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { useSessions, type Session } from '../../../hooks/useSessions'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'
import { formatRelative, formatDuration } from '../../../lib/format'

export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()
  const { sessions, loading, error, refresh, killSession } = useSessions()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [killingId, setKillingId] = useState<string | null>(null)
  const [confirmKillId, setConfirmKillId] = useState<string | null>(null)

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="list" lines={5} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="세션 관리" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="세션 관리"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="세션 관리" variant="disconnected" />
  }

  const handleKill = async (id: string) => {
    setKillingId(id)
    await killSession(id)
    setKillingId(null)
    setConfirmKillId(null)
    if (selectedId === id) setSelectedId(null)
  }

  const selected = sessions.find((s) => s.id === selectedId) || null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">세션 관리</h2>
          <p className="text-sm text-text-secondary mt-1">
            활성 세션 {sessions.length}개
          </p>
        </div>
        <Button variant="secondary" onClick={refresh} size="sm">
          새로고침
        </Button>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 세션 목록 */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-[1fr_100px_80px_100px_60px] gap-2 px-4 py-2.5 bg-bg-secondary border-b border-border text-xs font-medium text-text-secondary uppercase tracking-wider">
              <span>세션</span>
              <span>플랫폼</span>
              <span>메시지</span>
              <span>활동</span>
              <span></span>
            </div>

            {/* 세션 행 */}
            {loading && sessions.length === 0 ? (
              <div className="py-12 text-center text-text-secondary text-sm">
                세션 정보를 불러오는 중...
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-text-secondary text-sm">활성 세션이 없습니다</p>
                <p className="text-text-secondary text-xs mt-1">
                  Gateway에 연결된 사용자가 있으면 여기에 표시됩니다
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isSelected={selectedId === session.id}
                    isKilling={killingId === session.id}
                    isConfirmKill={confirmKillId === session.id}
                    onSelect={() => setSelectedId(selectedId === session.id ? null : session.id)}
                    onKillRequest={() => setConfirmKillId(session.id)}
                    onKillConfirm={() => handleKill(session.id)}
                    onKillCancel={() => setConfirmKillId(null)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 세션 상세 패널 */}
        <div>
          {selected ? (
            <SessionDetailPanel
              session={selected}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <Card className="p-6">
              <p className="text-sm text-text-secondary text-center py-8">
                세션을 선택하면 상세 정보가 표시됩니다
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 세션 행 ───

function SessionRow({
  session,
  isSelected,
  isKilling,
  isConfirmKill,
  onSelect,
  onKillRequest,
  onKillConfirm,
  onKillCancel,
}: {
  session: Session
  isSelected: boolean
  isKilling: boolean
  isConfirmKill: boolean
  onSelect: () => void
  onKillRequest: () => void
  onKillConfirm: () => void
  onKillCancel: () => void
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_100px_80px_100px_60px] gap-2 px-4 py-3 cursor-pointer transition-colors ${
        isSelected ? 'bg-accent/5' : 'hover:bg-bg-secondary'
      }`}
      onClick={onSelect}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
          <a
            href={`/monitor/sessions/${session.id}`}
            className="text-sm text-text-primary truncate font-mono hover:text-accent transition-colors"
            onClick={(e) => e.stopPropagation()}
            title="세션 상세 보기"
          >
            {session.id.slice(0, 12)}...
          </a>
        </div>
        {session.userName && (
          <p className="text-xs text-text-secondary mt-0.5 truncate pl-4">
            {session.userName}
          </p>
        )}
      </div>

      <div className="flex items-center">
        <Badge variant={getPlatformVariant(session.platform)} size="sm">
          {session.platform}
        </Badge>
      </div>

      <div className="flex items-center text-sm text-text-primary font-mono">
        {session.messageCount}
      </div>

      <div className="flex items-center text-xs text-text-secondary">
        {formatRelative(session.lastActivity)}
      </div>

      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        {isConfirmKill ? (
          <div className="flex gap-1">
            <button
              onClick={onKillConfirm}
              disabled={isKilling}
              className="text-xs text-error hover:text-error/80 font-medium"
            >
              {isKilling ? '...' : '확인'}
            </button>
            <button
              onClick={onKillCancel}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={onKillRequest}
            className="text-xs text-text-secondary hover:text-error transition-colors"
            title="세션 종료"
          >
            종료
          </button>
        )}
      </div>
    </div>
  )
}

// ─── 세션 상세 패널 ───

function SessionDetailPanel({
  session,
  onClose,
}: {
  session: Session
  onClose: () => void
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          세션 상세
        </h3>
        <button
          onClick={onClose}
          className="text-text-secondary hover:text-text-primary text-xs"
        >
          닫기
        </button>
      </div>

      <div className="space-y-3">
        <DetailRow label="세션 ID" value={session.id} mono />
        <DetailRow label="플랫폼" value={session.platform} />
        <DetailRow label="채널" value={session.channel || '—'} />
        {session.userName && (
          <DetailRow label="사용자" value={session.userName} />
        )}
        {session.userId && (
          <DetailRow label="사용자 ID" value={session.userId} mono />
        )}
        <DetailRow label="메시지 수" value={String(session.messageCount)} />
        <DetailRow
          label="시작 시간"
          value={new Date(session.startedAt).toLocaleString('ko-KR')}
        />
        <DetailRow
          label="마지막 활동"
          value={formatRelative(session.lastActivity)}
        />
        <DetailRow
          label="세션 지속"
          value={formatDuration(Date.now() - session.startedAt, true)}
        />
      </div>

      {session.metadata && Object.keys(session.metadata).length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-xs font-medium text-text-secondary mb-2">메타데이터</h4>
          <pre className="text-xs text-text-primary bg-bg-secondary rounded-lg p-2 overflow-x-auto font-mono">
            {JSON.stringify(session.metadata, null, 2)}
          </pre>
        </div>
      )}

      {/* 전체 보기 링크 */}
      <div className="mt-4 pt-4 border-t border-border">
        <a
          href={`/monitor/sessions/${session.id}`}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-accent/10 hover:bg-accent/20 text-accent text-sm rounded-lg transition-colors font-medium"
        >
          🗺️ 탐사 보고서 전체 보기
        </a>
      </div>

      {/* 컨텍스트 액션 */}
      <div className="mt-3 pt-3 border-t border-border">
        <h4 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">액션</h4>
        <div className="flex flex-col gap-1.5">
          {session.channel && (
            <ActionLink href="/config/channels" icon="📡" label={`${session.channel} 채널 설정`} />
          )}
          <ActionLink href="/config/agents" icon="🎮" label="에이전트 설정 보기" />
          <ActionLink href="/monitor/logs" icon="📜" label="로그에서 확인" />
          <ActionLink href="/monitor/agents" icon="🏢" label="오피스에서 보기" />
        </div>
      </div>
    </Card>
  )
}

function ActionLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 px-2.5 py-1.5 bg-bg-secondary hover:bg-border rounded-lg text-xs text-text-primary transition-colors"
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span className="ml-auto text-text-secondary">&rarr;</span>
    </a>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className={`text-text-primary ${mono ? 'font-mono text-xs' : ''} text-right max-w-[60%] truncate`}>
        {value}
      </span>
    </div>
  )
}

// ─── 유틸 ───

function getPlatformVariant(platform: string): 'success' | 'info' | 'warning' | 'neutral' {
  const map: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
    discord: 'info',
    slack: 'success',
    telegram: 'info',
    kakao: 'warning',
    web: 'neutral',
  }
  return map[platform.toLowerCase()] || 'neutral'
}

// formatRelative, formatDuration은 lib/format.ts 에서 import
