import { EventEmitter } from 'events'
// @ts-ignore — ws 타입 선언 없음
import WebSocket from 'ws'

// ─── 타입 정의 ───

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

export interface ConnectionConfig {
  type: 'websocket'
  url: string     // ws://host:port
  token: string
}

export interface GatewayInfo {
  version?: string
  uptime?: number
  channels?: string[]
  sessionsActive?: number
}

export interface ConnectionStatus {
  state: ConnectionState
  config: ConnectionConfig | null
  gatewayInfo: GatewayInfo | null
  connectedAt: number | null
  reconnectAttempt: number
  maxReconnectAttempts: number
  lastError: string | null
}

export interface ConnectionEvent {
  type: 'state-change' | 'gateway-info' | 'error'
  state?: ConnectionState
  previousState?: ConnectionState
  gatewayInfo?: GatewayInfo
  error?: string
  reconnectAttempt?: number
  timestamp: number
}

interface RpcMessage {
  id: string
  method: string
  params?: unknown
}

// ─── 상수 ───

const MAX_RECONNECT_ATTEMPTS = 10
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000] // 지수 백오프, 30s 최대
const RPC_TIMEOUT = 30000

/**
 * ConnectionManager: Gateway 연결 생명주기 관리
 *
 * 기존 GatewayClient의 연결 관리 + RPC를 합쳐서 단일 진입점으로 제공.
 * EventEmitter로 상태 변화를 실시간 전파하여 WebSocket 클라이언트에게 알림.
 *
 * 사용법:
 *   const cm = getConnectionManager()
 *   await cm.connect({ type: 'websocket', url: 'ws://localhost:18789', token: '...' })
 *   const result = await cm.rpc('status')
 */
export class ConnectionManager extends EventEmitter {
  private static instance: ConnectionManager | null = null

  private ws: WebSocket | null = null
  private config: ConnectionConfig | null = null
  private state: ConnectionState = 'disconnected'
  private gatewayInfo: GatewayInfo | null = null
  private connectedAt: number | null = null

  // RPC
  private rpcIdCounter = 0
  private pendingRpcs = new Map<
    string,
    { resolve: (value: any) => void; reject: (err: Error) => void }
  >()

  // 재연결
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private autoReconnect = true

