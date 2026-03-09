import React, { useState } from 'react'
import { Card, Button, Alert, Input, Select, Badge, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { useConfig, getNestedValue } from '../../../hooks/useConfig'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'

/**
 * 빠른 설정 — 일반
 *
 * 기획서 5.3: 카드 기반 태스크 뷰.
 * 포트, 로깅, 핫 리로드 등 자주 바꾸는 설정만 모아서 빠르게 편집.
 * Schema View(config/editor)와 달리 카드 형태로 직관적 접근.
 */
export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()
  const { config, loading, saving, error, hasChanges, updateField, save, apply, reset, refresh } = useConfig()
  const [saveSuccess, setSaveSuccess] = useState(false)

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="list" lines={5} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="빠른 설정" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="빠른 설정"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="빠른 설정" variant="disconnected" />
  }

  const handleSave = async () => {
    const ok = await save()
    if (ok) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const handleSaveAndApply = async () => {
    const ok = await save()
    if (ok) {
      await apply()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-text-secondary text-sm">설정을 불러오는 중...</p>
      </div>
    )
  }

  if (!config) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-text-primary mb-6">빠른 설정</h2>
        <Alert variant="error">
          Gateway에 연결되어 있지 않습니다. 먼저 Gateway에 연결해 주세요.
        </Alert>
        <a
          href="/setup/1"
          className="inline-block mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm transition-colors"
        >
          Gateway 연결하기
        </a>
      </div>
    )
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">빠른 설정</h2>
          <p className="text-sm text-text-secondary mt-1">
            자주 변경하는 설정을 빠르게 편집합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="warning" size="sm">변경됨</Badge>
          )}
          <Button variant="secondary" size="sm" onClick={reset} disabled={!hasChanges}>
            초기화
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSave} loading={saving} disabled={!hasChanges}>
            저장
          </Button>
          <Button size="sm" onClick={handleSaveAndApply} loading={saving} disabled={!hasChanges}>
            저장 및 적용
          </Button>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {saveSuccess && <Alert variant="success" className="mb-4">설정이 저장되었습니다</Alert>}

      {/* 원클릭 프리셋 */}
      <Card className="p-4 mb-6">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          🎯 원클릭 프리셋
        </h3>
        <p className="text-xs text-text-secondary mb-3">
          사전 정의된 설정 프리셋을 적용합니다. 현재 설정이 프리셋 값으로 덮어씌워집니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <PresetButton
            icon="🏠"
            name="개발 모드"
            description="디버그 로그 + 핫 리로드 ON"
            onApply={() => {
              updateField('logLevel', 'debug')
              updateField('hotReload', true)
              updateField('gateway.timeout', 300)
            }}
          />
          <PresetButton
            icon="🚀"
            name="운영 모드"
            description="에러 로그 + 핫 리로드 OFF"
            onApply={() => {
              updateField('logLevel', 'warn')
              updateField('hotReload', false)
              updateField('gateway.timeout', 120)
            }}
          />
          <PresetButton
            icon="🔒"
            name="보안 모드"
            description="최소 로그 + 세션 제한"
            onApply={() => {
              updateField('logLevel', 'error')
              updateField('hotReload', false)
              updateField('maxSessions', 10)
              updateField('gateway.timeout', 60)
            }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gateway 포트 */}
        <QuickSettingCard
          title="Gateway 포트"
          description="Gateway WebSocket 서버가 사용할 포트 번호"
          icon="🔌"
        >
          <Input
            type="number"
            value={String(getNestedValue(config, 'gateway.port') ?? 18789)}
            onChange={(e) => updateField('gateway.port', parseInt(e.target.value, 10) || 18789)}
            min={1024}
            max={65535}
            placeholder="18789"
          />
        </QuickSettingCard>

        {/* 로그 레벨 */}
        <QuickSettingCard
          title="로그 레벨"
          description="Gateway 로그 출력 수준을 설정합니다"
          icon="📝"
        >
          <Select
            value={String(getNestedValue(config, 'logging.level') ?? getNestedValue(config, 'logLevel') ?? 'info')}
            onChange={(e) => {
              if (getNestedValue(config, 'logging') !== undefined) {
                updateField('logging.level', e.target.value)
              } else {
                updateField('logLevel', e.target.value)
              }
            }}
            options={[
              { value: 'debug', label: 'Debug — 모든 로그' },
              { value: 'info', label: 'Info — 일반 정보' },
              { value: 'warn', label: 'Warn — 경고만' },
              { value: 'error', label: 'Error — 오류만' },
            ]}
          />
        </QuickSettingCard>

        {/* 핫 리로드 */}
        <QuickSettingCard
          title="핫 리로드"
          description="설정 파일 변경 시 자동으로 다시 로드합니다"
          icon="🔄"
        >
          <ToggleSwitch
            value={Boolean(getNestedValue(config, 'hotReload') ?? getNestedValue(config, 'gateway.hotReload') ?? false)}
            onChange={(v) => {
              if (getNestedValue(config, 'gateway.hotReload') !== undefined) {
                updateField('gateway.hotReload', v)
              } else {
                updateField('hotReload', v)
              }
            }}
          />
        </QuickSettingCard>

        {/* 하트비트 */}
        <QuickSettingCard
          title="하트비트"
          description="Gateway 상태를 주기적으로 체크합니다"
          icon="💓"
        >
          <div className="flex items-center gap-3">
            <ToggleSwitch
              value={Boolean(getNestedValue(config, 'heartbeat.enabled') ?? false)}
              onChange={(v) => updateField('heartbeat.enabled', v)}
            />
            {Boolean(getNestedValue(config, 'heartbeat.enabled')) && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={String(getNestedValue(config, 'heartbeat.interval') ?? 30)}
                  onChange={(e) => updateField('heartbeat.interval', parseInt(e.target.value, 10) || 30)}
                  min={5}
                  max={3600}
                  className="w-20"
                />
                <span className="text-xs text-text-secondary">초</span>
              </div>
            )}
          </div>
        </QuickSettingCard>

        {/* 최대 세션 수 */}
        <QuickSettingCard
          title="최대 세션"
          description="동시 접속 가능한 최대 세션 수를 제한합니다"
          icon="👥"
        >
          <Input
            type="number"
            value={String(getNestedValue(config, 'gateway.maxSessions') ?? getNestedValue(config, 'maxSessions') ?? 100)}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10) || 100
              if (getNestedValue(config, 'gateway.maxSessions') !== undefined) {
                updateField('gateway.maxSessions', v)
              } else {
                updateField('maxSessions', v)
              }
            }}
            min={1}
            max={10000}
            placeholder="100"
          />
        </QuickSettingCard>

        {/* 응답 타임아웃 */}
        <QuickSettingCard
          title="응답 타임아웃"
          description="LLM 응답 대기 최대 시간 (초)"
          icon="⏱"
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={String(getNestedValue(config, 'timeout') ?? getNestedValue(config, 'gateway.timeout') ?? 120)}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || 120
                if (getNestedValue(config, 'gateway.timeout') !== undefined) {
                  updateField('gateway.timeout', v)
                } else {
                  updateField('timeout', v)
                }
              }}
              min={10}
              max={600}
              placeholder="120"
            />
            <span className="text-xs text-text-secondary">초</span>
          </div>
        </QuickSettingCard>

        {/* 기본 모델 */}
        <QuickSettingCard
          title="기본 모델"
          description="에이전트가 사용할 기본 LLM 모델"
          icon="🤖"
        >
          <Input
            value={String(getNestedValue(config, 'model') ?? getNestedValue(config, 'models.default') ?? '')}
            onChange={(e) => {
              if (getNestedValue(config, 'models') !== undefined) {
                updateField('models.default', e.target.value)
              } else {
                updateField('model', e.target.value)
              }
            }}
            placeholder="예: gpt-4o, claude-3-sonnet"
          />
        </QuickSettingCard>

        {/* API 키 */}
        <QuickSettingCard
          title="API 키"
          description="LLM 서비스 API 키 (마스킹됨)"
          icon="🔑"
        >
          <Input
            type="password"
            value={String(getNestedValue(config, 'apiKey') ?? getNestedValue(config, 'api.key') ?? '')}
            onChange={(e) => {
              if (getNestedValue(config, 'api.key') !== undefined) {
                updateField('api.key', e.target.value)
              } else {
                updateField('apiKey', e.target.value)
              }
            }}
            placeholder="sk-..."
          />
        </QuickSettingCard>
      </div>

      {/* 하단 안내 */}
      <div className="mt-6 p-4 bg-bg-secondary rounded-lg">
        <p className="text-sm text-text-secondary">
          💡 더 세부적인 설정이 필요하면{' '}
          <a href="/config/editor" className="text-accent hover:underline">
            전체 설정 편집기
          </a>
          를 이용하세요.
        </p>
      </div>
    </div>
  )
}

