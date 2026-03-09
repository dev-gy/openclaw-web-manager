import React, { useState } from 'react'
import { Card, Badge, Alert, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'

export default function Page() {
  const { isConnected, isLoading, status } = useConnectionStatus()

  // ─── 연결 상태 게이트 ───
  if (isLoading) {
    return <LoadingSkeleton variant="grid" lines={6} />
  }
  if (!status.config && !status.lastError) {
    return <SetupRequired pageName="설정" variant="setup" />
  }
  if (!status.config && status.lastError) {
    return <SetupRequired pageName="설정" variant="error" errorMessage={status.lastError} onRetry={() => window.location.reload()} />
  }

  const isDisconnected = status.config && !isConnected

  return (
    <div>
      {/* 연결 끊김 경고 배너 */}
      {isDisconnected && (
        <Alert variant="warning" title="Gateway 연결이 끊어졌습니다" className="mb-6">
          설정을 편집하려면 Gateway에 다시 연결해야 합니다.{' '}
          <a href="/server/connection" className="underline font-medium">재연결 설정</a>
        </Alert>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">⚙️ 기지 설정</h2>
          <p className="text-sm text-text-secondary mt-1">
            에이전트의 장비, 스킬, 주문서를 관리하세요
          </p>
        </div>
        {isConnected ? (
          <Badge variant="success">Gateway 연결됨</Badge>
        ) : (
          <Badge variant="error">Gateway 연결 안됨</Badge>
        )}
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4${isDisconnected ? ' opacity-50 pointer-events-none' : ''}`}>
        <ConfigCard
          title="⚡ 빠른 설정"
          desc="포트, 로그 레벨, 핫 리로드 등 자주 바꾸는 설정"
          href="/config/quick"
          icon="⚡"
          badge="퀵메뉴"
        />
        <ConfigCard
          title="📡 채널 관리"
          desc="Discord, Slack, Telegram 등 통신 채널 개통"
          href="/config/channels"
          icon="📡"
          badge="통신"
        />
        <ConfigCard
          title="🎮 캐릭터 시트"
          desc="에이전트 프로필, 스탯, 성격 설정"
          href="/config/agents"
          icon="🎮"
          badge="RPG"
        />
        <ConfigCard
          title="🎒 스킬 인벤토리"
          desc="도구 장착/해제, 스킬 프로필, 실행 보안"
          href="/config/approvals"
          icon="🎒"
          badge="RPG"
        />
        <ConfigCard
          title="📜 스펠북"
          desc="시스템 프롬프트 라이브러리 — 주문서 선택 & 장착"
          href="/config/prompts"
          icon="📜"
          badge="RPG"
        />
        <ConfigCard
          title="🛡️ 성벽 방어"
          desc="토큰, CORS, Rate Limit, IP 화이트리스트 관리"
          href="/config/security"
          icon="🛡️"
          badge="보안"
        />
        <ConfigCard
          title="📝 전체 편집기"
          desc="openclaw.json 전체 스키마 기반 고급 편집"
          href="/config/editor"
          icon="📝"
          badge="고급"
        />
        <ConfigCard
          title="💾 스냅샷"
          desc="설정 변경 이력 관리 및 이전 버전 복원"
          href="/config/snapshots"
          icon="💾"
          badge="백업"
        />
      </div>

      {/* 관계도 — 연결 끊김 시 숨김 */}
      {!isDisconnected && <ConfigRelationMap />}
    </div>
  )
}

function ConfigCard({
  title,
  desc,
  href,
  icon,
  badge,
}: {
  title: string
  desc: string
  href: string
  icon: string
  badge?: string
}) {
  return (
    <a href={href} className="block group">
      <Card className="p-5 hover:border-accent/30 transition-all cursor-pointer group-hover:shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-text-primary">{title}</h3>
            <p className="text-sm text-text-secondary mt-1">{desc}</p>
          </div>
          {badge && (
            <span className="flex-shrink-0 px-1.5 py-0.5 bg-bg-secondary text-[10px] text-text-secondary rounded font-medium">
              {badge}
            </span>
          )}
        </div>
      </Card>
    </a>
  )
}

// ─── 설정 관계도 ───

const relations = [
  {
    from: '📡 채널',
    to: '🎮 에이전트',
    label: '채널에 에이전트 할당',
    color: 'text-blue-400',
  },
  {
    from: '🎮 에이전트',
    to: '📜 스펠북',
    label: '프롬프트 장착',
    color: 'text-purple-400',
  },
  {
    from: '🎮 에이전트',
    to: '🎒 스킬',
    label: '도구 장착/해제',
    color: 'text-green-400',
  },
  {
    from: '⚡ 빠른 설정',
    to: '📡 채널',
    label: '포트/로그 레벨 적용',
    color: 'text-yellow-400',
  },
  {
    from: '📝 전체 편집기',
    to: '💾 스냅샷',
    label: '변경 전 자동 백업',
    color: 'text-gray-400',
  },
  {
    from: '🛡️ 보안',
    to: '📡 채널',
    label: '토큰/CORS 보호',
    color: 'text-red-400',
  },
]

function ConfigRelationMap() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-3"
      >
        <span>{expanded ? '▼' : '▶'}</span>
        <span className="font-medium">🗺️ 설정 관계도</span>
        <span className="text-xs text-text-secondary">— 각 설정이 어떻게 연결되는지 확인</span>
      </button>

      {expanded && (
        <Card className="p-5 overflow-hidden">
          <div className="flex flex-col items-center gap-1">
            {/* 흐름 다이어그램 — 텍스트 기반 */}
            <div className="w-full">
              {/* 메인 플로우: 채널 → 에이전트 → 스킬/프롬프트 */}
              <div className="flex flex-col lg:flex-row items-stretch gap-4">
                {/* 좌측: 인프라 */}
                <div className="flex-1 space-y-3">
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    🏗️ 인프라 계층
                  </h4>
                  <RelationNode
                    icon="⚡"
                    title="빠른 설정"
                    desc="포트, 로그, 핫리로드"
                    href="/config/quick"
                    highlight="yellow"
                  />
                  <FlowArrow label="환경 설정 적용" />
                  <RelationNode
                    icon="🛡️"
                    title="보안 설정"
                    desc="토큰, CORS, Rate Limit"
                    href="/config/security"
                    highlight="red"
                  />
                  <FlowArrow label="보안 정책 적용" />
                  <RelationNode
                    icon="📡"
                    title="채널 관리"
                    desc="통신 채널 개통/관리"
                    href="/config/channels"
                    highlight="blue"
                  />
                </div>

                {/* 중앙: 에이전트 (핵심) */}
                <div className="flex-1 space-y-3">
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    🎯 에이전트 계층
                  </h4>
                  <RelationNode
                    icon="🎮"
                    title="캐릭터 시트"
                    desc="프로필, 스탯, 성격"
                    href="/config/agents"
                    highlight="purple"
                    primary
                  />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <FlowArrow label="스킬 장착" />
                      <RelationNode
                        icon="🎒"
                        title="스킬"
                        desc="도구 장착/해제"
                        href="/config/approvals"
                        highlight="green"
                      />
                    </div>
                    <div className="flex-1">
                      <FlowArrow label="주문서 세팅" />
                      <RelationNode
                        icon="📜"
                        title="스펠북"
                        desc="프롬프트 장착"
                        href="/config/prompts"
                        highlight="orange"
                      />
                    </div>
                  </div>
                </div>

                {/* 우측: 도구 */}
                <div className="flex-1 space-y-3">
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    🔧 관리 도구
                  </h4>
                  <RelationNode
                    icon="📝"
                    title="전체 편집기"
                    desc="JSON 스키마 고급 편집"
                    href="/config/editor"
                    highlight="gray"
                  />
                  <FlowArrow label="자동 백업" />
                  <RelationNode
                    icon="💾"
                    title="스냅샷"
                    desc="변경 이력/복원"
                    href="/config/snapshots"
                    highlight="gray"
                  />
                </div>
              </div>

              {/* 관계 범례 */}
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex flex-wrap gap-3">
                  {relations.map((r) => (
                    <span key={r.label} className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                      <span className={r.color}>●</span>
                      <span>{r.from} → {r.to}: {r.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function RelationNode({
  icon,
  title,
  desc,
  href,
  highlight,
  primary,
}: {
  icon: string
  title: string
  desc: string
  href: string
  highlight: string
  primary?: boolean
}) {
  const borderColor = {
    yellow: 'border-yellow-500/30 hover:border-yellow-500/60',
    blue: 'border-blue-500/30 hover:border-blue-500/60',
    purple: 'border-purple-500/30 hover:border-purple-500/60',
    green: 'border-green-500/30 hover:border-green-500/60',
    orange: 'border-orange-500/30 hover:border-orange-500/60',
    red: 'border-red-500/30 hover:border-red-500/60',
    gray: 'border-gray-500/30 hover:border-gray-500/60',
  }[highlight] || 'border-border'

  return (
    <a
      href={href}
      className={`block p-3 rounded-lg border ${borderColor} bg-bg-secondary/50 hover:bg-bg-secondary transition-all ${
        primary ? 'ring-1 ring-accent/20' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <p className={`text-sm font-medium text-text-primary ${primary ? 'text-accent' : ''}`}>
            {title}
          </p>
          <p className="text-xs text-text-secondary">{desc}</p>
        </div>
      </div>
    </a>
  )
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 pl-4">
      <span className="text-text-secondary text-xs">↓</span>
      <span className="text-xs text-text-secondary italic">{label}</span>
    </div>
  )
}
