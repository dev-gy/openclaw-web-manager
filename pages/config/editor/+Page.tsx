import React, { useState, useMemo } from 'react'
import { Button, Card, Alert, Badge, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { SchemaForm } from '../../../components/ui/SchemaForm'
import { useConfig, type ConfigSchema, type ConflictInfo } from '../../../hooks/useConfig'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'

/**
 * 전체 설정 편집기
 *
 * 2-View 시스템:
 *  - Schema View: JSON Schema 기반 폼 (SchemaForm)
 *  - JSON View: 원시 JSON 편집
 */
export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()
  const {
    schema,
    config,
    loading,
    saving,
    error,
    hasChanges,
    updateField,
    save,
    apply,
    reset,
    refresh,
    validationErrors,
    isValid,
    conflict,
    resolveConflictUseServer,
    resolveConflictUseMine,
    dismissConflict,
  } = useConfig()

  const [saveSuccess, setSaveSuccess] = useState(false)
  const [applySuccess, setApplySuccess] = useState(false)
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form')

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="block" lines={1} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="전체 편집기" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="전체 편집기"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="전체 편집기" variant="disconnected" />
  }

  const handleSave = async () => {
    setSaveSuccess(false)
    const success = await save()
    if (success) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  const handleSaveAndApply = async () => {
    setSaveSuccess(false)
    setApplySuccess(false)
    const saved = await save()
    if (saved) {
      const applied = await apply()
      if (applied) {
        setApplySuccess(true)
        setTimeout(() => setApplySuccess(false), 3000)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-secondary">설정을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">전체 설정 편집기</h2>
          <p className="text-sm text-text-secondary mt-1">
            openclaw.json 스키마 기반 편집
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasChanges && <Badge variant="warning">변경사항 있음</Badge>}
          {saveSuccess && <Badge variant="success">저장됨</Badge>}
          {applySuccess && <Badge variant="success">적용됨</Badge>}
        </div>
      </div>

      {/* 알림 */}
      {error && !conflict && <Alert variant="error" className="mb-4">{error}</Alert>}

      {/* 충돌 해결 UI */}
      {conflict && (
        <ConflictResolver
          conflict={conflict}
          onUseServer={resolveConflictUseServer}
          onUseMine={resolveConflictUseMine}
          onDismiss={dismissConflict}
          saving={saving}
        />
      )}

      {/* 뷰 모드 탭 + 액션 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex bg-bg-secondary rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('form')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'form'
                ? 'bg-card text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            스키마 뷰
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'json'
                ? 'bg-card text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            JSON 뷰
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={reset} disabled={!hasChanges}>
            되돌리기
          </Button>
          <Button variant="secondary" size="sm" onClick={refresh}>
            새로고침
          </Button>
        </div>
      </div>

      {/* 컨텐츠 */}
      {!schema && !config ? (
        <Card className="p-8 text-center">
          <p className="text-text-secondary">
            Gateway에 연결되어 있지 않거나 설정 스키마를 가져올 수 없습니다.
          </p>
          <a
            href="/setup/1"
            className="inline-block mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm transition-colors"
          >
            Gateway 연결하기
          </a>
        </Card>
      ) : viewMode === 'form' && schema ? (
        <Card className="p-5">
          <SchemaForm
            schema={schema}
            values={config || {}}
            onChange={updateField}
            validationErrors={validationErrors}
          />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <JsonEditor
            value={config || {}}
            onChange={(newConfig) => {
              for (const key of Object.keys(newConfig)) {
                updateField(key, newConfig[key])
              }
            }}
          />
        </Card>
      )}

      {/* 유효성 검증 요약 */}
      {!isValid && hasChanges && (
        <Alert variant="warning" className="mt-4">
          <span className="font-medium">유효성 검증 실패</span> — {Object.keys(validationErrors).length}개 항목을 확인하세요:{' '}
          {Object.entries(validationErrors).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ')}
          {Object.keys(validationErrors).length > 3 && ` 외 ${Object.keys(validationErrors).length - 3}건`}
        </Alert>
      )}

      {/* 하단 액션 바 */}
      <div className="flex items-center justify-end gap-2 mt-4 p-4 bg-card border border-border rounded-xl">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges || !isValid}
        >
          저장
        </Button>
        <Button
          size="sm"
          onClick={handleSaveAndApply}
          loading={saving}
          disabled={!hasChanges || !isValid}
        >
          저장 및 적용
        </Button>
      </div>

      {/* 안내 */}
      <div className="mt-4 p-4 bg-bg-secondary rounded-lg">
        <p className="text-sm text-text-secondary">
          💡 <strong>저장</strong>은 Gateway에 설정 파일을 기록합니다.
          <strong> 적용</strong>은 저장된 설정을 런타임에 즉시 반영합니다. (일부 설정은 재시작 필요)
        </p>
      </div>
    </div>
  )
}

// ─── 충돌 해결 UI ───

function ConflictResolver({
  conflict,
  onUseServer,
  onUseMine,
  onDismiss,
  saving,
}: {
  conflict: ConflictInfo
  onUseServer: () => void
  onUseMine: () => Promise<boolean>
  onDismiss: () => void
  saving: boolean
}) {
  const [showDiff, setShowDiff] = useState(false)
  const [forceSaving, setForceSaving] = useState(false)

  const diffEntries = useMemo(() => {
    return computeDiff(conflict.myConfig, conflict.serverConfig)
  }, [conflict])

  const handleUseMine = async () => {
    setForceSaving(true)
    await onUseMine()
    setForceSaving(false)
  }

  return (
    <Card className="mb-4 border-warning/40 bg-warning/5">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚔️</span>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-text-primary">
              설정 충돌이 감지되었습니다
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              편집하는 동안 다른 곳에서 설정이 변경되었습니다.
              변경사항을 어떻게 처리할지 선택하세요.
            </p>

            {/* 변경 요약 */}
            {diffEntries.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowDiff(!showDiff)}
                  className="text-xs text-accent hover:text-accent-hover font-medium transition-colors"
                >
                  {showDiff ? '▼' : '▶'} 변경 내용 비교 ({diffEntries.length}개 항목)
                </button>

                {showDiff && (
                  <div className="mt-2 max-h-60 overflow-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-bg-secondary border-b border-border">
                          <th className="text-left px-3 py-1.5 text-text-secondary font-medium w-1/4">키</th>
                          <th className="text-left px-3 py-1.5 text-text-secondary font-medium w-1/4">내 값</th>
                          <th className="text-left px-3 py-1.5 text-text-secondary font-medium w-1/4">서버 값</th>
                          <th className="text-left px-3 py-1.5 text-text-secondary font-medium w-1/4">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {diffEntries.map((entry) => (
                          <tr key={entry.key} className="hover:bg-bg-secondary/50">
                            <td className="px-3 py-1.5 font-mono text-text-primary">{entry.key}</td>
                            <td className="px-3 py-1.5 font-mono text-blue-400 max-w-0 truncate">{entry.myValue}</td>
                            <td className="px-3 py-1.5 font-mono text-green-400 max-w-0 truncate">{entry.serverValue}</td>
                            <td className="px-3 py-1.5">
                              <Badge variant={entry.type === 'added' ? 'success' : entry.type === 'removed' ? 'error' : 'warning'} size="sm">
                                {entry.type === 'added' ? '추가' : entry.type === 'removed' ? '삭제' : '변경'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-warning/20">
          <Button
            variant="secondary"
            size="sm"
            onClick={onUseServer}
          >
            🔄 서버 버전 사용
          </Button>
          <Button
            size="sm"
            onClick={handleUseMine}
            loading={forceSaving}
            disabled={saving}
            className="bg-warning hover:bg-warning/80 text-white"
          >
            ⚡ 내 변경사항 강제 저장
          </Button>
          <button
            onClick={onDismiss}
            className="ml-auto text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </Card>
  )
}

interface DiffEntry {
  key: string
  myValue: string
  serverValue: string
  type: 'added' | 'removed' | 'changed'
}

function computeDiff(
  myConfig: Record<string, unknown>,
  serverConfig: Record<string, unknown>,
): DiffEntry[] {
  const allKeys = new Set([...Object.keys(myConfig), ...Object.keys(serverConfig)])
  const entries: DiffEntry[] = []

  for (const key of allKeys) {
    const myVal = myConfig[key]
    const serverVal = serverConfig[key]
    const myStr = JSON.stringify(myVal) ?? 'undefined'
    const serverStr = JSON.stringify(serverVal) ?? 'undefined'

    if (myStr !== serverStr) {
      let type: DiffEntry['type'] = 'changed'
      if (myVal === undefined) type = 'added'   // 서버에만 있음
      else if (serverVal === undefined) type = 'removed' // 내것에만 있음

      entries.push({
        key,
        myValue: myVal !== undefined ? truncateValue(myStr) : '—',
        serverValue: serverVal !== undefined ? truncateValue(serverStr) : '—',
        type,
      })
    }
  }

  return entries
}

function truncateValue(str: string): string {
  return str.length > 50 ? str.slice(0, 47) + '...' : str
}

// ─── JSON 편집기 ───

function JsonEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  const handleChange = (newText: string) => {
    setText(newText)
    try {
      const parsed = JSON.parse(newText)
      setParseError(null)
      onChange(parsed)
    } catch (err: any) {
      setParseError(err.message)
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        className="w-full h-[500px] px-4 py-3 bg-bg-primary text-text-primary font-mono text-xs border-none outline-none resize-y focus:ring-0"
      />
      {parseError && (
        <div className="px-4 py-2 bg-error/10 text-error text-xs border-t border-border">
          JSON 오류: {parseError}
        </div>
      )}
    </div>
  )
}
