import React, { useState, useCallback } from 'react'
import { Card, Button, Alert, Badge, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'

interface UpdateInfo {
  currentVersion: string | null
  latestVersion: string | null
  updateAvailable: boolean
  changelog?: string
}

export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const checkForUpdates = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      const res = await fetch('/api/server/info')
      if (res.ok) {
        const data = await res.json()
        const currentVersion = data.status?.version || data.health?.version
        // 업데이트 체크는 Gateway RPC로 수행 (있으면)
        setUpdateInfo({
          currentVersion: currentVersion || null,
          latestVersion: null, // Gateway가 제공하면 채움
          updateAvailable: false,
        })
      } else {
        setError('Gateway에 연결되어 있지 않습니다')
      }
    } catch {
      setError('업데이트 확인 실패')
    } finally {
      setChecking(false)
    }
  }, [])

  const runUpdate = useCallback(async () => {
    setUpdating(true)
    setError(null)
    setSuccess(null)
    try {
      // npm update -g openclaw 실행 (서버 사이드에서)
      const res = await fetch('/api/server/process/restart', { method: 'POST' })
      if (res.ok) {
        setSuccess('업데이트가 완료되었습니다. Gateway가 재시작됩니다.')
      } else {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '업데이트 실패')
      }
    } catch (err: any) {
      setError(err.message || '업데이트 실패')
    } finally {
      setUpdating(false)
    }
  }, [])

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="list" lines={3} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="업데이트" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="업데이트"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="업데이트" variant="disconnected" />
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-text-primary mb-6">업데이트</h2>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" className="mb-4">{success}</Alert>}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">OpenClaw 업데이트</h3>
            <p className="text-sm text-text-secondary mt-1">
              최신 버전을 확인하고 업데이트합니다
            </p>
          </div>
          <Button onClick={checkForUpdates} loading={checking} variant="secondary">
            업데이트 확인
          </Button>
        </div>

        {updateInfo && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-bg-secondary rounded-lg p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">현재 버전:</span>
                  <Badge variant="info">{updateInfo.currentVersion || '알 수 없음'}</Badge>
                </div>
              </div>
              {updateInfo.latestVersion && (
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">최신 버전:</span>
                    <Badge variant="success">{updateInfo.latestVersion}</Badge>
                  </div>
                </div>
              )}
            </div>

            {updateInfo.updateAvailable ? (
              <div>
                <Alert variant="info" title="업데이트 가능">
                  새 버전이 있습니다. 업데이트하면 Gateway가 재시작됩니다.
                </Alert>
                <Button
                  onClick={runUpdate}
                  loading={updating}
                  className="mt-4"
                >
                  업데이트 실행
                </Button>
              </div>
            ) : (
              <Alert variant="success" title="최신 버전">
                현재 최신 버전을 사용 중입니다.
              </Alert>
            )}
          </div>
        )}

        {!updateInfo && !checking && (
          <div className="py-8 text-center">
            <p className="text-text-secondary text-sm">
              "업데이트 확인" 버튼을 클릭하여 최신 버전을 확인하세요.
            </p>
          </div>
        )}
      </Card>

      {/* 수동 업데이트 가이드 */}
      <Card className="p-6 mt-4">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          수동 업데이트
        </h3>
        <div className="space-y-3">
          <div className="bg-bg-secondary rounded-lg p-3">
            <p className="text-xs font-medium text-text-secondary mb-2">npm</p>
            <pre className="text-xs text-text-primary bg-bg-primary rounded p-2 font-mono">
              npm update -g openclaw
            </pre>
          </div>
          <div className="bg-bg-secondary rounded-lg p-3">
            <p className="text-xs font-medium text-text-secondary mb-2">Docker</p>
            <pre className="text-xs text-text-primary bg-bg-primary rounded p-2 font-mono">
              docker pull openclaw/gateway:latest{'\n'}docker-compose up -d
            </pre>
          </div>
        </div>
      </Card>
    </div>
  )
}
