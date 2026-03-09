import { EventEmitter } from 'events'
import { getConnectionManager } from './connection-manager.js'

/**
 * ConfigWatcher: 외부 설정 변경 감지
 *
 * Gateway의 config.get RPC를 주기적으로 폴링하여
 * 해시값 변경을 감지합니다.
 *
 * OWM 외부에서 (CLI, 직접 파일 수정 등) 설정이 변경되면
 * 'config-changed' 이벤트를 emit하여 모든 연결된 클라이언트에 알림.
 */
export class ConfigWatcher extends EventEmitter {
  private static instance: ConfigWatcher | null = null

  private pollInterval: ReturnType<typeof setInterval> | null = null
  private lastHash: string | null = null
  private lastConfig: Record<string, any> | null = null
  private running = false

  static getInstance(): ConfigWatcher {
    if (!ConfigWatcher.instance) {
      ConfigWatcher.instance = new ConfigWatcher()
    }
    return ConfigWatcher.instance
  }

  /**
   * 감시 시작 (기본 10초 간격)
   */
  start(intervalMs = 10000) {
    if (this.running) return
    this.running = true

    this.pollInterval = setInterval(() => this._poll(), intervalMs)

    // 시작 시 즉시 한 번 체크
    this._poll()
  }

  /**
   * 감시 중지
   */
  stop() {
    this.running = false
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  /**
   * 마지막 감지된 해시
   */
  getLastHash(): string | null {
    return this.lastHash
  }

  private async _poll() {
    const cm = getConnectionManager()
    if (!cm.isConnected()) return

    try {
      const data = await cm.rpc('config.get')
      const hash = data?.hash || data?.baseHash || null

      if (!hash) return

      // 첫 번째 폴링 → 기준 해시 저장
      if (this.lastHash === null) {
        this.lastHash = hash
        this.lastConfig = data?.config || data || null
        return
      }

      // 해시 변경 감지
      if (hash !== this.lastHash) {
        const previousHash = this.lastHash
        this.lastHash = hash

        const newConfig = data?.config || data || null
        const previousConfig = this.lastConfig
        this.lastConfig = newConfig

        // 변경 이벤트 emit
        this.emit('config-changed', {
          type: 'config-changed',
          previousHash,
          currentHash: hash,
          timestamp: Date.now(),
          // 변경된 키 목록 (최상위만)
          changedKeys: previousConfig && newConfig
            ? detectChangedKeys(previousConfig, newConfig)
            : [],
        })
      }
    } catch {
      // 연결 끊김 등 — 무시
    }
  }
}

/**
 * 두 설정 객체의 최상위 키 중 변경된 것들 반환
 */
function detectChangedKeys(
  prev: Record<string, any>,
  next: Record<string, any>,
): string[] {
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)])
  const changed: string[] = []

  for (const key of allKeys) {
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
      changed.push(key)
    }
  }

  return changed
}

export function getConfigWatcher(): ConfigWatcher {
  return ConfigWatcher.getInstance()
}