  // 에러
  private lastError: string | null = null

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager()
    }
    return ConnectionManager.instance
  }

  // ─── 공개 API ───

  /**
   * Gateway에 연결
   */
  async connect(config: ConnectionConfig): Promise<void> {
    // 이미 연결 중이면 기존 연결 해제
    if (this.ws) {
      this.autoReconnect = false
      this._cleanup()
    }

    this.config = config
    this.autoReconnect = true
    this.reconnectAttempt = 0
    this.lastError = null

    return this._doConnect()
  }

  /**
   * 연결 해제
   */
  async disconnect(): Promise<void> {
    this.autoReconnect = false
    this._cleanup()
    this._setState('disconnected')
  }

  /**
   * 수동 재연결
   */
  async reconnect(): Promise<void> {
    if (!this.config) {
      throw new Error('연결 설정이 없습니다. 먼저 connect()를 호출하세요.')
    }

    this.autoReconnect = true
    this.reconnectAttempt = 0
    this.lastError = null

    if (this.ws) {
      this._cleanup()
    }

    return this._doConnect()
  }

  /**
   * Gateway RPC 호출
   */
  async rpc(method: string, params?: unknown): Promise<any> {
    if (!this.ws || this.state !== 'connected') {
      throw new Error('Gateway에 연결되어 있지 않습니다')
    }

    const id = `rpc-${++this.rpcIdCounter}`
    const message: RpcMessage = { id, method, ...(params !== undefined && { params }) }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRpcs.delete(id)
        reject(new Error(`RPC 타임아웃: ${method}`))
      }, RPC_TIMEOUT)

      this.pendingRpcs.set(id, {
        resolve: (value) => {
          clearTimeout(timeout)
          resolve(value)
        },
        reject: (err) => {
          clearTimeout(timeout)
          reject(err)
        },
      })

      this.ws!.send(JSON.stringify(message))
    })
  }

  /**
   * 현재 연결 상태 반환
   */
  getStatus(): ConnectionStatus {
    return {
      state: this.state,
      config: this.config
        ? { ...this.config, token: '***' } // 토큰 마스킹
        : null,
      gatewayInfo: this.gatewayInfo,
      connectedAt: this.connectedAt,
      reconnectAttempt: this.reconnectAttempt,
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      lastError: this.lastError,
    }
  }

  /**
   * Gateway 정보 반환
   */
  getGatewayInfo(): GatewayInfo | null {
    return this.gatewayInfo
  }

  /**
   * 연결 여부 확인
   */
  isConnected(): boolean {
    return this.state === 'connected'
  }

  // ─── 내부 구현 ───

  private _doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        return reject(new Error('연결 설정이 없습니다'))
      }

      const isReconnect = this.reconnectAttempt > 0
      this._setState(isReconnect ? 'reconnecting' : 'connecting')

      this.ws = new WebSocket(this.config.url, {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
        },
      })

      this.ws.on('open', async () => {
        this.reconnectAttempt = 0
        this.connectedAt = Date.now()
        this._setState('connected')

        // 연결 직후 Gateway 정보 수집
        try {
          await this._fetchGatewayInfo()
        } catch {
          // 정보 수집 실패는 연결 실패가 아님
        }

        resolve()
      })

      this.ws.on('message', (data: any) => {
        try {
          const msg = JSON.parse(data.toString())

          // RPC 응답 처리
          if (msg.id && this.pendingRpcs.has(msg.id)) {
            const pending = this.pendingRpcs.get(msg.id)!
            this.pendingRpcs.delete(msg.id)
            if (msg.error) {
              pending.reject(new Error(typeof msg.error === 'string' ? msg.error : JSON.stringify(msg.error)))
            } else {
              pending.resolve(msg.result)
            }
            return
          }

          // 이벤트 메시지 (Gateway가 push하는 경우)
          if (msg.type) {
            this.emit('gateway-event', msg)
          }
        } catch {
          // Non-JSON 메시지 무시
        }
      })

      this.ws.on('close', (code: number, reason: string) => {
        const wasConnected = this.state === 'connected'
        this._rejectAllPending()

        if (this.autoReconnect && this.config) {
          this._scheduleReconnect()
        } else {
          this._setState('disconnected')
        }

        if (wasConnected) {
          console.log(`[ConnectionManager] 연결 종료 (code=${code})`)
        }
      })

      this.ws.on('error', (err: Error) => {
        this.lastError = err.message
        console.error(`[ConnectionManager] 오류: ${err.message}`)

        // 최초 연결 시도에서만 reject
        if (this.state === 'connecting') {
          this._setState('error')
          reject(err)
        }
        // reconnecting 상태에서는 _scheduleReconnect가 처리
      })
    })
  }

  private _setState(newState: ConnectionState) {
    const previousState = this.state
    if (previousState === newState) return

    this.state = newState
    const event: ConnectionEvent = {
      type: 'state-change',
      state: newState,
      previousState,
      reconnectAttempt: this.reconnectAttempt,
      timestamp: Date.now(),
    }

    if (newState === 'error') {
      event.error = this.lastError || undefined
    }

    this.emit('event', event)
  }

  private async _fetchGatewayInfo() {
    try {
      const [health, status] = await Promise.allSettled([
        this.rpc('health'),
        this.rpc('status'),
      ])

      this.gatewayInfo = {
        version: status.status === 'fulfilled' ? status.value?.version : undefined,
        uptime: health.status === 'fulfilled' ? health.value?.uptime : undefined,
        channels: status.status === 'fulfilled' ? status.value?.channels : undefined,
        sessionsActive: status.status === 'fulfilled' ? status.value?.sessionsActive : undefined,
      }

      const infoEvent: ConnectionEvent = {
        type: 'gateway-info',
        gatewayInfo: this.gatewayInfo,
        timestamp: Date.now(),
      }
      this.emit('event', infoEvent)
    } catch (err: any) {
      console.warn(`[ConnectionManager] Gateway 정보 수집 실패: ${err.message}`)
    }
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) return
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.lastError = `최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS}) 초과`
      this._setState('error')
      return
    }

    const delayIndex = Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)
    const delay = RECONNECT_DELAYS[delayIndex]
    this.reconnectAttempt++

    this._setState('reconnecting')

    console.log(
      `[ConnectionManager] 재연결 시도 ${this.reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS} (${delay}ms 후)`
    )

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      if (!this.config || !this.autoReconnect) return

      try {
        await this._doConnect()
      } catch {
        // _doConnect 실패 시 ws.on('close')에서 다시 _scheduleReconnect 호출
      }
    }, delay)
  }

  private _cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      // close 이벤트에서 재연결 방지
      this.ws.removeAllListeners()
      this.ws.close()
      this.ws = null
    }
    this._rejectAllPending()
    this.gatewayInfo = null
    this.connectedAt = null
  }

  private _rejectAllPending() {
    for (const [, pending] of this.pendingRpcs) {
      pending.reject(new Error('연결이 종료되었습니다'))
    }
    this.pendingRpcs.clear()
  }
}

// ─── 편의 접근자 ───

export function getConnectionManager(): ConnectionManager {
  return ConnectionManager.getInstance()
}
