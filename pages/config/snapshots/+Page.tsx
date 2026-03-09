import React, { useState, useEffect, useCallback } from 'react'
import { Card, Button, Alert, Badge, Input, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'

/**
 * 설정 스냅샷 관리
 *
 * 기획서 5.6: 설정 스냅샷 저장/복원/비교.
 * 변경 전 자동 저장된 스냅샷과 수동 스냅샷을 관리.
 */

interface Snapshot {
  id: string
  label: string
  config: Record<string, unknown>
  type: 'auto' | 'manual'
  createdAt: string
  hash?: string
}

interface DiffResult {
  added: string[]
  removed: string[]
  changed: Array<{ path: string; oldValue: unknown; newValue: unknown }>
}

export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [diffResult, setDiffResult] = useState<{ snapshotId: string; diff: DiffResult } | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'auto' | 'manual'>('all')

  const fetchSnapshots = useCallback(async () => {
    try {
      setLoading(true)
      const params = filter !== 'all' ? `?type=${filter}` : ''
      const res = await fetch(`/api/config/snapshots${params}`)
      if (res.ok) {
        const data = await res.json()
        setSnapshots(data.snapshots || [])
      } else {
        setError('스냅샷 목록을 불러올 수 없습니다')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchSnapshots()
  }, [fetchSnapshots])

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="list" lines={4} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="스냅샷" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="스냅샷"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="스냅샷" variant="disconnected" />
  }

  const handleCreate = async () => {
    if (!newLabel.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/config/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim() }),
      })
      if (res.ok) {
        setNewLabel('')
        setSuccess('스냅샷이 저장되었습니다')
        setTimeout(() => setSuccess(null), 3000)
        await fetchSnapshots()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || '스냅샷 생성 실패')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async (id: string) => {
    setRestoring(id)
    setError(null)
    try {
      const res = await fetch(`/api/config/snapshots/${id}/restore`, {
        method: 'POST',
      })
      if (res.ok) {
        setConfirmRestore(null)
        setSuccess('설정이 복원되었습니다')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || '복원 실패')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setRestoring(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/config/snapshots/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchSnapshots()
      }
    } catch {
      setError('삭제 실패')
    }
  }

  const handleCompare = async (id: string) => {
    try {
      const res = await fetch(`/api/config/snapshots/${id}/diff`)
      if (res.ok) {
        const data = await res.json()
        setDiffResult({ snapshotId: id, diff: data.diff })
      }
    } catch {
      setError('비교 실패')
    }
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">설정 스냅샷</h2>
          <p className="text-sm text-text-secondary mt-1">
            설정 변경 이력을 관리하고 이전 버전으로 복원합니다
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchSnapshots}>
          새로고침
        </Button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" className="mb-4">{success}</Alert>}

      {/* 새 스냅샷 생성 */}
      <Card className="p-4 mb-6">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          수동 스냅샷 생성
        </h3>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="스냅샷 이름 (예: 채널 설정 변경 전)"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
          />
          <Button
            size="sm"
            onClick={handleCreate}
            loading={saving}
            disabled={!newLabel.trim()}
          >
            현재 설정 저장
          </Button>
        </div>
      </Card>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {(['all', 'auto', 'manual'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              filter === f
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            {f === 'all' ? '전체' : f === 'auto' ? '자동' : '수동'}
          </button>
        ))}
        <span className="text-xs text-text-secondary self-center ml-2">
          {snapshots.length}개
        </span>
      </div>

      {/* 스냅샷 목록 */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-text-secondary text-sm">스냅샷을 불러오는 중...</p>
        </div>
      ) : snapshots.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-text-secondary text-sm">저장된 스냅샷이 없습니다</p>
          <p className="text-text-secondary text-xs mt-1">
            설정 변경 시 자동으로 스냅샷이 생성됩니다
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snapshot) => (
            <Card key={snapshot.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge
                    variant={snapshot.type === 'auto' ? 'info' : 'success'}
                    size="sm"
                  >
                    {snapshot.type === 'auto' ? '자동' : '수동'}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary font-medium truncate">
                      {snapshot.label}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {new Date(snapshot.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleCompare(snapshot.id)}
                    className="px-2 py-1 text-xs text-text-secondary hover:text-accent transition-colors"
                  >
                    비교
                  </button>

                  {confirmRestore === snapshot.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleRestore(snapshot.id)}
                        disabled={restoring === snapshot.id}
                        className="px-2 py-1 text-xs text-error hover:text-error/80 font-medium"
                      >
                        {restoring === snapshot.id ? '...' : '확인'}
                      </button>
                      <button
                        onClick={() => setConfirmRestore(null)}
                        className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRestore(snapshot.id)}
                      className="px-2 py-1 text-xs text-text-secondary hover:text-warning transition-colors"
                    >
                      복원
                    </button>
                  )}

                  {snapshot.type === 'manual' && (
                    <button
                      onClick={() => handleDelete(snapshot.id)}
                      className="px-2 py-1 text-xs text-text-secondary hover:text-error transition-colors"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>

              {/* Diff 표시 */}
              {diffResult?.snapshotId === snapshot.id && (
                <div className="mt-3 pt-3 border-t border-border">
                  <DiffView diff={diffResult.diff} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Diff 뷰어 ───

function DiffView({ diff }: { diff: DiffResult }) {
  const totalChanges = diff.added.length + diff.removed.length + diff.changed.length

  if (totalChanges === 0) {
    return (
      <p className="text-sm text-text-secondary text-center py-2">
        현재 설정과 동일합니다
      </p>
    )
  }

  return (
    <div className="space-y-2 text-xs font-mono">
      <p className="text-text-secondary text-xs font-sans">
        변경사항 {totalChanges}개 (추가 {diff.added.length}, 삭제 {diff.removed.length}, 수정 {diff.changed.length})
      </p>

      {diff.added.map((path) => (
        <div key={`add-${path}`} className="flex items-center gap-2 text-success">
          <span>+</span>
          <span>{path}</span>
        </div>
      ))}

      {diff.removed.map((path) => (
        <div key={`rem-${path}`} className="flex items-center gap-2 text-error">
          <span>−</span>
          <span>{path}</span>
        </div>
      ))}

      {diff.changed.map(({ path, oldValue, newValue }) => (
        <div key={`chg-${path}`} className="border border-border rounded p-2">
          <span className="text-text-secondary">{path}</span>
          <div className="flex gap-2 mt-1">
            <span className="text-error line-through">
              {JSON.stringify(oldValue)}
            </span>
            <span className="text-text-secondary">→</span>
            <span className="text-success">
              {JSON.stringify(newValue)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
