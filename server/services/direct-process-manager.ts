import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ProcessManager, type ProcessInfo, type ProcessStatus } from './process-manager.js'

const MAX_LOG_LINES = 5000
const MAX_RESTARTS = 10
const RESTART_WINDOW_MS = 60_000
const MAX_BACKOFF_MS = 30_000
const PID_FILE = path.resolve('data', 'openclaw.pid')

/**
 * DirectProcessManager: child_process 기반 프로세스 관리
 *
 * systemd가 없는 환경(Docker, 컨테이너)에서 사용.
 * - spawn으로 OpenClaw 실행
 * - 자동 재시작 (60초 내 최대 10회, 지수 백오프)
 * - stdout/stderr → 링 버퍼(5000줄) + 이벤트 emit
 * - PID 파일로 OWM 재시작 시 상태 추적
 *
 * 참고: Homebridge(24k stars)와 동일한 패턴
 */
export class DirectProcessManager extends ProcessManager {
  private child: ChildProcess | null = null
  private configPath: string | null = null
  private status: ProcessStatus = 'stopped'
  private startedAt: number | null = null
  private restartCount = 0
  private restartTimestamps: number[] = []
  private lastError: string | undefined
  private autoRestart = true
  private restartTimer: ReturnType<typeof setTimeout> | null = null

  // 링 버퍼 (stdout + stderr)
  private logBuffer: string[] = []

  // --- Public API ---

  async start(configPath: string): Promise<void> {
    if (this.child) {
      throw new Error('프로세스가 이미 실행 중입니다')
    }

    this.configPath = configPath
    this.autoRestart = true
    this.restartCount = 0
    this.restartTimestamps = []
    this.lastError = undefined

    await this.spawnProcess()
  }

  async stop(): Promise<void> {
    this.autoRestart = false
    this.clearRestartTimer()

    if (!this.child) {
      this.setStatus('stopped')
      return
    }

    this.setStatus('stopping')
    this.emitLog('프로세스 중지 중...')

    const pid = this.child.pid

    // graceful shutdown: SIGTERM → 10초 대기 → SIGKILL
    return new Promise<void>((resolve) => {
      const forceKillTimer = setTimeout(() => {
        if (this.child) {
          this.emitLog('강제 종료 (SIGKILL)...', true)
          this.child.kill('SIGKILL')
        }
      }, 10_000)

      const cleanup = () => {
        clearTimeout(forceKillTimer)
        this.child = null
        this.setStatus('stopped')
        this.emitLog(`프로세스 중지됨 (PID: ${pid})`)
        this.removePidFile()
        resolve()
      }

      if (this.child) {
        this.child.once('exit', cleanup)
        this.child.kill('SIGTERM')
      } else {
        cleanup()
      }
    })
  }

  async restart(): Promise<void> {
    this.emitLog('프로세스 재시작 중...')
    await this.stop()
    if (this.configPath) {
      this.autoRestart = true
      await this.spawnProcess()
    }
  }

  async getStatus(): Promise<ProcessInfo> {
    return {
      pid: this.child?.pid ?? null,
      status: this.status,
      uptime: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : null,
      restartCount: this.restartCount,
      lastError: this.lastError,
      managerType: 'direct',
    }
  }

  async getLogs(lines = 100): Promise<string[]> {
    return this.logBuffer.slice(-lines)
  }

  async isRunning(): Promise<boolean> {
    return this.status === 'running' && this.child !== null
  }

  dispose(): void {
    this.autoRestart = false
    this.clearRestartTimer()

    if (this.child) {
      this.child.removeAllListeners()
      this.child.kill('SIGTERM')
      this.child = null
    }

    this.removePidFile()
    this.removeAllListeners()
  }

  // --- 내부 구현 ---