// ─── 서브 컴포넌트 ───

function QuickSettingCard({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary text-sm">{title}</h3>
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        </div>
      </div>
      <div className="pl-8">{children}</div>
    </Card>
  )
}

function PresetButton({
  icon,
  name,
  description,
  onApply,
}: {
  icon: string
  name: string
  description: string
  onApply: () => void
}) {
  const [applied, setApplied] = useState(false)

  const handleApply = () => {
    onApply()
    setApplied(true)
    setTimeout(() => setApplied(false), 2000)
  }

  return (
    <button
      onClick={handleApply}
      className={`text-left p-3 rounded-lg border transition-all ${
        applied
          ? 'bg-success/10 border-success/30'
          : 'bg-bg-secondary border-transparent hover:border-accent/30 hover:bg-border'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{applied ? '\u2705' : icon}</span>
        <span className="text-sm font-medium text-text-primary">{name}</span>
      </div>
      <p className="text-[10px] text-text-secondary pl-7">
        {applied ? '프리셋 적용됨 — 저장하세요' : description}
      </p>
    </button>
  )
}

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        value ? 'bg-accent' : 'bg-border'
      }`}
      role="switch"
      aria-checked={value}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
          value ? 'left-5' : 'left-0.5'
        }`}
      />
    </button>
  )
}
