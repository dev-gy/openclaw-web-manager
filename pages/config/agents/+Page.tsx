import React, { useState } from 'react'
import { Card, Button, Alert, Badge, Input, AgentAvatar, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { useConfig, getNestedValue } from '../../../hooks/useConfig'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'
import type { AgentState } from '../../../hooks/useAgentActivity'

/**
 * 에이전트 캐릭터 시트 — RPG 스탯 카드 스타일
 *
 * Star-Office-UI 컨셉:
 * - 좌: 아바타 + 기본 프로필
 * - 중앙: 스탯 바 (설정 항목)
 * - 우: 장비 슬롯 (시스템 프롬프트, 도구)
 */
export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()
  const { config, loading, saving, error, hasChanges, updateField, save, apply, reset } = useConfig()
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="grid" lines={3} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="캐릭터 시트" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="캐릭터 시트"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="캐릭터 시트" variant="disconnected" />
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
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-text-secondary text-sm ml-3">캐릭터 시트를 불러오는 중...</p>
      </div>
    )
  }

  if (!config) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-text-primary mb-6">🎮 캐릭터 시트</h2>
        <Alert variant="error">Gateway에 연결되어 있지 않습니다.</Alert>
      </div>
    )
  }

  // 설정값 추출
  const agentName = String(getNestedValue(config, 'agent.name') ?? getNestedValue(config, 'identity.name') ?? 'Agent')
  const agentRole = String(getNestedValue(config, 'agent.role') ?? getNestedValue(config, 'identity.role') ?? '')
  const agentPersonality = String(getNestedValue(config, 'agent.personality') ?? getNestedValue(config, 'identity.personality') ?? '')
  const systemPrompt = String(getNestedValue(config, 'agent.systemPrompt') ?? getNestedValue(config, 'systemPrompt') ?? '')
  const tools = (getNestedValue(config, 'tools') ?? getNestedValue(config, 'agent.tools') ?? []) as unknown[]
  const model = String(getNestedValue(config, 'model') ?? getNestedValue(config, 'agent.model') ?? '')
  const maxTokens = Number(getNestedValue(config, 'maxTokens') ?? getNestedValue(config, 'agent.maxTokens') ?? 0)
  const temperature = Number(getNestedValue(config, 'temperature') ?? getNestedValue(config, 'agent.temperature') ?? 0)

  // 아바타 시드 (이름에서)
  const avatarSeed = hashStr(agentName)
  const toolCount = Array.isArray(tools) ? tools.length : 0
  const promptLength = systemPrompt.length

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">🎮 캐릭터 시트</h2>
          <p className="text-sm text-text-secondary mt-1">RPG 스타일 에이전트 프로필 관리</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && <Badge variant="warning" size="sm">변경됨</Badge>}
          {saveSuccess && <Badge variant="success" size="sm">저장됨</Badge>}
          <Button variant="secondary" size="sm" onClick={reset} disabled={!hasChanges}>되돌리기</Button>
          <Button size="sm" onClick={handleSaveAndApply} loading={saving} disabled={!hasChanges}>
            저장 및 적용
          </Button>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {/* ─── 캐릭터 카드 (RPG 시트 레이아웃) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* 좌측: 아바타 + 기본 프로필 (3칸) */}
        <div className="lg:col-span-3 space-y-4">
          {/* 아바타 카드 */}
          <Card className="p-5 text-center relative overflow-hidden">
            {/* 배경 그라디언트 */}
            <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
            <div className="relative">
              <div className="flex justify-center mb-3">
                <AgentAvatar
                  seed={avatarSeed}
                  state="working"
                  name={agentName}
                  size="lg"
                />
              </div>
              <EditableText
                value={agentName}
                isEditing={editingField === 'name'}
                onStartEdit={() => setEditingField('name')}
                onEndEdit={(v) => {
                  const path = getNestedValue(config, 'agent.name') !== undefined ? 'agent.name' : 'identity.name'
                  updateField(path, v)
                  setEditingField(null)
                }}
                className="text-lg font-bold text-text-primary"
                placeholder="에이전트 이름"
              />
              <EditableText
                value={agentRole}
                isEditing={editingField === 'role'}
                onStartEdit={() => setEditingField('role')}
                onEndEdit={(v) => {
                  const path = getNestedValue(config, 'agent.role') !== undefined ? 'agent.role' : 'identity.role'
                  updateField(path, v)
                  setEditingField(null)
                }}
                className="text-sm text-text-secondary mt-1"
                placeholder="역할 (예: 도우미)"
              />
            </div>

            {/* 레벨/클래스 */}
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>CLASS</span>
                <span className="font-mono text-text-primary">{agentRole || '미정'}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-text-secondary mt-1">
                <span>SKILLS</span>
                <span className="font-mono text-text-primary">{toolCount}</span>
              </div>
            </div>
          </Card>

          {/* 성격 카드 */}
          <Card className="p-4">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>🧠</span> PERSONALITY
            </h4>
            <textarea
              value={agentPersonality}
              onChange={(e) => {
                const path = getNestedValue(config, 'agent.personality') !== undefined ? 'agent.personality' : 'identity.personality'
                updateField(path, e.target.value)
              }}
              placeholder="캐릭터의 성격..."
              rows={4}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded-md text-xs text-text-primary focus:outline-none focus:ring-1 focus:border-accent focus:ring-accent/30 resize-y"
            />
          </Card>
        </div>

        {/* 중앙: 스탯 바 (5칸) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 스탯 패널 */}
          <Card className="p-5">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-1">
              <span>📊</span> STATS
            </h3>
            <div className="space-y-4">
              <StatBar
                label="PROMPT POWER"
                description="시스템 프롬프트 길이"
                value={Math.min(100, Math.floor(promptLength / 20))}
                displayValue={`${promptLength} chars`}
                color="from-purple-500 to-pink-500"
              />
              <StatBar
                label="SKILL SLOTS"
                description="장착 도구 수"
                value={Math.min(100, toolCount * 10)}
                displayValue={`${toolCount}개`}
                color="from-amber-500 to-orange-500"
              />
              <StatBar
                label="MODEL TIER"
                description={model || '미설정'}
                value={getModelTier(model)}
                displayValue={model || '—'}
                color="from-blue-500 to-cyan-500"
              />
              <StatBar
                label="MAX TOKENS"
                description="최대 응답 길이"
                value={Math.min(100, maxTokens > 0 ? Math.floor((maxTokens / 8192) * 100) : 0)}
                displayValue={maxTokens > 0 ? String(maxTokens) : '기본값'}
                color="from-green-500 to-emerald-500"
              />
              <StatBar
                label="TEMPERATURE"
                description="창의성 수준"
                value={Math.floor(temperature * 100)}
                displayValue={temperature > 0 ? temperature.toFixed(1) : '기본값'}
                color="from-red-500 to-yellow-500"
              />
            </div>
          </Card>

          {/* 모델 설정 */}
          <Card className="p-4">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-1">
              <span>⚙️</span> ATTRIBUTES
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-text-secondary uppercase mb-1">Model</label>
                <Input
                  value={model}
                  onChange={(e) => {
                    const path = getNestedValue(config, 'model') !== undefined ? 'model' : 'agent.model'
                    updateField(path, e.target.value)
                  }}
                  placeholder="gpt-4, claude-3..."
                  className="text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-text-secondary uppercase mb-1">Max Tokens</label>
                <Input
                  type="number"
                  value={maxTokens > 0 ? String(maxTokens) : ''}
                  onChange={(e) => {
                    const path = getNestedValue(config, 'maxTokens') !== undefined ? 'maxTokens' : 'agent.maxTokens'
                    updateField(path, Number(e.target.value) || 0)
                  }}
                  placeholder="4096"
                  className="text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-text-secondary uppercase mb-1">Temperature</label>
                <Input
                  type="number"
                  value={temperature > 0 ? String(temperature) : ''}
                  onChange={(e) => {
                    const path = getNestedValue(config, 'temperature') !== undefined ? 'temperature' : 'agent.temperature'
                    updateField(path, parseFloat(e.target.value) || 0)
                  }}
                  placeholder="0.7"
                  className="text-xs font-mono"
                  step="0.1"
                  min="0"
                  max="2"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* 우측: 장비 슬롯 (4칸) */}
        <div className="lg:col-span-4 space-y-4">
          {/* 장비 1: 시스템 프롬프트 */}
          <Card className="p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-2 py-1 bg-accent/10 text-accent text-[9px] font-semibold uppercase rounded-bl-lg">
              Main Equipment
            </div>
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>📜</span> SYSTEM PROMPT
            </h4>
            <textarea
              value={systemPrompt}
              onChange={(e) => {
                const path = getNestedValue(config, 'agent.systemPrompt') !== undefined ? 'agent.systemPrompt' : 'systemPrompt'
                updateField(path, e.target.value)
              }}
              placeholder="에이전트의 핵심 지시사항..."
              rows={8}
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded-md text-xs text-text-primary font-mono focus:outline-none focus:ring-1 focus:border-accent focus:ring-accent/30 resize-y"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-text-secondary">{promptLength} characters</span>
              <Badge variant={promptLength > 500 ? 'success' : promptLength > 0 ? 'warning' : 'neutral'} size="sm">
                {promptLength > 500 ? '강력' : promptLength > 0 ? '기본' : '비어있음'}
              </Badge>
            </div>
          </Card>

          {/* 장비 2: 스킬 슬롯 (도구) */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1">
                <span>⚔️</span> SKILL SLOTS
              </h4>
              <Badge variant="info" size="sm">{toolCount}개 장착</Badge>
            </div>

            {toolCount > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {(tools as any[]).map((tool, i) => {
                  const name = typeof tool === 'string' ? tool : tool?.name || tool?.type || `스킬 ${i + 1}`
                  const isActive = typeof tool === 'object' ? tool?.enabled !== false : true
                  return (
                    <div
                      key={i}
                      className={`
                        px-2.5 py-2 rounded-lg border text-center transition-all
                        ${isActive
                          ? 'bg-gradient-to-b from-accent/5 to-accent/10 border-accent/20 hover:border-accent/40'
                          : 'bg-bg-secondary border-border opacity-50'
                        }
                      `}
                      title={name}
                    >
                      <div className="text-base mb-1">{getToolIcon(name)}</div>
                      <span className="text-[10px] font-mono text-text-primary block truncate">
                        {name}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-text-secondary/50">
                <div className="text-2xl mb-2">🎒</div>
                <span className="text-xs">장착된 스킬 없음</span>
              </div>
            )}

            <a
              href="/config/approvals"
              className="block mt-3 text-center text-xs text-accent hover:underline"
            >
              스킬 인벤토리에서 관리 →
            </a>
          </Card>

          {/* 링크 */}
          <div className="p-3 bg-bg-secondary rounded-lg text-xs text-text-secondary space-y-1">
            <p>📂 <a href="/config" className="text-accent hover:underline">설정 홈</a> — IDENTITY.md 직접 편집</p>
            <p>📝 <a href="/config/editor" className="text-accent hover:underline">전체 편집기</a> — JSON 원시 편집</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 서브 컴포넌트 ───

/** RPG 스탯 바 */
function StatBar({
  label,
  description,
  value,
  displayValue,
  color,
}: {
  label: string
  description: string
  value: number
  displayValue: string
  color: string
}) {
  const clampedValue = Math.max(0, Math.min(100, value))

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-xs font-semibold text-text-primary">{label}</span>
          <span className="text-[10px] text-text-secondary ml-2">{description}</span>
        </div>
        <span className="text-xs font-mono text-text-primary">{displayValue}</span>
      </div>
      <div className="h-2.5 bg-bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  )
}

/** 클릭하면 편집 가능한 텍스트 */
function EditableText({
  value,
  isEditing,
  onStartEdit,
  onEndEdit,
  className,
  placeholder,
}: {
  value: string
  isEditing: boolean
  onStartEdit: () => void
  onEndEdit: (value: string) => void
  className?: string
  placeholder?: string
}) {
  const [text, setText] = useState(value)

  if (isEditing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onEndEdit(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEndEdit(text)
          if (e.key === 'Escape') { setText(value); onEndEdit(value) }
        }}
        className={`bg-transparent border-b border-accent outline-none text-center w-full ${className}`}
        placeholder={placeholder}
      />
    )
  }

  return (
    <div
      onClick={onStartEdit}
      className={`cursor-pointer hover:opacity-70 transition-opacity ${className}`}
      title="클릭하여 편집"
    >
      {value || <span className="text-text-secondary/50 italic">{placeholder}</span>}
    </div>
  )
}

// ─── 유틸 ───

function hashStr(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

function getModelTier(model: string): number {
  const m = model.toLowerCase()
  if (m.includes('gpt-4') || m.includes('claude-3') || m.includes('opus')) return 90
  if (m.includes('gpt-3.5') || m.includes('sonnet') || m.includes('haiku')) return 60
  if (m.includes('gemini')) return 70
  if (m) return 50
  return 0
}

function getToolIcon(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('search') || n.includes('web')) return '🔍'
  if (n.includes('code') || n.includes('exec')) return '💻'
  if (n.includes('file') || n.includes('read') || n.includes('write')) return '📁'
  if (n.includes('math') || n.includes('calc')) return '🧮'
  if (n.includes('image') || n.includes('vision')) return '🖼️'
  if (n.includes('browser') || n.includes('url')) return '🌐'
  if (n.includes('database') || n.includes('sql')) return '🗄️'
  if (n.includes('email') || n.includes('mail')) return '📧'
  if (n.includes('api') || n.includes('http')) return '🔌'
  if (n.includes('shell') || n.includes('bash') || n.includes('terminal')) return '⌨️'
  return '🔧'
}
