import React, { useState } from 'react'
import { Card, Button, Alert, Badge, Input } from '../../../components/ui'
import { StatusCard } from '../../../components/ui/StatusCard'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'

/**
 * 서버 연결 설정
 *
 * Gateway 연결 URL과 토큰을 변경하거나, 재연결/해제 등 연결 관리를 수행.
 * 설치 마법사(setup)를 거치지 않고 직접 연결 정보를 수정할 수 있음.
 */
export default function Page() {
  const {
    status,
    isConnected,
    isLoading,
    connect,
    disconnect,
    reconnect,
    testConnection,
  } = useConnectionStatus()

  const [url, setUrl] = useState(status.config?.url || 'ws://localhost:18789')
  const [token, setToken] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; info?: any } | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setError(null)
    try {
      const result = await testConnection(url, token)
      setTestResult(result)
    } catch (err: any) {
      setTestResult({ success: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    setSuccess(null)
    try {
      const ok = await connect(url, token)
      if (ok) {
        setSuccess('Gateway에 연결되었습니다')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError('연결에 실패했습니다')
      }
    } catch (err: any) {
      setError(err.message || '연결 오류')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    setError(null)
    try {
      await disconnect()
      setSuccess('연결이 해제되었습니다')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || '해제 오류')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleReconnect = async () => {
    setReconnecting(true)
    setError(null)
    try {
      const ok = await reconnect()
      if (ok) {
        setSuccess('재연결되었습니다')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError('재연결에 실패했습니다')
      }
    } catch (err: any) {
      setError(err.message || '재연결 오류')
    } finally {
      setReconnecting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">연결 설정</h2>
          <p className="text-sm text-text-secondary mt-1">Gateway 연결 정보를 관리합니다</p>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" className="mb-4">{success}</Alert>}

      {/* 현재 상태 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatusCard
          title="연결 상태"
          status={isConnected ? 'connected' : status.state === 'reconnecting' ? 'warning' : 'disconnected'}
          detail={
            isConnected
              ? '연결됨'
              : status.state === 'reconnecting'
                ? `재연결 시도 ${status.reconnectAttempt}/${status.maxReconnectAttempts}`
                : status.lastError || '연결되지 않음'
          }
        />
        <StatusCard
          title="Gateway"
          status={status.gatewayInfo?.version ? 'connected' : 'unknown'}
          detail={status.gatewayInfo?.version ? `v${status.gatewayInfo.version}` : '—'}
        />
        <StatusCard
          title="세션"
          status={status.gatewayInfo?.sessionsActive ? 'connected' : 'unknown'}
          detail={status.gatewayInfo?.sessionsActive !== undefined ? `활성 ${status.gatewayInfo.sessionsActive}개` : '—'}
        />
      </div>

      <div className="space-y-4">
        {/* 연결 정보 */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            연결 정보
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Gateway URL
              </label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="ws://localhost:18789"
              />
              <p className="text-xs text-text-secondary mt-1">
                Gateway WebSocket 서버의 주소입니다 (ws:// 또는 wss://)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                인증 토큰
              </label>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Gateway 인증 토큰"
              />
              <p className="text-xs text-text-secondary mt-1">
                {isConnected ? '새 토큰으로 재연결하려면 입력하세요' : 'Gateway 설정의 gatewayToken 값'}
              </p>
            </div>
          </div>

          {/* 테스트 결과 */}
          {testResult && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              testResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
            }`}>
              {testResult.success ? (
                <div>
                  <span className="font-medium">✓ 연결 테스트 성공</span>
                  {testResult.info?.version && (
                    <span className="ml-2 text-xs">v{testResult.info.version}</span>
                  )}
                </div>
              ) : (
                <div>
                  <span className="font-medium">✗ 연결 테스트 실패</span>
                  {testResult.error && (
                    <p className="text-xs mt-1">{testResult.error}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTest}
              loading={testing}
            >
              연결 테스트
            </Button>
            {isConnected ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReconnect}
                  loading={reconnecting}
                >
                  재연결
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDisconnect}
                  loading={disconnecting}
                >
                  연결 해제
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                loading={connecting}
                disabled={!url}
              >
                연결
              </Button>
            )}
          </div>
        </Card>

        {/* 연결 이력 */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            연결 정보 상세
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-secondary text-xs">현재 URL</span>
              <p className="text-text-primary font-mono text-sm truncate">
                {status.config?.url || '—'}
              </p>
            </div>
            <div>
              <span className="text-text-secondary text-xs">연결 시각</span>
              <p className="text-text-primary text-sm">
                {status.connectedAt
                  ? new Date(status.connectedAt).toLocaleString('ko-KR')
                  : '—'}
              </p>
            </div>
            <div>
              <span className="text-text-secondary text-xs">채널</span>
              <div className="flex gap-1 mt-1 flex-wrap">
                {status.gatewayInfo?.channels?.map((ch) => (
                  <Badge key={typeof ch === 'string' ? ch : String(ch)} variant="info" size="sm">
                    {typeof ch === 'string' ? ch : String(ch)}
                  </Badge>
                )) || <span className="text-text-secondary text-sm">—</span>}
              </div>
            </div>
            <div>
              <span className="text-text-secondary text-xs">상태</span>
              <p className="text-text-primary text-sm capitalize">{status.state}</p>
            </div>
          </div>
        </Card>

        {/* 안내 */}
        <div className="p-4 bg-bg-secondary rounded-lg">
          <p className="text-sm text-text-secondary">
            💡 처음 설정하는 경우{' '}
            <a href="/setup/1" className="text-accent hover:underline">설치 마법사</a>
            를 이용하면 더 간편합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
