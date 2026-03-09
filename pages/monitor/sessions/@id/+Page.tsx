import React, { useState, useEffect } from 'react'
import { usePageContext } from 'vike-react/usePageContext'
import { Card, Badge, Button, Alert, LoadingSkeleton, SetupRequired } from '../../../../components/ui'
import { useSessions, type SessionDetail, type SessionMessage } from '../../../../hooks/useSessions'
import { useConnectionStatus } from '../../../../hooks/useConnectionStatus'
import { formatRelative, formatDuration, formatTime } from '../../../../lib/format'

/**
 * 세션 상세 페이지
 *
 * /monitor/sessions/:id → 개별 세션 정보, 메시지 이력, 메타데이터 등
 * 게임 UI 컨셉: "던전 탐사 보고서" 스타일
 */
export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()
  const { routeParams } = usePageContext()
  const sessionId = routeParams?.id || ''
  const { getSession, killSession } = useSessions()

  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [killing, setKilling] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    getSession(sessionId).then((s) => {
      if (s) {
        setSession(s)
      } else {
        setError('세션을 찾을 수 없습니다')
      }
      setLoading(false)
    })
  }, [sessionId, getSession])

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="block" lines={1} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="세션 상세" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="세션 상세"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="세션 상세" variant="disconnected" />
  }

  const handleKill = async () => {
    setKilling(true)
    const ok = await killSession(sessionId)
    setKilling(false)
    if (ok) {
      setSession(null)
      setError('세션이 종료되었습니다')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-secondary">세션 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error && !session) {
    return (
      <div>
        <BackLink />
        <Alert variant="error" className="mt-4">{error}</Alert>
      </div>
    )
  }

  if (!session) {
    return (
      <div>
        <BackLink />
        <Card className="p-8 text-center mt-4">
          <p className="text-text-secondary text-sm">세션 정보가 없습니다</p>
        </Card>
      </div>
    )
  }

  const duration = Date.now() - session.startedAt

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <BackLink />
          <h2 className="text-2xl font-bold text-text-primary mt-2">
            🗺️ 탐사 보고서
          </h2>
          <p className="text-sm text-text-secondary mt-1 font-mono">
            세션 {session.id.slice(0, 16)}...
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm">활성</Badge>
          <Badge variant={getPlatformVariant(session.platform)} size="sm">
            {session.platform}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 좌측: 세션 정보 카드 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 기본 정보 */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
              ⚔️ 탐사 개요
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="메시지" value={String(session.messageCount)} icon="💬" />
              <StatBox label="지속 시간" value={formatDuration(duration, true)} icon="⏱️" />
              <StatBox label="플랫폼" value={session.platform} icon="📡" />
              <StatBox label="마지막 활동" value={formatRelative(session.lastActivity)} icon="🔔" />
            </div>
          </Card>

          {/* 상세 정보 테이블 */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
              📋 상세 정보
            </h3>
            <div className="space-y-2.5">
              <InfoRow label="세션 ID" value={session.id} mono />
              <InfoRow label="채널" value={session.channel || '—'} />
              {session.userName && <InfoRow label="사용자" value={session.userName} />}
              {session.userId && <InfoRow label="사용자 ID" value={session.userId} mono />}
              <InfoRow
                label="시작 시간"
                value={new Date(session.startedAt).toLocaleString('ko-KR')}
              />
              <InfoRow
                label="마지막 활동"
                value={new Date(session.lastActivity).toLocaleString('ko-KR')}
              />
            </div>
          </Card>

          {/* 메시지 이력 */}
          {session.messages && session.messages.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
                💬 대화 이력 ({session.messages.length}건)
              </h3>
              <div className="space-y-2 max-h-96 overflow-auto">
                {session.messages.map((msg, i) => (
                  <MessageBubble key={i} message={msg} />
                ))}
              </div>
            </Card>
          )}

          {/* 메타데이터 */}
          {session.metadata && Object.keys(session.metadata).length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
                🔧 메타데이터
              </h3>
              <pre className="text-xs text-text-primary bg-bg-secondary rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
                {JSON.stringify(session.metadata, null, 2)}
              </pre>
            </Card>
          )}

          {/* 컨텍스트 */}
          {session.context && Object.keys(session.context).length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
                🧠 세션 컨텍스트
              </h3>
              <pre className="text-xs text-text-primary bg-bg-secondary rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
                {JSON.stringify(session.context, null, 2)}
              </pre>
            </Card>
          )}
        </div>

        {/* 우측: 액션 패널 */}
        <div className="space-y-4">
          {/* 퀵 액션 */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              액션
            </h3>
            <div className="space-y-1.5">
              {session.channel && (
                <ActionLink href="/config/channels" icon="📡" label={`${session.channel} 채널 설정`} />
              )}
              <ActionLink href="/config/agents" icon="🎮" label="에이전트 설정 보기" />
              <ActionLink href="/monitor/logs" icon="📜" label="로그에서 확인" />
              <ActionLink href="/monitor/agents" icon="🏢" label="오피스에서 보기" />
            </div>

            {/* 세션 종료 */}
            <div className="mt-4 pt-3 border-t border-border">
              {confirmKill ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary flex-1">정말 종료할까요?</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setConfirmKill(false)}
                  >
                    취소
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleKill}
                    loading={killing}
                    className="bg-error hover:bg-error/80 text-white"
                  >
                    종료
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-error hover:text-error"
                  onClick={() => setConfirmKill(true)}
                >
                  ⚠️ 세션 종료
                </Button>
              )}
            </div>
          </Card>

          {/* 타임라인 */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              타임라인
            </h3>
            <div className="space-y-3">
              <TimelineItem
                time={new Date(session.startedAt).toLocaleTimeString('ko-KR')}
                label="세션 시작"
                icon="🟢"
              />
              {session.messageCount > 0 && (
                <TimelineItem
                  time={formatRelative(session.lastActivity)}
                  label={`${session.messageCount}개 메시지 교환`}
                  icon="💬"
                />
              )}
              <TimelineItem
                time={formatDuration(duration, true)}
                label="경과 시간"
                icon="⏱️"
                active
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── 서브 컴포넌트 ───

function BackLink() {
  return (
    <a
      href="/monitor/sessions"
      className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
    >
      <span>←</span>
      <span>세션 목록</span>
    </a>
  )
}

function StatBox({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3 text-center">
      <span className="text-lg">{icon}</span>
      <p className="text-lg font-bold text-text-primary mt-1">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span
        className={`text-sm text-text-primary max-w-[65%] truncate text-right ${mono ? 'font-mono text-xs' : ''}`}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

function MessageBubble({ message }: { message: SessionMessage }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isSystem
            ? 'bg-bg-secondary text-text-secondary italic text-xs'
            : isUser
            ? 'bg-accent/10 text-text-primary'
            : 'bg-bg-secondary text-text-primary'
        }`}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-text-secondary">
            {isUser ? '👤 사용자' : isSystem ? '⚙️ 시스템' : '🤖 에이전트'}
          </span>
          <span className="text-xs text-text-secondary">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
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

function TimelineItem({
  time,
  label,
  icon,
  active,
}: {
  time: string
  label: string
  icon: string
  active?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex-shrink-0 mt-0.5">
        <span className="text-sm">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${active ? 'text-accent font-medium' : 'text-text-primary'}`}>
          {label}
        </p>
        <p className="text-xs text-text-secondary">{time}</p>
      </div>
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
