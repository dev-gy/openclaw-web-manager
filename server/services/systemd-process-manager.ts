import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { ProcessManager, type ProcessInfo, type ProcessStatus } from './process-manager.js'

const execFileAsync = promisify(execFile)

const SERVICE_NAME = 'openclaw'
const UNIT_FILE_PATH = `/etc/systemd/system/${SERVICE_NAME}.service`
const POLL_INTERVAL_MS = 5_000

/**
 * SystemdProcessManager: systemd 기반 프로세스 관리
 *
 * systemd가 사용 가능한 환경(bare metal, VM)에서 사용.
 * - systemctl로 start/stop/restart
 * - journalctl로 로그 조회
 * - 5초 간격 상태 폴링 → status-change 이벤트
 * - 설치 시 systemd unit 파일 자동 생성
 */
export class SystemdProcessManager extends ProcessManager {
  private lastKnownStatus: ProcessStatus = 'stopped'
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private configPath: string | null = null
  private restartCount = 0

  // --- Public API ---

  async start(configPath: string): Promise<void> {
    this.configPath = configPath

    // unit 파일이 없으면 생성
    await this.ensureUnitFile(configPath)

    this.emitLog('systemd 서비스 시작 중...')
    this.emitStatusChange('starting')

    try {
      await this.systemctl('daemon-reload')
      await this.systemctl('enable', SERVICE_NAME)
      await this.systemctl('start', SERVICE_NAME)
    } catch (err: any) {
      this.emitEvent({
        type: 'error',
        message: `서비스 시작 실패: ${err.message}`,
        timestamp: Date.now(),
      })
      this.lastKnownStatus = 'error'
      this.emitStatusChange('error', err.message)
      throw err
    }

    // 상태 확인
    const running = await this.checkActive()
    if (running) {
      this.lastKnownStatus = 'running'
      this.emitStatusChange('running')
      this.emitLog('OpenClaw 서비스 시작됨')
    } else {
      // 시작 직후 실패 — journalctl 로그 확인
      const logs = await this.getLogs(20)
      this.emitLog('서비스 시작 실패. 최근 로그:', true)
      for (const line of logs) {
        this.emitLog(line, true)
      }
      this.lastKnownStatus = 'error'
      this.emitStatusChange('error', '서비스 시작 실패')
      throw new Error('OpenClaw 서비스 시작 실패')
    }

    this.startPolling()
  }

  async stop(): Promise<void> {
    this.stopPolling()
    this.emitLog('systemd 서비스 중지 중...')
    this.emitStatusChange('stopping')

    try {
      await this.systemctl('stop', SERVICE_NAME)
      this.lastKnownStatus = 'stopped'
      this.emitStatusChange('stopped')
      this.emitLog('OpenClaw 서비스 중지됨')
    } catch (err: any) {
      this.emitEvent({
        type: 'error',
        message: `서비스 중지 실패: ${err.message}`,
        timestamp: Date.now(),
      })
      throw err
    }
  }

  async restart(): Promise<void> {
    this.emitLog('systemd 서비스 재시작 중...')
    this.emitStatusChange('starting')
    this.restartCount++

    try {
      await this.systemctl('restart', SERVICE_NAME)

      const running = await this.checkActive()
      if (running) {
        this.lastKnownStatus = 'running'
        this.emitStatusChange('running')
        this.emitLog('OpenClaw 서비스 재시작됨')
        this.emitEvent({
          type: 'restart',
          message: `재시작 #${this.restartCount}`,
          timestamp: Date.now(),
        })
      } else {
        this.lastKnownStatus = 'error'
        this.emitStatusChange('error', '재시작 후 서비스 비활성')
        throw new Error('재시작 후 서비스가 활성화되지 않음')
      }
    } catch (err: any) {
      this.emitEvent({
        type: 'error',
        message: `서비스 재시작 실패: ${err.message}`,
        timestamp: Date.now(),
      })
      throw err
    }

    if (!this.pollTimer) this.startPolling()
  }

