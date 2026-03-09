// @ts-ignore — ws 타입 선언 없음
import WebSocket from 'ws'

// ─── 타입 정의 ───

export interface DiscoveryResult {
  found: boolean
  source: 'env' | 'port_scan' | 'manual' | null
  url: string | null
  token: string | null
  info: GatewayProbeInfo | null
  candidates: DiscoveryCandidate[]
  duration: number // ms
}

export interface DiscoveryCandidate {
  url: string
  source: 'env' | 'port_scan'
  reachable: boolean
  needsToken: boolean
  info?: GatewayProbeInfo | null
  error?: string | null
}

export interface GatewayProbeInfo {
  version?: string
  uptime?: number
  name?: string
}

// ─── 상수 ───

const SCAN_PORTS = [18789, 3000, 3001, 8080, 8443]
const PROBE_TIMEOUT = 3000 // ms
const ENV_URL_KEYS = ['OPENCLAW_WS_URL', 'OPENCLAW_GATEWAY_URL', 'GATEWAY_URL']
const ENV_TOKEN_KEYS = ['OPENCLAW_TOKEN', 'OPENCLAW_GATEWAY_TOKEN', 'GATEWAY_TOKEN']

/**
 * AutoDiscovery: Gateway 자동 감지
 *
 * 3단계 감지 순서:
 * 1. 환경 변수 (Docker Compose 등)
 * 2. 로컬호스트 포트 스캔
 *
 * 각 후보에 WebSocket probe를 실행하여 실제 Gateway인지 확인.
 */
export async function discoverGateway(): Promise<DiscoveryResult> {
  const startTime = Date.now()
  const candidates: DiscoveryCandidate[] = []

  // ─ Step 1: 환경 변수 확인 ─
  const envUrl = findEnvValue(ENV_URL_KEYS)
  const envToken = findEnvValue(ENV_TOKEN_KEYS)

  if (envUrl) {
    const url = normalizeWsUrl(envUrl)
    const probe = await probeGateway(url, envToken || undefined)
    candidates.push({
      url,
      source: 'env',
      reachable: probe.reachable,
      needsToken: probe.needsToken,
      info: probe.info,
      error: probe.error,
    })

    // 환경 변수에서 찾았고 연결 성공하면 즉시 반환
    if (probe.reachable && !probe.needsToken) {
      return {
        found: true,
        source: 'env',
        url,
        token: envToken,
        info: probe.info,
        candidates,
        duration: Date.now() - startTime,
      }
    }
  }

  // ─ Step 2: 로컬호스트 포트 스캔 ─
  const scanResults = await Promise.allSettled(
    SCAN_PORTS.map(async (port) => {
      const url = `ws://localhost:${port}`
      // 환경 변수와 중복 방지
      if (envUrl && normalizeWsUrl(envUrl) === url) return null

      const probe = await probeGateway(url, envToken || undefined)
      return { url, port, probe }
    })
  )

  for (const result of scanResults) {
    if (result.status !== 'fulfilled' || !result.value) continue
    const { url, probe } = result.value

    candidates.push({
      url,
      source: 'port_scan',
      reachable: probe.reachable,
      needsToken: probe.needsToken,
      info: probe.info,
      error: probe.error,
    })
  }

  // 결과 정리: reachable 후보 중 첫 번째 선택
  const bestCandidate = candidates.find((c) => c.reachable && !c.needsToken)
    || candidates.find((c) => c.reachable)

  return {
    found: !!bestCandidate?.reachable,
    source: bestCandidate?.source || null,
    url: bestCandidate?.url || null,
    token: bestCandidate && !bestCandidate.needsToken ? envToken : null,
    info: bestCandidate?.info || null,
    candidates,
    duration: Date.now() - startTime,
  }
}

// ─── 헬퍼 ───

function findEnvValue(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]
    if (value) return value
  }
  return null
}

function normalizeWsUrl(url: string): string {
  // http:// → ws://, https:// → wss://
  if (url.startsWith('http://')) return url.replace('http://', 'ws://')
  if (url.startsWith('https://')) return url.replace('https://', 'wss://')
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) return `ws://${url}`
  return url
}

interface ProbeResult {
  reachable: boolean
  needsToken: boolean
  info: GatewayProbeInfo | null
  error?: string
}

/**
 * WebSocket으로 Gateway에 probe 시도
 * health RPC를 보내 응답 확인
 */
async function probeGateway(url: string, token?: string): Promise<ProbeResult> {
  return new Promise<ProbeResult>((resolve) => {
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    let resolved = false
    const ws = new WebSocket(url, { headers })

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        ws.close()
        resolve({ reachable: false, needsToken: false, info: null, error: '타임아웃' })
      }
    }, PROBE_TIMEOUT)

    ws.on('open', () => {
      // health RPC 시도
      try {
        ws.send(JSON.stringify({ id: 'probe-1', method: 'health' }))
      } catch {
        clearTimeout(timeout)
        resolved = true
        ws.close()
        resolve({ reachable: true, needsToken: false, info: null })
      }
    })

    ws.on('message', (data: any) => {
      if (resolved) return
      clearTimeout(timeout)
      resolved = true

      try {
        const msg = JSON.parse(data.toString())
        ws.close()

        // 인증 에러 응답
        if (msg.error && (
          msg.error.includes?.('auth') ||
          msg.error.includes?.('unauthorized') ||
          msg.error.includes?.('token')
        )) {
          resolve({
            reachable: true,
            needsToken: true,
            info: null,
            error: '인증 필요',
          })
          return
        }

        resolve({
          reachable: true,
          needsToken: false,
          info: msg.result ? {
            version: msg.result.version,
            uptime: msg.result.uptime,
            name: msg.result.name,
          } : null,
        })
      } catch {
        ws.close()
        resolve({ reachable: true, needsToken: false, info: null })
      }
    })

    ws.on('error', (err: any) => {
      if (resolved) return
      clearTimeout(timeout)
      resolved = true

      // 403/401 에러 → Gateway는 있지만 인증 필요
      const errMsg = err.message || ''
      if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Unauthorized')) {
        resolve({
          reachable: true,
          needsToken: true,
          info: null,
          error: '인증 필요',
        })
        return
      }

      resolve({
        reachable: false,
        needsToken: false,
        info: null,
        error: errMsg || '연결 실패',
      })
    })

    ws.on('close', () => {
      if (resolved) return
      clearTimeout(timeout)
      resolved = true
      resolve({ reachable: false, needsToken: false, info: null, error: '연결 종료' })
    })
  })
}
