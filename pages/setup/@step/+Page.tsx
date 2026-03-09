import React, { useState, useEffect, useCallback, useRef } from 'react'
import { usePageContext } from 'vike-react/usePageContext'
import { Button, Card, Input, Alert, Stepper, Terminal, Badge } from '../../../components/ui'
import { useConnectionStatus, type DiscoveryResult } from '../../../hooks/useConnectionStatus'
import { useInstallStream } from '../../../hooks/useInstallStream'
import { formatUptime } from '../../../lib/format'
import type { EnvironmentInfo } from '../../../server/services/env-detect.js'

// ─── 모드 & 스텝 ───

type WizardMode = 'connect' | 'install'
type ConnectStep = 'detect' | 'connect' | 'verify' | 'complete'
type InstallStep = 'env' | 'configure' | 'installing' | 'complete'

const CONNECT_STEPS = [
  { id: 'detect', title: '자동 감지' },
  { id: 'connect', title: '연결 설정' },
  { id: 'verify', title: '연결 확인' },
  { id: 'complete', title: '완료' },
]

const INSTALL_STEPS = [
  { id: 'env', title: '환경 확인' },
  { id: 'configure', title: '설정' },
  { id: 'installing', title: '설치 및 시작' },
  { id: 'complete', title: '완료' },
]

// ─── 메인 페이지 ───

