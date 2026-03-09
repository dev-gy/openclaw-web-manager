// @ts-ignore — ws 타입 선언 없음
import WebSocket from 'ws'

interface GatewayConfig {
  host: string
  port: number
  token: string
}

interface RpcMessage {
  id: string
  method: string
  params?: unknown
}

/**
 * WebSocket RPC client for OpenClaw Gateway.
 * Singleton pattern — one connection per OWM server instance.
 * Multi-server support (P1) will use GatewayPool instead.
 */
export class GatewayClient {
  private static instance: GatewayClient | null = null

  private ws: WebSocket | null = null
  private config: GatewayConfig | null = null
  private connected = false
  private rpcIdCounter = 0
  private pendingRpcs = new Map<
    string,
    { resolve: (value: any) => void; reject: (err: Error) => void }
  >()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  static getInstance(): GatewayClient {
    if (!GatewayClient.instance) {
      GatewayClient.instance = new GatewayClient()
    }
    return GatewayClient.instance
  }

  isConnected(): boolean {
    return this.connected
  }

  async connect(config: GatewayConfig): Promise<void> {
    this.config = config
    return this._connect()
  }

  private _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        return reject(new Error('No gateway config'))
      }

      const url = `ws://${this.config.host}:${this.config.port}`

      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
        },
      })

      this.ws.on('open', () => {
        this.connected = true
        console.log(`[GatewayClient] Connected to ${url}`)
        resolve()
      })

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.id && this.pendingRpcs.has(msg.id)) {
            const pending = this.pendingRpcs.get(msg.id)!
            this.pendingRpcs.delete(msg.id)
            if (msg.error) {
              pending.reject(new Error(msg.error))
            } else {
              pending.resolve(msg.result)
            }
          }
        } catch {
          // Non-JSON or event message, ignore for now
        }
      })

      this.ws.on('close', () => {
        this.connected = false
        console.log('[GatewayClient] Disconnected')
        this._scheduleReconnect()
      })

      this.ws.on('error', (err: Error) => {
        this.connected = false
        console.error('[GatewayClient] Error:', err.message)
        if (!this.connected) {
          reject(err)
        }
      })
    })
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      if (this.config && !this.connected) {
        console.log('[GatewayClient] Attempting reconnect...')
        try {
          await this._connect()
        } catch {
          this._scheduleReconnect()
        }
      }
    }, 5000)
  }

  async rpc(method: string, params?: unknown): Promise<any> {
    if (!this.ws || !this.connected) {
      throw new Error('Gateway not connected')
    }

    const id = `rpc-${++this.rpcIdCounter}`
    const message: RpcMessage = { id, method, ...(params !== undefined && { params }) }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRpcs.delete(id)
        reject(new Error(`RPC timeout: ${method}`))
      }, 30000)

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

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false

    // Reject all pending RPCs
    for (const [id, pending] of this.pendingRpcs) {
      pending.reject(new Error('Disconnected'))
    }
    this.pendingRpcs.clear()
  }
}
