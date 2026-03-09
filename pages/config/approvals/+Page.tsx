import React, { useState, useEffect, useCallback } from 'react'
import { Button, Card, Alert, Badge, Input, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'

/**
 * 스킬 인벤토리 — 도구 정책을 게임 아이템처럼 관리
 *
 * Star-Office-UI 컨셉:
 * - 도구 = 스킬/아이템
 * - 허용 = 장착, 차단 = 보관
 * - 그리드 뷰로 인벤토리처럼 표시
 * - 카테고리 분류 (검색/코드/파일/네트워크 등)
 */

interface ToolPolicy {
  name: string
  allowed: boolean
  profile?: string
  description?: string
}

type ViewMode = 'grid' | 'list'
type FilterMode = 'all' | 'equipped' | 'stored'

export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="list" lines={4} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="스킬 인벤토리" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="스킬 인벤토리"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="스킬 인벤토리" variant="disconnected" />
  }

  return <ApprovalPageContent />
}

function ApprovalPageContent() {
  const [policies, setPolicies] = useState<ToolPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [filter, setFilter] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/config/current')
      if (res.ok) {
        const data = await res.json()
        const config = data.config || data
        const tools = config?.tools || config?.toolPolicies || []

        if (Array.isArray(tools)) {
          setPolicies(tools.map(normalizeTool))
        } else if (typeof tools === 'object') {
          setPolicies(
            Object.entries(tools).map(([name, value]) => ({
              name,
              allowed: typeof value === 'boolean' ? value : (value as any)?.allowed !== false,
              profile: (value as any)?.profile,
              description: (value as any)?.description,
            }))
          )
        }
      }
    } catch {
      setError('인벤토리를 불러올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPolicies()
  }, [fetchPolicies])

  const toggleTool = (name: string) => {
    setPolicies((prev) =>
      prev.map((p) => (p.name === name ? { ...p, allowed: !p.allowed } : p))
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const toolMap: Record<string, { allowed: boolean; profile?: string }> = {}
      for (const p of policies) {
        toolMap[p.name] = { allowed: p.allowed, ...(p.profile ? { profile: p.profile } : {}) }
      }

      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { tools: toolMap } }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '저장 실패')
      }
    } catch (err: any) {
      setError(err.message || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  // 필터링
  const filtered = policies
    .filter((p) => {
      if (filterMode === 'equipped') return p.allowed
      if (filterMode === 'stored') return !p.allowed
      return true
    })
    .filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()))

  const equippedCount = policies.filter((p) => p.allowed).length
  const storedCount = policies.filter((p) => !p.allowed).length

  // 카테고리별 그룹핑
  const grouped = groupByCategory(filtered)

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">🎒 스킬 인벤토리</h2>
          <p className="text-sm text-text-secondary mt-1">
            도구를 장착/해제하여 에이전트 능력을 관리합니다
          </p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          💾 저장
        </Button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" className="mb-4">인벤토리가 저장되었습니다!</Alert>}

      {/* 인벤토리 요약 바 */}
      <Card className="p-3 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs text-text-secondary">장착 <strong className="text-text-primary">{equippedCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-text-secondary/30" />
              <span className="text-xs text-text-secondary">보관 <strong className="text-text-primary">{storedCount}</strong></span>
            </div>
            <span className="text-xs text-text-secondary">|</span>
            <span className="text-xs text-text-secondary">전체 <strong className="text-text-primary">{policies.length}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            {/* 필터 모드 */}
            <div className="flex bg-bg-secondary rounded-lg p-0.5">
              {(['all', 'equipped', 'stored'] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    filterMode === mode
                      ? 'bg-card text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {mode === 'all' ? '전체' : mode === 'equipped' ? '장착' : '보관'}
                </button>
              ))}
            </div>

            {/* 뷰 모드 */}
            <div className="flex bg-bg-secondary rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2 py-1 rounded-md text-xs transition-colors ${
                  viewMode === 'grid' ? 'bg-card text-text-primary shadow-sm' : 'text-text-secondary'
                }`}
                title="그리드 뷰"
              >⊞</button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2 py-1 rounded-md text-xs transition-colors ${
                  viewMode === 'list' ? 'bg-card text-text-primary shadow-sm' : 'text-text-secondary'
                }`}
                title="리스트 뷰"
              >☰</button>
            </div>
          </div>
        </div>
      </Card>

      {/* 검색 */}
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="🔍 스킬 검색..."
        className="mb-4"
      />

      {loading ? (
        <Card className="p-12 text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-secondary">인벤토리를 불러오는 중...</p>
        </Card>
      ) : policies.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">🎒</div>
          <p className="text-text-primary font-medium mb-1">인벤토리가 비어있습니다</p>
          <p className="text-xs text-text-secondary">
            Gateway에 연결 후 사용 가능한 스킬이 표시됩니다.
          </p>
        </Card>
      ) : viewMode === 'grid' ? (
        // 그리드 뷰 (카테고리별)
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                <span>{getCategoryIcon(category)}</span>
                {category}
                <Badge variant="neutral" size="sm">{items.length}</Badge>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {items.map((policy) => (
                  <InventorySlot
                    key={policy.name}
                    policy={policy}
                    onToggle={() => toggleTool(policy.name)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // 리스트 뷰
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((policy) => (
              <div
                key={policy.name}
                className="flex items-center justify-between px-4 py-3 hover:bg-bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg flex-shrink-0">{getToolIcon(policy.name)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary font-mono truncate">
                        {policy.name}
                      </span>
                      {policy.profile && (
                        <Badge variant="info" size="sm">{policy.profile}</Badge>
                      )}
                    </div>
                    {policy.description && (
                      <p className="text-xs text-text-secondary mt-0.5 truncate">
                        {policy.description}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleTool(policy.name)}
                  className={`
                    px-3 py-1 rounded-lg text-xs font-medium transition-all flex-shrink-0
                    ${policy.allowed
                      ? 'bg-success/10 text-success border border-success/20 hover:bg-success/20'
                      : 'bg-bg-secondary text-text-secondary border border-border hover:bg-bg-primary'
                    }
                  `}
                >
                  {policy.allowed ? '✅ 장착' : '📦 보관'}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 안내 */}
      <div className="mt-4 p-3 bg-bg-secondary rounded-lg text-xs text-text-secondary">
        <p>💡 <strong>장착</strong>된 스킬은 에이전트가 사용할 수 있습니다. <strong>보관</strong> 상태의 스킬은 비활성됩니다.</p>
        <p className="mt-1">캐릭터 시트에서 전체 현황을 확인하세요 → <a href="/config/agents" className="text-accent hover:underline">캐릭터 시트</a></p>
      </div>
    </div>
  )
}

// ─── 인벤토리 슬롯 (그리드 아이템) ───

function InventorySlot({
  policy,
  onToggle,
}: {
  policy: ToolPolicy
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`
        relative p-3 rounded-xl border-2 text-center transition-all group
        ${policy.allowed
          ? 'bg-gradient-to-b from-accent/5 to-accent/10 border-accent/30 hover:border-accent/50 shadow-sm'
          : 'bg-bg-secondary/50 border-border/50 hover:border-border opacity-70 hover:opacity-100'
        }
      `}
      title={`${policy.name}${policy.description ? ` — ${policy.description}` : ''}\n클릭: ${policy.allowed ? '해제' : '장착'}`}
    >
      {/* 장착 인디케이터 */}
      {policy.allowed && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center text-[8px] text-white shadow-sm">
          ✓
        </span>
      )}

      {/* 아이콘 */}
      <div className="text-2xl mb-1">{getToolIcon(policy.name)}</div>

      {/* 이름 */}
      <span className="text-[10px] font-mono text-text-primary block truncate leading-tight">
        {policy.name}
      </span>

      {/* 프로필 태그 */}
      {policy.profile && (
        <span className="text-[8px] text-accent mt-0.5 block truncate">{policy.profile}</span>
      )}

      {/* 호버: 장착/해제 텍스트 */}
      <span className="absolute inset-0 rounded-xl bg-black/50 text-white text-[10px] font-medium flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        {policy.allowed ? '해제' : '장착'}
      </span>
    </button>
  )
}

// ─── 유틸 ───

function normalizeTool(raw: any): ToolPolicy {
  if (typeof raw === 'string') {
    return { name: raw, allowed: true }
  }
  return {
    name: raw.name || raw.tool || 'unknown',
    allowed: raw.allowed !== false,
    profile: raw.profile,
    description: raw.description,
  }
}

function getToolIcon(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('search') || n.includes('web') || n.includes('google')) return '🔍'
  if (n.includes('code') || n.includes('exec') || n.includes('run')) return '💻'
  if (n.includes('file') || n.includes('read') || n.includes('write') || n.includes('fs')) return '📁'
  if (n.includes('math') || n.includes('calc') || n.includes('compute')) return '🧮'
  if (n.includes('image') || n.includes('vision') || n.includes('screenshot')) return '🖼️'
  if (n.includes('browser') || n.includes('url') || n.includes('fetch')) return '🌐'
  if (n.includes('database') || n.includes('sql') || n.includes('query')) return '🗄️'
  if (n.includes('email') || n.includes('mail') || n.includes('send')) return '📧'
  if (n.includes('api') || n.includes('http') || n.includes('request')) return '🔌'
  if (n.includes('shell') || n.includes('bash') || n.includes('terminal') || n.includes('command')) return '⌨️'
  if (n.includes('memory') || n.includes('store') || n.includes('cache')) return '🧠'
  if (n.includes('edit') || n.includes('modify') || n.includes('update')) return '✏️'
  if (n.includes('delete') || n.includes('remove')) return '🗑️'
  if (n.includes('create') || n.includes('generate') || n.includes('make')) return '✨'
  if (n.includes('list') || n.includes('get') || n.includes('show')) return '📋'
  return '🔧'
}

function getCategoryIcon(category: string): string {
  const map: Record<string, string> = {
    '검색/웹': '🔍',
    '코드/실행': '💻',
    '파일/IO': '📁',
    '네트워크': '🌐',
    '데이터': '🗄️',
    '커뮤니케이션': '📧',
    '시스템': '⌨️',
    '기타': '🔧',
  }
  return map[category] || '📦'
}

function categorize(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('search') || n.includes('web') || n.includes('google') || n.includes('browse')) return '검색/웹'
  if (n.includes('code') || n.includes('exec') || n.includes('run') || n.includes('eval')) return '코드/실행'
  if (n.includes('file') || n.includes('read') || n.includes('write') || n.includes('fs') || n.includes('dir')) return '파일/IO'
  if (n.includes('http') || n.includes('api') || n.includes('fetch') || n.includes('url') || n.includes('request')) return '네트워크'
  if (n.includes('database') || n.includes('sql') || n.includes('query') || n.includes('store') || n.includes('memory')) return '데이터'
  if (n.includes('email') || n.includes('mail') || n.includes('send') || n.includes('message') || n.includes('notify')) return '커뮤니케이션'
  if (n.includes('shell') || n.includes('bash') || n.includes('terminal') || n.includes('command') || n.includes('system')) return '시스템'
  return '기타'
}

function groupByCategory(policies: ToolPolicy[]): Record<string, ToolPolicy[]> {
  const groups: Record<string, ToolPolicy[]> = {}
  for (const p of policies) {
    const cat = categorize(p.name)
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(p)
  }
  // 정렬: 카테고리 순서 고정
  const order = ['검색/웹', '코드/실행', '파일/IO', '네트워크', '데이터', '커뮤니케이션', '시스템', '기타']
  const sorted: Record<string, ToolPolicy[]> = {}
  for (const key of order) {
    if (groups[key]) sorted[key] = groups[key]
  }
  return sorted
}