export default function Page() {
  const { routeParams } = usePageContext()
  const stepParam = routeParams?.step as string

  const [mode, setMode] = useState<WizardMode>('connect')
  const [connectStep, setConnectStep] = useState<ConnectStep>('detect')
  const [installStep, setInstallStep] = useState<InstallStep>('env')

  // step 파라미터 초기화
  useEffect(() => {
    const stepMap: Record<string, ConnectStep> = {
      '1': 'detect', '2': 'connect', '3': 'verify', '4': 'complete',
      'detect': 'detect', 'connect': 'connect', 'verify': 'verify', 'complete': 'complete',
    }
    if (stepMap[stepParam]) setConnectStep(stepMap[stepParam])
  }, [stepParam])

  const switchToInstall = () => {
    setMode('install')
    setInstallStep('env')
  }

  const switchToConnect = () => {
    setMode('connect')
    setConnectStep('detect')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-text-primary">
          {mode === 'connect' ? '🧙 Gateway 연결' : '🏗️ OpenClaw 설치'}
        </h2>
        <button
          onClick={mode === 'connect' ? switchToInstall : switchToConnect}
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          {mode === 'connect' ? '설치 모드로 전환' : '연결 모드로 전환'}
        </button>
      </div>
      <p className="text-text-secondary mb-6">
        {mode === 'connect'
          ? '기존 OpenClaw Gateway에 연결합니다.'
          : 'OpenClaw을 새로 설치하고 시작합니다.'}
      </p>

      {mode === 'connect' ? (
        <>
          <Stepper steps={CONNECT_STEPS} currentStep={connectStep} className="mb-8" />

          {connectStep === 'detect' && (
            <StepDetect
              onNext={(discovery) => {
                if (discovery?.found) setConnectStep('verify')
                else setConnectStep('connect')
              }}
              onSwitchInstall={switchToInstall}
            />
          )}
          {connectStep === 'connect' && (
            <StepConnect
              onNext={() => setConnectStep('verify')}
              onBack={() => setConnectStep('detect')}
            />
          )}
          {connectStep === 'verify' && (
            <StepVerify
              onNext={() => setConnectStep('complete')}
              onBack={() => setConnectStep('connect')}
            />
          )}
          {connectStep === 'complete' && <StepComplete />}
        </>
      ) : (
        <>
          <Stepper steps={INSTALL_STEPS} currentStep={installStep} className="mb-8" />

          {installStep === 'env' && (
            <StepEnvCheck
              onNext={() => setInstallStep('configure')}
              onBack={switchToConnect}
            />
          )}
          {installStep === 'configure' && (
            <StepInstallConfigure
              onNext={() => setInstallStep('installing')}
              onBack={() => setInstallStep('env')}
            />
          )}
          {installStep === 'installing' && (
            <StepInstalling
              onComplete={() => setInstallStep('complete')}
            />
          )}
          {installStep === 'complete' && <StepInstallComplete />}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
//  연결 모드 스텝
// ═══════════════════════════════════════════

// ─── Step 1: 자동 감지 ───

function StepDetect({
  onNext,
  onSwitchInstall,
}: {
  onNext: (discovery?: DiscoveryResult) => void
  onSwitchInstall: () => void
}) {
  const { detect, connect } = useConnectionStatus()
  const [detecting, setDetecting] = useState(false)
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startDetection = useCallback(async () => {
    setDetecting(true)
    setError(null)
    setDiscovery(null)
    try {
      const result = await detect()
      setDiscovery(result)
    } catch (err: any) {
      setError(err.message || '자동 감지 실패')
    } finally {
      setDetecting(false)
    }
  }, [detect])

  useEffect(() => {
    startDetection()
  }, [startDetection])

  const handleConnect = async (url: string, token: string | null) => {
    setConnecting(true)
    setError(null)
    try {
      const success = await connect(url, token || '')
      if (success) {
        onNext(discovery!)
      } else {
        setError('연결에 실패했습니다. 토큰을 확인해주세요.')
      }
    } catch (err: any) {
      setError(err.message || '연결 실패')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Gateway 자동 감지
      </h3>

      {detecting && (
        <div className="flex items-center gap-3 py-8">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-2 border-accent/30" />
            <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
          <div>
            <p className="text-text-primary font-medium">Gateway를 찾고 있습니다...</p>
            <p className="text-sm text-text-secondary">환경 변수, 로컬 포트를 스캔 중</p>
          </div>
        </div>
      )}

      {!detecting && discovery && discovery.found && (
        <div>
          <Alert variant="success" title="Gateway를 찾았습니다!">
            <p>{discovery.url} ({discovery.source === 'env' ? '환경 변수' : '포트 스캔'})</p>
            {discovery.info?.version && (
              <p className="mt-1">버전: {discovery.info.version}</p>
            )}
          </Alert>
          <div className="mt-6 flex gap-3">
            <Button
              onClick={() => handleConnect(discovery.url!, discovery.token)}
              loading={connecting}
            >
              연결하기
            </Button>
            <Button variant="secondary" onClick={() => onNext()}>
              수동으로 설정
            </Button>
          </div>
        </div>
      )}

      {!detecting && discovery && !discovery.found && (
        <div>
          <Alert variant="info" title="Gateway를 찾지 못했습니다">
            <p>자동 감지로 Gateway를 찾지 못했습니다.</p>
          </Alert>

          {discovery.candidates.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-text-secondary mb-2">스캔 결과:</p>
              <div className="space-y-2">
                {discovery.candidates.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-bg-secondary rounded-lg px-3 py-2">
                    <span className="text-text-primary">{c.url}</span>
                    <span className={c.reachable ? 'text-warning' : 'text-text-secondary'}>
                      {c.reachable ? (c.needsToken ? '인증 필요' : '연결 가능') : c.error || '연결 불가'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button onClick={() => onNext()}>수동으로 연결</Button>
            <Button variant="secondary" onClick={startDetection}>다시 감지</Button>
          </div>

          {/* 설치 모드 안내 */}
          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center gap-3 p-3 bg-accent/5 rounded-lg">
              <span className="text-2xl">🏗️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">OpenClaw이 설치되지 않았나요?</p>
                <p className="text-xs text-text-secondary mt-0.5">설치 마법사로 자동 설치할 수 있습니다.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={onSwitchInstall}>
                설치하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && <Alert variant="error" className="mt-4">{error}</Alert>}

      <p className="text-xs text-text-secondary mt-6">
        감지 소요 시간: {discovery ? `${discovery.duration}ms` : '—'}
      </p>
    </Card>
  )
}

// ─── Step 2: 수동 연결 ───

function StepConnect({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { connect, testConnection } = useConnectionStatus()
  const [url, setUrl] = useState('ws://localhost:18789')
  const [token, setToken] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection(url, token)
    setTestResult(result)
    setTesting(false)
  }

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      const success = await connect(url, token)
      if (success) onNext()
      else setError('연결에 실패했습니다.')
    } catch (err: any) {
      setError(err.message || '연결 실패')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">연결 정보 입력</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Gateway URL</label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ws://localhost:18789" />
          <p className="text-xs text-text-secondary mt-1">WebSocket 주소. 예: ws://localhost:18789</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">인증 토큰</label>
          <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Gateway 토큰 입력" />
          <p className="text-xs text-text-secondary mt-1">Gateway 설정의 gateway.token 값</p>
        </div>
        {testResult && (
          <Alert variant={testResult.success ? 'success' : 'error'}>
            {testResult.success ? '연결 테스트 성공!' : `연결 테스트 실패: ${testResult.error}`}
          </Alert>
        )}
        {error && <Alert variant="error">{error}</Alert>}
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="secondary" onClick={onBack}>이전</Button>
        <Button variant="secondary" onClick={handleTest} loading={testing}>테스트</Button>
        <Button onClick={handleConnect} loading={connecting} disabled={!url}>연결하기</Button>
      </div>
    </Card>
  )
}

// ─── Step 3: 연결 확인 ───

function StepVerify({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { status, isConnected } = useConnectionStatus()

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">연결 확인</h3>
      {isConnected ? (
        <div>
          <Alert variant="success" title="Gateway에 연결되었습니다!">
            <div className="space-y-1 mt-2">
              {status.config?.url && <InfoRow label="URL" value={status.config.url} />}
              {status.gatewayInfo?.version && <InfoRow label="버전" value={status.gatewayInfo.version} />}
              {status.gatewayInfo?.uptime !== undefined && <InfoRow label="가동 시간" value={formatUptime(status.gatewayInfo.uptime)} />}
              {status.gatewayInfo?.sessionsActive !== undefined && <InfoRow label="활성 세션" value={String(status.gatewayInfo.sessionsActive)} />}
            </div>
          </Alert>
          <div className="flex gap-3 mt-6">
            <Button onClick={onNext}>대시보드로 이동</Button>
          </div>
        </div>
      ) : (
        <div>
          <Alert variant="warning" title="연결 중...">
            <p>Gateway 연결을 확인하고 있습니다.</p>
            {status.state === 'reconnecting' && (
              <p className="mt-1">재연결 시도 {status.reconnectAttempt}/{status.maxReconnectAttempts}</p>
            )}
            {status.lastError && <p className="mt-1 text-error">오류: {status.lastError}</p>}
          </Alert>
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={onBack}>이전</Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Step 4: 연결 완료 ───

function StepComplete() {
  const { status } = useConnectionStatus()

  return (
    <Card className="p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
        <span className="text-success text-3xl">&#10003;</span>
      </div>
      <h3 className="text-xl font-semibold text-text-primary mb-2">연결 완료!</h3>
      <p className="text-text-secondary mb-6">
        OpenClaw Gateway에 성공적으로 연결되었습니다.
      </p>
      {status.gatewayInfo?.version && (
        <p className="text-sm text-text-secondary mb-6">Gateway 버전: {status.gatewayInfo.version}</p>
      )}
      <div className="flex gap-3 justify-center">
        <a href="/" className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
          대시보드로 이동
        </a>
        <a href="/config" className="px-6 py-2.5 bg-bg-secondary hover:bg-border text-text-primary rounded-lg text-sm font-medium border border-border transition-colors">
          설정하기
        </a>
      </div>
    </Card>
  )
}

// ═══════════════════════════════════════════
//  설치 모드 스텝
// ═══════════════════════════════════════════

// ─── Install Step 1: 환경 확인 ───

function StepEnvCheck({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/install/environment')
      .then((res) => res.json())
      .then((data) => setEnvInfo(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        🔍 환경 확인
      </h3>

      {loading && (
        <div className="flex items-center gap-3 py-8">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-text-secondary">환경을 분석하고 있습니다...</p>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {envInfo && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <EnvInfoRow label="운영체제" value={envInfo.os} />
            <EnvInfoRow label="배포판" value={envInfo.distro} />
            <EnvInfoRow label="런타임" value={runtimeLabel(envInfo.runtime)} />
            <EnvInfoRow label="Node.js" value={envInfo.nodeVersion} />
            <EnvInfoRow label="RAM" value={`${envInfo.ramTotal} (여유: ${envInfo.ramFree})`} />
            <EnvInfoRow label="Root 권한" value={envInfo.isRoot ? '있음' : '없음'} />
          </div>

          {/* OpenClaw 설치 상태 */}
          <div className="p-4 bg-bg-secondary rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{envInfo.openclawInstalled ? '✅' : '📦'}</span>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {envInfo.openclawInstalled
                    ? `OpenClaw ${envInfo.openclawVersion} 설치됨`
                    : 'OpenClaw 미설치'}
                </p>
                <p className="text-xs text-text-secondary">
                  {envInfo.openclawInstalled
                    ? `경로: ${envInfo.openclawPath}`
                    : 'npm install -g openclaw 으로 설치합니다'}
                </p>
              </div>
            </div>
          </div>

          {/* 프로세스 관리 방식 안내 */}
          <div className="p-3 bg-accent/5 rounded-lg">
            <p className="text-xs text-text-secondary">
              <span className="font-medium text-text-primary">프로세스 관리:</span>{' '}
              {envInfo.runtime === 'systemd'
                ? 'systemd 서비스로 등록됩니다 (시스템 재시작 시 자동 실행)'
                : envInfo.runtime === 'docker'
                ? 'Docker 컨테이너 내부에서 직접 실행됩니다'
                : '직접 프로세스로 실행됩니다 (OWM 종료 시 함께 종료)'}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <Button variant="secondary" onClick={onBack}>연결 모드</Button>
        <Button onClick={onNext} disabled={loading}>다음</Button>
      </div>
    </Card>
  )
}

// ─── Install Step 2: 설정 입력 ───

function StepInstallConfigure({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [serverName, setServerName] = useState('My OpenClaw')
  const [gatewayPort, setGatewayPort] = useState('18789')
  const [gatewayToken, setGatewayToken] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const generateToken = () => {
    setGatewayToken(crypto.randomUUID())
  }

  const handleNext = () => {
    if (!gatewayToken.trim()) {
      setError('Gateway 토큰을 입력하거나 생성해주세요.')
      return
    }
    const portNum = parseInt(gatewayPort, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError('유효한 포트 번호를 입력해주세요 (1-65535).')
      return
    }

    // 설정을 sessionStorage에 임시 저장 (설치 스텝에서 사용)
    sessionStorage.setItem('owm_install_config', JSON.stringify({
      serverName,
      gatewayPort: portNum,
      gatewayToken,
      apiKey: apiKey || undefined,
    }))

    setError(null)
    onNext()
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Gateway 설정
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">서버 이름</label>
          <Input value={serverName} onChange={(e) => setServerName(e.target.value)} placeholder="My OpenClaw" />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Gateway 포트</label>
          <Input value={gatewayPort} onChange={(e) => setGatewayPort(e.target.value)} placeholder="18789" />
          <p className="text-xs text-text-secondary mt-1">Gateway WebSocket 서버 포트</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Gateway 토큰</label>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              value={gatewayToken}
              onChange={(e) => setGatewayToken(e.target.value)}
              placeholder="인증 토큰"
            />
            <Button variant="secondary" size="sm" onClick={generateToken}>
              생성
            </Button>
          </div>
          <p className="text-xs text-text-secondary mt-1">API 인증에 사용되는 시크릿 토큰</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            LLM API 키 <span className="text-text-secondary">(선택)</span>
          </label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
          <p className="text-xs text-text-secondary mt-1">OpenAI, Anthropic 등 LLM 서비스 API 키</p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="secondary" onClick={onBack}>이전</Button>
        <Button onClick={handleNext}>설치 시작</Button>
      </div>
    </Card>
  )
}

// ─── Install Step 3: 설치 & 시작 (터미널) ───

function StepInstalling({ onComplete }: { onComplete: () => void }) {
  const stream = useInstallStream()
  const fetchedRef = useRef(false)

  // 마운트 시: WS 연결 시도 + 즉시 설치 API 호출 (병렬)
  useEffect(() => {
    // WS 연결 시도 (실패해도 OK - polling fallback)
    stream.connect()

    // 설치 API 호출 (1회만, WS와 독립적)
    if (fetchedRef.current) return
    fetchedRef.current = true

    const configStr = sessionStorage.getItem('owm_install_config')
    if (!configStr) return

    const config = JSON.parse(configStr)

    fetch('/api/install/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }).catch((err) => {
      console.error('Install start failed:', err)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // WS 연결 실패 시 polling fallback
  useEffect(() => {
    // WS가 연결되어 있으면 polling 불필요
    if (stream.connected) return
    if (stream.isComplete || stream.isFailed) return

    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/install/status')
        if (!res.ok) return
        const data = await res.json()
        if (data.step === 'complete') {
          stream.reset()
          // 완료 상태를 직접 반영
          sessionStorage.removeItem('owm_install_config')
          clearInterval(poll)
          onComplete()
        }
      } catch {
        // polling 실패 무시
      }
    }, 2000)

    return () => clearInterval(poll)
  }, [stream.connected, stream.isComplete, stream.isFailed]) // eslint-disable-line react-hooks/exhaustive-deps

  // 완료 감지 (WS 경유)
  useEffect(() => {
    if (stream.isComplete) {
      sessionStorage.removeItem('owm_install_config')
    }
  }, [stream.isComplete])

  // 터미널 라인 변환
  const terminalLines = stream.logs.map((log) => ({
    text: log.message,
    type: (log.isStderr ? 'stderr' : 'stdout') as 'stdout' | 'stderr',
    timestamp: new Date(log.timestamp).toLocaleTimeString('ko-KR'),
  }))

  const stepLabels: Record<string, string> = {
    idle: '대기 중...',
    detecting: '환경 감지 중...',
    installing: '📦 OpenClaw 설치 중...',
    configuring: '설정 파일 작성 중...',
    starting: '프로세스 시작 중...',
    health_checking: '헬스 체크 중...',
    complete: '완료!',
    failed: '실패',
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">
          설치 및 시작
        </h3>
        <Badge
          variant={
            stream.isComplete ? 'success' :
            stream.isFailed ? 'error' :
            'info'
          }
          size="sm"
        >
          {stepLabels[stream.step] || stream.step}
        </Badge>
      </div>

      {/* 환경 정보 요약 */}
      {stream.envInfo && (
        <div className="mb-4 p-3 bg-bg-secondary rounded-lg text-xs text-text-secondary">
          <span className="font-medium text-text-primary">환경:</span>{' '}
          {stream.envInfo.distro} | {runtimeLabel(stream.envInfo.runtime)} | Node {stream.envInfo.nodeVersion}
          {stream.envInfo.openclawInstalled && ` | OpenClaw ${stream.envInfo.openclawVersion}`}
        </div>
      )}

      {/* 설치 진행률 바 */}
      <div className="mb-4">
        <InstallProgressBar step={stream.step} />
      </div>

      {/* 터미널 */}
      <Terminal
        lines={terminalLines}
        title="OpenClaw 설치"
        maxHeight="350px"
      />

      {/* 에러 */}
      {stream.isFailed && stream.error && (
        <Alert variant="error" className="mt-4">
          {stream.error}
        </Alert>
      )}

      {/* 완료 / 재시도 버튼 */}
      <div className="flex gap-3 mt-6">
        {stream.isComplete && (
          <Button onClick={onComplete}>완료</Button>
        )}
        {stream.isFailed && (
          <Button onClick={() => {
            stream.reset()
            stream.connect()
            const configStr = sessionStorage.getItem('owm_install_config')
            if (configStr) {
              setTimeout(() => {
                fetch('/api/install/start', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: configStr,
                }).catch(() => {})
              }, 500)
            }
          }}>
            재시도
          </Button>
        )}
        {!stream.isComplete && !stream.isFailed && (
          <Button
            variant="secondary"
            onClick={() => {
              fetch('/api/install/abort', { method: 'POST' })
            }}
          >
            중단
          </Button>
        )}
      </div>
    </Card>
  )
}

// ─── Install Step 4: 설치 완료 ───

function StepInstallComplete() {
  return (
    <Card className="p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">🎉</span>
      </div>
      <h3 className="text-xl font-semibold text-text-primary mb-2">
        설치 완료!
      </h3>
      <p className="text-text-secondary mb-6">
        OpenClaw Gateway가 설치되고 실행 중입니다.<br />
        이제 대시보드에서 모니터링하고 설정을 관리할 수 있습니다.
      </p>

      <div className="flex gap-3 justify-center">
        <a href="/" className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
          대시보드로 이동
        </a>
        <a href="/config" className="px-6 py-2.5 bg-bg-secondary hover:bg-border text-text-primary rounded-lg text-sm font-medium border border-border transition-colors">
          설정하기
        </a>
        <a href="/server" className="px-6 py-2.5 bg-bg-secondary hover:bg-border text-text-primary rounded-lg text-sm font-medium border border-border transition-colors">
          서버 상태
        </a>
      </div>
    </Card>
  )
}

// ═══════════════════════════════════════════
//  공통 유틸 컴포넌트
// ═══════════════════════════════════════════

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary font-mono">{value}</span>
    </div>
  )
}

function EnvInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 bg-bg-secondary rounded-lg">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-sm text-text-primary font-mono mt-0.5">{value}</p>
    </div>
  )
}

function InstallProgressBar({ step }: { step: string }) {
  const steps = ['detecting', 'installing', 'configuring', 'starting', 'health_checking', 'complete']
  const currentIdx = steps.indexOf(step)
  const progress = step === 'failed' ? 0 : step === 'complete' ? 100 : Math.max(0, ((currentIdx + 0.5) / steps.length) * 100)

  return (
    <div className="w-full bg-bg-secondary rounded-full h-2 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          step === 'failed' ? 'bg-error' : step === 'complete' ? 'bg-success' : 'bg-accent'
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

function runtimeLabel(runtime: string): string {
  const labels: Record<string, string> = {
    docker: 'Docker',
    systemd: 'systemd',
    bare: '직접 실행',
  }
  return labels[runtime] || runtime
}