  private async spawnProcess(): Promise<void> {
    if (!this.configPath) {
      throw new Error('설정 파일 경로가 지정되지 않았습니다')
    }

    this.setStatus('starting')
    this.emitLog(`OpenClaw 시작: openclaw gateway --config ${this.configPath}`)

    try {
      this.child = spawn('openclaw', ['gateway', '--config', this.configPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env: { ...process.env },
      })
    } catch (err: any) {
      this.lastError = err.message
      this.setStatus('error')
      this.emitEvent({
        type: 'error',
        message: `프로세스 시작 실패: ${err.message}`,
        timestamp: Date.now(),
      })
      return
    }

    const pid = this.child.pid
    if (!pid) {
      this.lastError = '프로세스 PID를 가져올 수 없습니다'
      this.setStatus('error')
      return
    }

    this.writePidFile(pid)
    this.startedAt = Date.now()
    this.setStatus('running')
    this.emitLog(`프로세스 시작됨 (PID: ${pid})`)

    // stdout 처리
    this.child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        this.pushLog(line)
        this.emitLog(line)
      }
    })

    // stderr 처리
    this.child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        this.pushLog(`[stderr] ${line}`)
        this.emitLog(line, true)
      }
    })

    // 프로세스 종료 처리
    this.child.on('exit', (code, signal) => {
      const exitMsg = signal
        ? `프로세스 종료 (시그널: ${signal})`
        : `프로세스 종료 (코드: ${code})`

      this.pushLog(exitMsg)
      this.child = null
      this.startedAt = null

      if (this.autoRestart) {
        this.lastError = exitMsg
        this.setStatus('error')
        this.scheduleRestart()
      } else {
        this.setStatus('stopped')
        this.emitLog(exitMsg)
      }
    })

    this.child.on('error', (err) => {
      this.lastError = err.message
      this.pushLog(`[error] ${err.message}`)
      this.emitEvent({
        type: 'error',
        message: err.message,
        timestamp: Date.now(),
      })
    })
  }

  /**
   * 자동 재시작 스케줄링
   * - 60초 내 10회 초과 시 재시작 중단
   * - 지수 백오프: 1s → 2s → 4s → 8s → 16s → 30s (상한)
   */
  private scheduleRestart(): void {
    const now = Date.now()

    // 슬라이딩 윈도우: 60초 이내 재시작 횟수 확인
    this.restartTimestamps = this.restartTimestamps.filter(
      (ts) => now - ts < RESTART_WINDOW_MS,
    )

    if (this.restartTimestamps.length >= MAX_RESTARTS) {
      const msg = `재시작 한도 초과 (${MAX_RESTARTS}회/${RESTART_WINDOW_MS / 1000}초). 자동 재시작 중단.`
      this.emitLog(msg, true)
      this.emitEvent({ type: 'error', message: msg, timestamp: now })
      this.autoRestart = false
      this.setStatus('error')
      return
    }

    this.restartTimestamps.push(now)
    this.restartCount++

    // 지수 백오프 계산
    const backoff = Math.min(
      1000 * Math.pow(2, this.restartTimestamps.length - 1),
      MAX_BACKOFF_MS,
    )

    this.emitLog(`${backoff / 1000}초 후 재시작 (${this.restartCount}회째)...`)
    this.emitEvent({
      type: 'restart',
      message: `재시작 #${this.restartCount}`,
      timestamp: now,
    })

    this.restartTimer = setTimeout(async () => {
      this.restartTimer = null
      if (this.autoRestart && this.configPath) {
        try {
          await this.spawnProcess()
        } catch (err: any) {
          this.lastError = err.message
          this.setStatus('error')
        }
      }
    }, backoff)
  }

  // --- 유틸리티 ---

  private setStatus(status: ProcessStatus): void {
    if (this.status === status) return
    this.status = status
    this.emitStatusChange(status)
  }

  private pushLog(line: string): void {
    this.logBuffer.push(line)
    if (this.logBuffer.length > MAX_LOG_LINES) {
      // 버퍼 초과 시 앞 500줄 제거 (shift 반복 대신 slice 사용)
      this.logBuffer = this.logBuffer.slice(-MAX_LOG_LINES)
    }
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
  }

  private writePidFile(pid: number): void {
    try {
      const dir = path.dirname(PID_FILE)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(PID_FILE, String(pid), 'utf8')
    } catch {
      // PID 파일 쓰기 실패는 무시 (치명적이지 않음)
    }
  }

  private removePidFile(): void {
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE)
      }
    } catch {
      // 무시
    }
  }
}
