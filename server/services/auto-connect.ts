import { getConnectionManager } from './connection-manager.js'
import { discoverGateway } from './auto-discovery.js'
import { getDb } from '../db/index.js'

/**
 * Zero-Touch Auto-Connect
 *
 * OWM 서버 시작 시 자동으로 Gateway를 감지하고 연결합니다.
 *
 * 우선순위:
 * 1. DB에 저장된 이전 연결 정보로 재연결 시도
 * 2. 환경 변수 기반 감지 (OPENCLAW_WS_URL, OPENCLAW_TOKEN 등)
 * 3. 로컬호스트 포트 스캔
 *
 * 실패해도 서버 시작을 막지 않음 (로깅만).
 */
export async function tryAutoConnect(log: {
  info: (msg: string) => void
  warn: (msg: string) => void
}): Promise<boolean> {
  const cm = getConnectionManager()

  // 이미 연결되어 있으면 스킵
  if (cm.isConnected()) {
    log.info('[자동연결] 이미 Gateway에 연결되어 있습니다')
    return true
  }

  // ── Step 1: DB에서 이전 연결 정보 로드 ──
  try {
    const savedConnection = await loadSavedConnection()
    if (savedConnection) {
      log.info(`[자동연결] 저장된 연결 정보 발견 — ${savedConnection.url}`)
      try {
        await cm.connect({
          type: 'websocket',
          url: savedConnection.url,
          token: savedConnection.token,
        })
        log.info('[자동연결] ✅ 저장된 정보로 Gateway 연결 성공')
        return true
      } catch (err: any) {
        log.warn(`[자동연결] 저장된 연결 실패: ${err.message}`)
        // 실패하면 Step 2로 진행
      }
    }
  } catch (err: any) {
    log.warn(`[자동연결] DB 조회 실패: ${err.message}`)
  }

  // ── Step 2: 자동 감지 (환경 변수 + 포트 스캔) ──
  try {
    log.info('[자동연결] Gateway 자동 감지 시작...')
    const result = await discoverGateway()

    if (result.found && result.url && result.token) {
      log.info(`[자동연결] Gateway 감지됨 — ${result.url} (source: ${result.source})`)

      try {
        await cm.connect({
          type: 'websocket',
          url: result.url,
          token: result.token,
        })
        log.info('[자동연결] ✅ 자동 감지로 Gateway 연결 성공')
        return true
      } catch (err: any) {
        log.warn(`[자동연결] 감지된 Gateway 연결 실패: ${err.message}`)
      }
    } else if (result.found && result.url && !result.token) {
      log.info(`[자동연결] Gateway 감지됨 (${result.url}) — 토큰 필요, 수동 연결 대기`)
    } else {
      log.info(`[자동연결] Gateway를 찾지 못했습니다 (후보 ${result.candidates.length}개 검색, ${result.duration}ms)`)
    }
  } catch (err: any) {
    log.warn(`[자동연결] 자동 감지 실패: ${err.message}`)
  }

  return false
}

/**
 * DB에서 가장 최근 연결 성공한 서버의 Gateway 정보 로드
 */
async function loadSavedConnection(): Promise<{ url: string; token: string } | null> {
  try {
    const d = await getDb()
    const rows = d.exec(
      `SELECT host, gateway_port, gateway_token
       FROM servers
       WHERE status = 'connected' AND gateway_token IS NOT NULL
       ORDER BY updated_at DESC
       LIMIT 1`
    )

    if (rows.length === 0 || rows[0].values.length === 0) return null

    const [host, port, token] = rows[0].values[0] as [string, number, string]
    if (!host || !token) return null

    const effectiveHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
      ? 'localhost'
      : host
    const url = `ws://${effectiveHost}:${port || 18789}`

    return { url, token }
  } catch {
    return null
  }
}
