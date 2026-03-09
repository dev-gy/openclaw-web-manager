import React, { useState, useEffect, useCallback } from 'react'
import { Card, Badge, Button, Alert, LoadingSkeleton, SetupRequired } from '../../../components/ui'
import { useConnectionStatus } from '../../../hooks/useConnectionStatus'

/**
 * 보안 설정 페이지
 *
 * 게임 UI 컨셉: "🛡️ 성벽 방어 설정"
 * - API 토큰 관리
 * - 허용 IP / CORS 설정
 * - Rate limiting
 * - 인증 관련 설정
 */

interface SecurityConfig {
  auth: {
    token?: string
    tokenRotationDays?: number
    allowAnonymous?: boolean
  }
  cors: {
    enabled: boolean
    origins: string[]
    methods: string[]
  }
  rateLimit: {
    enabled: boolean
    maxRequests: number
    windowMs: number
  }
  ipWhitelist: {
    enabled: boolean
    addresses: string[]
  }
}

const defaultConfig: SecurityConfig = {
  auth: { token: '', tokenRotationDays: 90, allowAnonymous: false },
  cors: { enabled: true, origins: ['*'], methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
  rateLimit: { enabled: true, maxRequests: 100, windowMs: 60000 },
  ipWhitelist: { enabled: false, addresses: [] },
}

export default function Page() {
  const { isConnected, isLoading: connectionLoading, status } = useConnectionStatus()
  const [config, setConfig] = useState<SecurityConfig>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // 보안 설정 로드
  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/config/current')
      if (res.ok) {
        const data = await res.json()
        const raw = data.config || data
        // 보안 관련 설정만 추출
        setConfig({
          auth: {
            token: raw.gateway?.token || raw.auth?.token || '',
            tokenRotationDays: raw.auth?.tokenRotationDays || 90,
            allowAnonymous: raw.auth?.allowAnonymous ?? false,
          },
          cors: {
            enabled: raw.cors?.enabled ?? true,
            origins: raw.cors?.origins || ['*'],
            methods: raw.cors?.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          },
          rateLimit: {
            enabled: raw.rateLimit?.enabled ?? true,
            maxRequests: raw.rateLimit?.maxRequests || 100,
            windowMs: raw.rateLimit?.windowMs || 60000,
          },
          ipWhitelist: {
            enabled: raw.ipWhitelist?.enabled ?? false,
            addresses: raw.ipWhitelist?.addresses || [],
          },
        })
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // --- 연결 상태 게이트 ---
  if (connectionLoading) return <LoadingSkeleton variant="list" lines={5} />
  if (!isConnected && !status.config && !status.lastError) {
    return <SetupRequired pageName="성벽 방어" variant="setup" />
  }
  if (!isConnected && !status.config && status.lastError) {
    return (
      <SetupRequired
        pageName="성벽 방어"
        variant="error"
        errorMessage={status.lastError}
        onRetry={() => window.location.reload()}
      />
    )
  }
  if (!isConnected) {
    return <SetupRequired pageName="성벽 방어" variant="disconnected" />
  }

  const updateConfig = <K extends keyof SecurityConfig>(
    section: K,
    field: string,
    value: unknown,
  ) => {
    setConfig((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      // 보안 설정을 전체 config에 패치
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            auth: config.auth,
            cors: config.cors,
            rateLimit: config.rateLimit,
            ipWhitelist: config.ipWhitelist,
          },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setSuccess('보안 설정이 저장되었습니다')
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // 보안 점수 계산
  const securityScore = calculateSecurityScore(config)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-secondary">보안 설정을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">🛡️ 성벽 방어 설정</h2>
          <p className="text-sm text-text-secondary mt-1">
            Gateway 보안 정책 관리 — 토큰, CORS, Rate Limit, IP 화이트리스트
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && <Badge variant="warning">변경사항 있음</Badge>}
          {success && <Badge variant="success">{success}</Badge>}
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {!isConnected && (
        <Alert variant="warning" className="mb-4">
          Gateway에 연결되어 있지 않습니다. 보안 설정 변경이 제한됩니다.
        </Alert>
      )}

      {/* 보안 점수 */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                securityScore >= 80
                  ? 'bg-success/10 text-success'
                  : securityScore >= 50
                  ? 'bg-warning/10 text-warning'
                  : 'bg-error/10 text-error'
              }`}
            >
              {securityScore}
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">
                방어력: {securityScore >= 80 ? '강력' : securityScore >= 50 ? '보통' : '취약'}
              </h3>
              <p className="text-sm text-text-secondary">
                {securityScore >= 80
                  ? '성벽이 튼튼합니다! 대부분의 보안 설정이 활성화되어 있습니다.'
                  : securityScore >= 50
                  ? '기본 방어는 되지만, 추가 설정을 권장합니다.'
                  : '보안 설정이 부족합니다. 아래 항목들을 확인하세요!'}
              </p>
            </div>
          </div>
          <div className="w-32 h-2 bg-bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                securityScore >= 80 ? 'bg-success' : securityScore >= 50 ? 'bg-warning' : 'bg-error'
              }`}
              style={{ width: `${securityScore}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 인증 설정 */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              🔑 인증
            </h3>
            <SecurityBadge active={!!config.auth.token && !config.auth.allowAnonymous} />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">API 토큰</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={config.auth.token || ''}
                  onChange={(e) => updateConfig('auth', 'token', e.target.value)}
                  placeholder="Gateway 인증 토큰"
                  className="flex-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const token = crypto.randomUUID().replace(/-/g, '')
                    updateConfig('auth', 'token', token)
                  }}
                >
                  생성
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">
                토큰 갱신 주기 (일)
              </label>
              <input
                type="number"
                value={config.auth.tokenRotationDays || 90}
                onChange={(e) => updateConfig('auth', 'tokenRotationDays', Number(e.target.value))}
                min={1}
                max={365}
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.auth.allowAnonymous}
                onChange={(e) => updateConfig('auth', 'allowAnonymous', e.target.checked)}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
              />
              <div>
                <span className="text-sm text-text-primary">익명 접근 허용</span>
                <p className="text-xs text-text-secondary">⚠️ 개발 환경에서만 권장</p>
              </div>
            </label>
          </div>
        </Card>

        {/* CORS 설정 */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              🌐 CORS
            </h3>
            <SecurityBadge active={config.cors.enabled && !config.cors.origins.includes('*')} />
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.cors.enabled}
                onChange={(e) => updateConfig('cors', 'enabled', e.target.checked)}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
              />
              <span className="text-sm text-text-primary">CORS 활성화</span>
            </label>

            {config.cors.enabled && (
              <>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    허용 오리진 (줄 단위)
                  </label>
                  <textarea
                    value={config.cors.origins.join('\n')}
                    onChange={(e) =>
                      updateConfig('cors', 'origins', e.target.value.split('\n').filter(Boolean))
                    }
                    rows={3}
                    placeholder="https://example.com&#10;* (모든 오리진)"
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary font-mono focus:outline-none focus:border-accent resize-none"
                  />
                  {config.cors.origins.includes('*') && (
                    <p className="text-xs text-warning mt-1">
                      ⚠️ 모든 오리진 허용 중 — 운영 환경에서는 특정 도메인만 허용하세요
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">허용 메서드</label>
                  <div className="flex flex-wrap gap-2">
                    {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].map((method) => (
                      <button
                        key={method}
                        onClick={() => {
                          const methods = config.cors.methods.includes(method)
                            ? config.cors.methods.filter((m) => m !== method)
                            : [...config.cors.methods, method]
                          updateConfig('cors', 'methods', methods)
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                          config.cors.methods.includes(method)
                            ? 'bg-accent/10 text-accent border border-accent/30'
                            : 'bg-bg-secondary text-text-secondary border border-border hover:border-accent/30'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Rate Limiting */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              ⚡ Rate Limiting
            </h3>
            <SecurityBadge active={config.rateLimit.enabled} />
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.rateLimit.enabled}
                onChange={(e) => updateConfig('rateLimit', 'enabled', e.target.checked)}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
              />
              <span className="text-sm text-text-primary">Rate Limiting 활성화</span>
            </label>

            {config.rateLimit.enabled && (
              <>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    최대 요청 수 (윈도우당)
                  </label>
                  <input
                    type="number"
                    value={config.rateLimit.maxRequests}
                    onChange={(e) =>
                      updateConfig('rateLimit', 'maxRequests', Number(e.target.value))
                    }
                    min={1}
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    시간 윈도우 (초)
                  </label>
                  <input
                    type="number"
                    value={Math.floor(config.rateLimit.windowMs / 1000)}
                    onChange={(e) =>
                      updateConfig('rateLimit', 'windowMs', Number(e.target.value) * 1000)
                    }
                    min={1}
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    {config.rateLimit.maxRequests}회 / {Math.floor(config.rateLimit.windowMs / 1000)}초
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* IP 화이트리스트 */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              🏰 IP 화이트리스트
            </h3>
            <SecurityBadge active={config.ipWhitelist.enabled} />
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.ipWhitelist.enabled}
                onChange={(e) => updateConfig('ipWhitelist', 'enabled', e.target.checked)}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
              />
              <div>
                <span className="text-sm text-text-primary">IP 화이트리스트 활성화</span>
                <p className="text-xs text-text-secondary">허용된 IP에서만 접근 가능</p>
              </div>
            </label>

            {config.ipWhitelist.enabled && (
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  허용 IP (줄 단위)
                </label>
                <textarea
                  value={config.ipWhitelist.addresses.join('\n')}
                  onChange={(e) =>
                    updateConfig(
                      'ipWhitelist',
                      'addresses',
                      e.target.value.split('\n').filter(Boolean),
                    )
                  }
                  rows={4}
                  placeholder="127.0.0.1&#10;192.168.1.0/24&#10;10.0.0.0/8"
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary font-mono focus:outline-none focus:border-accent resize-none"
                />
                {config.ipWhitelist.addresses.length === 0 && (
                  <p className="text-xs text-error mt-1">
                    ⚠️ IP를 등록하지 않으면 모든 접근이 차단됩니다!
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 보안 체크리스트 */}
      <Card className="p-5 mt-4">
        <h3 className="font-semibold text-text-primary mb-3">📋 보안 체크리스트</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <CheckItem ok={!!config.auth.token} label="API 토큰 설정됨" />
          <CheckItem ok={!config.auth.allowAnonymous} label="익명 접근 비활성화" />
          <CheckItem ok={config.cors.enabled} label="CORS 정책 활성화" />
          <CheckItem ok={!config.cors.origins.includes('*')} label="CORS 오리진 제한" />
          <CheckItem ok={config.rateLimit.enabled} label="Rate Limiting 활성화" />
          <CheckItem
            ok={config.rateLimit.maxRequests <= 200}
            label="적절한 요청 제한 수"
          />
          <CheckItem ok={config.ipWhitelist.enabled} label="IP 화이트리스트 활성화" />
          <CheckItem
            ok={(config.auth.tokenRotationDays || 999) <= 90}
            label="토큰 갱신 주기 90일 이내"
          />
        </div>
      </Card>

      {/* 하단 액션 */}
      <div className="flex items-center justify-end gap-2 mt-4 p-4 bg-card border border-border rounded-xl">
        <Button variant="secondary" size="sm" onClick={load}>
          새로고침
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges || !isConnected}
        >
          보안 설정 저장
        </Button>
      </div>

      {/* 안내 */}
      <div className="mt-4 p-4 bg-bg-secondary rounded-lg">
        <p className="text-sm text-text-secondary">
          🛡️ 보안 설정 변경은 저장 후 <strong>설정 적용</strong> 과정을 거쳐야 반영됩니다.
          일부 설정(토큰 변경 등)은 Gateway 재시작이 필요할 수 있습니다.
        </p>
      </div>
    </div>
  )
}

// ─── 서브 컴포넌트 ───

function SecurityBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'success' : 'warning'} size="sm">
      {active ? '보호됨' : '미설정'}
    </Badge>
  )
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={ok ? 'text-success' : 'text-error'}>
        {ok ? '✓' : '✗'}
      </span>
      <span className={ok ? 'text-text-primary' : 'text-text-secondary'}>
        {label}
      </span>
    </div>
  )
}

// ─── 유틸 ───

function calculateSecurityScore(config: SecurityConfig): number {
  let score = 0
  const total = 8

  if (config.auth.token) score++
  if (!config.auth.allowAnonymous) score++
  if (config.cors.enabled) score++
  if (!config.cors.origins.includes('*')) score++
  if (config.rateLimit.enabled) score++
  if (config.rateLimit.maxRequests <= 200) score++
  if (config.ipWhitelist.enabled) score++
  if ((config.auth.tokenRotationDays || 999) <= 90) score++

  return Math.round((score / total) * 100)
}