  async getStatus(): Promise<ProcessInfo> {
    const running = await this.checkActive()
    const pid = running ? await this.getMainPid() : null
    const uptime = running ? await this.getUptime() : null

    return {
      pid,
      status: this.lastKnownStatus,
      uptime,
      restartCount: this.restartCount,
      managerType: 'systemd',
    }
  }

  async getLogs(lines = 100): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync('journalctl', [
        '-u', SERVICE_NAME,
        '-n', String(lines),
        '--no-pager',
        '-o', 'short-iso',
      ])
      return stdout.trim().split('\n').filter(Boolean)
    } catch {
      return []
    }
  }

  async isRunning(): Promise<boolean> {
    return this.checkActive()
  }

  dispose(): void {
    this.stopPolling()
    this.removeAllListeners()
  }

  // --- 내부: systemctl 래퍼 ---

  private async systemctl(...args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync('sudo', ['systemctl', ...args])
      return stdout.trim()
    } catch (err: any) {
      // systemctl은 비정상 종료 시에도 유용한 출력을 함
      if (err.stdout) return err.stdout.trim()
      throw err
    }
  }

  private async checkActive(): Promise<boolean> {
    try {
      const result = await this.systemctl('is-active', SERVICE_NAME)
      return result === 'active'
    } catch {
      return false
    }
  }

  private async getMainPid(): Promise<number | null> {
    try {
      const result = await this.systemctl('show', SERVICE_NAME, '-p', 'MainPID', '--value')
      const pid = parseInt(result, 10)
      return pid > 0 ? pid : null
    } catch {
      return null
    }
  }

  private async getUptime(): Promise<number | null> {
    try {
      const result = await this.systemctl(
        'show', SERVICE_NAME,
        '-p', 'ActiveEnterTimestamp',
        '--value',
      )
      if (!result) return null
      const startTime = new Date(result).getTime()
      if (isNaN(startTime)) return null
      return Math.floor((Date.now() - startTime) / 1000)
    } catch {
      return null
    }
  }

  // --- 내부: 상태 폴링 ---

  private startPolling(): void {
    this.stopPolling()
    this.pollTimer = setInterval(async () => {
      try {
        const running = await this.checkActive()
        const newStatus: ProcessStatus = running ? 'running' : 'stopped'

        if (newStatus !== this.lastKnownStatus) {
          this.lastKnownStatus = newStatus
          this.emitStatusChange(newStatus)
          this.emitLog(
            newStatus === 'running'
              ? 'OpenClaw 서비스 활성화 감지'
              : 'OpenClaw 서비스 비활성화 감지',
          )
        }
      } catch {
        // 폴링 에러는 무시 (다음 폴링에서 재시도)
      }
    }, POLL_INTERVAL_MS)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  // --- 내부: Unit 파일 관리 ---

  /**
   * systemd unit 파일 생성
   * 기존 installer.ts의 daemon 등록 로직 재사용
   */
  private async ensureUnitFile(configPath: string): Promise<void> {
    // 절대 경로로 변환
    const absConfigPath = path.resolve(configPath)

    // openclaw 바이너리 경로 찾기
    let openclawPath: string
    try {
      const { stdout } = await execFileAsync('which', ['openclaw'])
      openclawPath = stdout.trim()
    } catch {
      openclawPath = '/usr/local/bin/openclaw'
    }

    const unitContent = `[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
ExecStart=${openclawPath} gateway --config ${absConfigPath}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
`

    try {
      // 기존 파일이 있으면 덮어쓰기
      await fs.promises.writeFile(UNIT_FILE_PATH, unitContent, 'utf8')
      this.emitLog(`systemd unit 파일 생성: ${UNIT_FILE_PATH}`)
    } catch (err: any) {
      // 권한 문제 시 sudo tee 사용
      if (err.code === 'EACCES') {
        const { exec } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const execAsync = promisify(exec)
        await execAsync(`echo '${unitContent.replace(/'/g, "'\\''")}' | sudo tee ${UNIT_FILE_PATH}`)
        this.emitLog(`systemd unit 파일 생성 (sudo): ${UNIT_FILE_PATH}`)
      } else {
        throw err
      }
    }
  }
}
