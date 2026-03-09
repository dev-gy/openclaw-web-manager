import React, { useState, useCallback, useEffect } from 'react'
import { Card, Button, Alert, Badge, Input, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { useConfig, getNestedValue } from '../../../hooks/useConfig'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'

/**
 * 📜 스펠북 — 시스템 프롬프트 라이브러리
 *
 * Star-Office-UI 컨셉:
 * - 시스템 프롬프트 = 마법 주문서
 * - 프리셋 프롬프트를 라이브러리에서 선택/장착
 * - 현재 장착된 프롬프트 편집
 * - 사용자 커스텀 프롬프트 저장
 */

interface PromptPreset {
  id: string
  name: string
  icon: string
  category: string
  description: string
  prompt: string
  tags: string[]
}

// 기본 프롬프트 프리셋 라이브러리
const PRESET_LIBRARY: PromptPreset[] = [
  {
    id: 'helpful-assistant',
    name: '만능 도우미',
    icon: '🤝',
    category: '기본',
    description: '친절하고 정확한 범용 도우미',
    prompt: 'You are a helpful, harmless, and honest AI assistant. Answer the user\'s questions accurately and concisely. If you don\'t know something, say so. Always be polite and professional.',
    tags: ['범용', '친절', '기본'],
  },
  {
    id: 'code-expert',
    name: '코드 전문가',
    icon: '💻',
    category: '개발',
    description: '프로그래밍과 코드 리뷰에 특화',
    prompt: 'You are an expert software engineer. Help users write clean, efficient, and well-documented code. Explain your reasoning, suggest best practices, and point out potential bugs or improvements. Support multiple programming languages.',
    tags: ['개발', '코드리뷰', '프로그래밍'],
  },
  {
    id: 'creative-writer',
    name: '크리에이티브 작가',
    icon: '✍️',
    category: '창작',
    description: '창의적 글쓰기와 콘텐츠 생성',
    prompt: 'You are a creative writing assistant with a flair for storytelling. Help users craft engaging narratives, poems, marketing copy, and other creative content. Adapt your tone and style to match the user\'s needs.',
    tags: ['창작', '글쓰기', '마케팅'],
  },
  {
    id: 'data-analyst',
    name: '데이터 분석가',
    icon: '📊',
    category: '분석',
    description: '데이터 분석과 인사이트 추출',
    prompt: 'You are a data analyst assistant. Help users analyze data, create visualizations, write SQL queries, and extract actionable insights. Explain statistical concepts clearly and suggest appropriate analysis methods.',
    tags: ['분석', '데이터', 'SQL'],
  },
  {
    id: 'customer-support',
    name: '고객 응대',
    icon: '🎧',
    category: '비즈니스',
    description: '고객 문의 처리 전문',
    prompt: 'You are a professional customer support agent. Handle customer inquiries with empathy, patience, and efficiency. Follow escalation procedures when needed. Always aim for first-contact resolution.',
    tags: ['고객지원', '비즈니스', '응대'],
  },
  {
    id: 'tutor',
    name: '학습 튜터',
    icon: '📚',
    category: '교육',
    description: '단계별 학습 안내',
    prompt: 'You are a patient and encouraging tutor. Explain concepts step by step, use analogies and examples, and adapt to the learner\'s level. Ask clarifying questions to gauge understanding. Celebrate progress.',
    tags: ['교육', '학습', '설명'],
  },
  {
    id: 'translator',
    name: '번역 전문가',
    icon: '🌍',
    category: '언어',
    description: '다국어 번역 및 현지화',
    prompt: 'You are a professional translator. Provide accurate, natural-sounding translations that preserve the original meaning, tone, and cultural nuances. Support Korean, English, Japanese, Chinese, and other major languages.',
    tags: ['번역', '다국어', '현지화'],
  },
  {
    id: 'security-guard',
    name: '보안 수호자',
    icon: '🛡️',
    category: '보안',
    description: '최소 권한으로 안전하게 응답',
    prompt: 'You are a security-conscious AI assistant. Always validate inputs, avoid revealing sensitive information, and follow the principle of least privilege. Warn users about potential security risks. Never execute or suggest malicious code.',
    tags: ['보안', '안전', '검증'],
  },
]

export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()
  const { config, loading: configLoading, saving, error: configError, updateField, save, apply } = useConfig()
  const [selectedPreset, setSelectedPreset] = useState<PromptPreset | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('전체')
  const [customPrompts, setCustomPrompts] = useState<PromptPreset[]>([])
  const [showSaveCustom, setShowSaveCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [success, setSuccess] = useState(false)

  // 현재 장착된 프롬프트
  const currentPrompt = config
    ? String(getNestedValue(config, 'agent.systemPrompt') ?? getNestedValue(config, 'systemPrompt') ?? '')
    : ''

  // 로컬 스토리지에서 커스텀 프롬프트 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem('owm-custom-prompts')
      if (saved) setCustomPrompts(JSON.parse(saved))
    } catch {
      // ignore
    }
  }, [])

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="list" lines={4} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="스펠북" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="스펠북"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="스펠북" variant="disconnected" />
  }

  const categories = ['전체', ...new Set(PRESET_LIBRARY.map((p) => p.category))]
  if (customPrompts.length > 0) categories.push('커스텀')

  // 필터링
  const allPrompts = [...PRESET_LIBRARY, ...customPrompts]
  const filtered = allPrompts.filter((p) => {
    if (categoryFilter !== '전체' && p.category !== categoryFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  // 프롬프트 장착
  const equipPrompt = async (prompt: string) => {
    const path = config && getNestedValue(config, 'agent.systemPrompt') !== undefined
      ? 'agent.systemPrompt'
      : 'systemPrompt'
    updateField(path, prompt)
    const ok = await save()
    if (ok) {
      await apply()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  // 커스텀 프롬프트 저장
  const saveCustomPrompt = () => {
    if (!customName.trim() || !currentPrompt.trim()) return
    const newPreset: PromptPreset = {
      id: `custom-${Date.now()}`,
      name: customName,
      icon: '📝',
      category: '커스텀',
      description: '사용자 정의 프롬프트',
      prompt: currentPrompt,
      tags: ['커스텀'],
    }
    const updated = [...customPrompts, newPreset]
    setCustomPrompts(updated)
    localStorage.setItem('owm-custom-prompts', JSON.stringify(updated))
    setCustomName('')
    setShowSaveCustom(false)
  }

  // 커스텀 프롬프트 삭제
  const deleteCustomPrompt = (id: string) => {
    const updated = customPrompts.filter((p) => p.id !== id)
    setCustomPrompts(updated)
    localStorage.setItem('owm-custom-prompts', JSON.stringify(updated))
  }

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">📜 스펠북</h2>
          <p className="text-sm text-text-secondary mt-1">
            시스템 프롬프트 라이브러리 — 주문서를 선택하고 장착하세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          {success && <Badge variant="success">장착 완료!</Badge>}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSaveCustom(!showSaveCustom)}
          >
            ✨ 현재 프롬프트 저장
          </Button>
        </div>
      </div>

      {configError && <Alert variant="error" className="mb-4">{configError}</Alert>}

      {/* 현재 장착된 프롬프트 */}
      <Card className="p-4 mb-4 border-accent/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1">
            ⚡ 현재 장착된 주문서
          </h3>
          <Badge variant="info" size="sm">{currentPrompt.length} chars</Badge>
        </div>
        <p className="text-sm text-text-primary line-clamp-3 font-mono bg-bg-secondary rounded-lg p-3">
          {currentPrompt || <span className="text-text-secondary italic">비어있음 — 아래에서 선택하세요</span>}
        </p>
      </Card>

      {/* 커스텀 프롬프트 저장 패널 */}
      {showSaveCustom && (
        <Card className="p-4 mb-4">
          <h4 className="text-sm font-semibold text-text-primary mb-2">현재 프롬프트를 라이브러리에 저장</h4>
          <div className="flex gap-2">
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="프롬프트 이름..."
              className="flex-1"
            />
            <Button size="sm" onClick={saveCustomPrompt} disabled={!customName.trim() || !currentPrompt.trim()}>
              저장
            </Button>
          </div>
        </Card>
      )}

      {/* 필터 바 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 주문서 검색..."
          className="flex-1"
        />
        <div className="flex gap-1 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 프롬프트 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((preset) => {
          const isEquipped = currentPrompt === preset.prompt
          const isCustom = preset.category === '커스텀'
          return (
            <Card
              key={preset.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedPreset?.id === preset.id ? 'ring-2 ring-accent' : ''
              } ${isEquipped ? 'border-accent/40 bg-accent/5' : ''}`}
              onClick={() => setSelectedPreset(selectedPreset?.id === preset.id ? null : preset)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{preset.icon}</span>
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary">{preset.name}</h4>
                    <p className="text-[10px] text-text-secondary">{preset.category}</p>
                  </div>
                </div>
                {isEquipped && <Badge variant="success" size="sm">장착중</Badge>}
              </div>

              <p className="text-xs text-text-secondary mb-3 line-clamp-2">
                {preset.description}
              </p>

              <div className="flex flex-wrap gap-1 mb-3">
                {preset.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 bg-bg-secondary text-[10px] text-text-secondary rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* 확장 영역 */}
              {selectedPreset?.id === preset.id && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-text-primary font-mono bg-bg-secondary rounded p-2 mb-3 max-h-[120px] overflow-y-auto">
                    {preset.prompt}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); equipPrompt(preset.prompt) }}
                      loading={saving}
                      disabled={isEquipped}
                    >
                      {isEquipped ? '✅ 장착됨' : '⚡ 장착'}
                    </Button>
                    {isCustom && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); deleteCustomPrompt(preset.id) }}
                      >
                        🗑️ 삭제
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-3xl mb-2">📜</div>
          <p className="text-text-secondary">검색 결과가 없습니다</p>
        </Card>
      )}

      {/* 안내 */}
      <div className="mt-4 p-3 bg-bg-secondary rounded-lg text-xs text-text-secondary">
        <p>💡 <strong>장착</strong>하면 에이전트의 시스템 프롬프트가 즉시 교체됩니다.</p>
        <p className="mt-1">캐릭터 시트에서 프롬프트를 직접 편집할 수도 있습니다 → <a href="/config/agents" className="text-accent hover:underline">캐릭터 시트</a></p>
      </div>
    </div>
  )
}
