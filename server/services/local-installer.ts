import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { detectEnvironment, type EnvironmentInfo } from './env-detect.js'
import { getProcessManager } from './process-manager-factory.js'
import { getConnectionManager } from './connection-manager.js'
import { saveServer } from '../db/index.js'

// --- Types ---

export type LocalInstallStep =
  | 'idle'
  | 'detecting'
  | 'installing'
  | 'configuring'
  | 'starting'
  | 'health_checking'
  | 'complete'
  | 'failed'

const STEP_ORDER: LocalInstallStep[] = [
  'detecting',
  'installing',
  'configuring',
  'starting',
  'health_checking',
  'complete',
]

export interface LocalInstallConfig {
  serverName: string
  gatewayPort: number
  gatewayToken: string
  apiKey?: string
}

export interface LocalInstallEvent {
  type: 'log' | 'step' | 'env_info' | 'complete' | 'error'
  step?: LocalInstallStep
  message?: string
  isStderr?: boolean
  data?: any
  timestamp: number
}

// --- LocalInstaller ---

/**
 * LocalInstaller: 로컬 OpenClaw 설치 파이프라인
 *
 * 기존 SSH 기반 Installer를 대체.
 * 모든 작업이 같은 서버에서 실행됨.
 *
 * 5단계:
 * 1. detecting  — 환경 감지 (OS, runtime, OpenClaw 설치 여부)
 * 2. installing — npm i -g openclaw (필요시)
 * 3. configuring — config.json 작성 (data/ 디렉토리)
 * 4. starting — ProcessManager.start() (systemd/direct 자동 선택)
 * 5. health_checking — Gateway WS 연결 확인
 *
 * 이벤트 패턴은 기존 Installer와 동일:
 *   installer.on('event', (e: LocalInstallEvent) => { ... })
 */
export class LocalInstaller extends EventEmitter {
  private step: LocalInstallStep = 'idle'
  private config: LocalInstallConfig | null = null
  private aborted = false
  private envInfo: EnvironmentInfo | null = null
  private serverId: string | null = null
  private configFilePath: string | null = null

  // Singleton — 한 번에 하나의 설치만 허용
  private static instance: LocalInstaller | null = null

  static getInstance(): LocalInstaller {
    if (!LocalInstaller.instance) {
      LocalInstaller.instance = new LocalInstaller()
    }
    return LocalInstaller.instance
  }

  getStatus() {
    return {
      step: this.step,
      envInfo: this.envInfo,
      serverId: this.serverId,
      aborted: this.aborted,
    }
  }

  isRunning(): boolean {
    return this.step !== 'idle' && this.step !== 'complete' && this.step !== 'failed'
  }

  getStepOrder(): LocalInstallStep[] {
    return [...STEP_ORDER]
  }

  // --- 설치 파이프라인 시작 ---

  async start(config: LocalInstallConfig): Promise<void> {
    if (this.isRunning()) {
      throw new Error('설치가 이미 진행 중입니다')
    }

    this.reset()
    this.config = config

    try {
      await this.stepDetect()
      if (this.aborted) return

      await this.stepInstall()
      if (this.aborted) return

      await this.stepConfigure()
      if (this.aborted) return

      await this.stepStart()
      if (this.aborted) return

      await this.stepHealthCheck()
      if (this.aborted) return

      await this.stepComplete()
    } catch (err: any) {
      console.error('[LocalInstaller] 파이프라인 실패:', err.message || err)
      this.fail(err.message || '알 수 없는 오류')
    }
  }

  // --- 중단 ---

  abort(): void {
    if (!this.isRunning()) return
    this.aborted = true
    this.setStep('failed')
    this.emitEvent({ type: 'error', message: '사용자가 설치를 중단했습니다', timestamp: Date.now() })
  }

  // --- 개별 단계 ---

  /** Step 1: 환경 감지 */
  private async stepDetect(): Promise<void> {
    this.setStep('detecting')
    this.log('환경 감지 중...')

    this.envInfo = await detectEnvironment()

    this.log(`OS: ${this.envInfo.os}`)
    this.log(`배포판: ${this.envInfo.distro}`)
    this.log(`런타임: ${this.envInfo.runtime}`)
    this.log(`Node.js: ${this.envInfo.nodeVersion}`)
    this.log(`RAM: ${this.envInfo.ramTotal} (여유: ${this.envInfo.ramFree})`)
    this.log(`Root 권한: ${this.envInfo.isRoot ? '있음' : '없음'}`)

    if (this.envInfo.openclawInstalled) {
      this.log(`OpenClaw: ${this.envInfo.openclawVersion} (${this.envInfo.openclawPath})`)
    } else {
      this.log('OpenClaw: 미설치')
    }

    this.emitEvent({ type: 'env_info', data: this.envInfo, timestamp: Date.now() })
  }

  /** Step 2: OpenClaw 설치 */
  private async stepInstall(): Promise<void> {
    this.setStep('installing')

    // 이미 설치되어 있으면 스킵
    if (this.envInfo?.openclawInstalled) {
      this.log(`OpenClaw ${this.envInfo.openclawVersion} 이미 설치됨, 스킵합니다.`)
      return
    }

    this.log('OpenClaw 설치 중...')

    // npm i -g openclaw (로컬 실행)
    await this.execLocal('npm', ['install', '-g', 'openclaw'], 'npm install -g openclaw 실행 중...')

    // 설치 확인
    const newEnv = await detectEnvironment()
    if (!newEnv.openclawInstalled) {
      throw new Error('OpenClaw 설치 확인 실패. npm install 결과를 확인하세요.')
    }

    this.envInfo = newEnv
    this.log(`OpenClaw 설치 완료: ${newEnv.openclawVersion}`)
  }

  /** Step 3: 설정 파일 작성 */
  private async stepConfigure(): Promise<void> {
    this.setStep('configuring')
    this.log('OpenClaw 설정 파일 작성 중...')

    const c = this.config!
    const configObj = {
      gateway: {
        port: c.gatewayPort,
        token: c.gatewayToken,
      },
      ...(c.apiKey && { api: { key: c.apiKey } }),
    }

    const configJson = JSON.stringify(configObj, null, 2)

    // data/ 디렉토리에 설정 파일 저장 (기존 owm.db와 같은 위치)
    const dataDir = path.resolve('data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    this.configFilePath = path.join(dataDir, 'openclaw-config.json')
    await fs.promises.writeFile(this.configFilePath, configJson, 'utf8')

    this.log(`설정 파일 저장됨: ${this.configFilePath}`)
  }

  /** Step 4: 프로세스 시작 */
  private async stepStart(): Promise<void> {
    this.setStep('starting')
    this.log('OpenClaw 시작 중...')

    if (!this.configFilePath) {
      throw new Error('설정 파일 경로가 없습니다')
    }

    const pm = await getProcessManager()
    const managerType = this.envInfo?.runtime === 'systemd' ? 'systemd' : 'direct'
    this.log(`프로세스 관리자: ${managerType}`)

    await pm.start(this.configFilePath)

    // 시작 후 잠시 대기 (프로세스 안정화)
    await this.sleep(2000)

    const running = await pm.isRunning()
    if (!running) {
      const status = await pm.getStatus()
      throw new Error(`OpenClaw 시작 실패: ${status.lastError || '프로세스가 즉시 종료됨'}`)
    }

    this.log('OpenClaw 프로세스 시작됨')
  }

  /** Step 5: Gateway 헬스 체크 */
  private async stepHealthCheck(): Promise<void> {
    this.setStep('health_checking')
    this.log('Gateway 연결 확인 중...')

    const c = this.config!

    // Gateway WS 핸드셰이크 (최대 3회, 5초 간격)
    let lastError = ''
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (this.aborted) return

      this.log(`헬스 체크 시도 ${attempt}/3...`)
      try {
        const cm = getConnectionManager()
        await cm.connect({
          type: 'websocket',
          url: `ws://localhost:${c.gatewayPort}`,
          token: c.gatewayToken,
        })

        const result = await cm.rpc('system.info')
        this.log(`Gateway 연결 성공! 버전: ${result?.version || 'unknown'}`)

        // 서버 정보 DB 저장
        this.serverId = await saveServer({
          name: c.serverName,
          host: 'localhost',
          deployType: 'local',
          gatewayPort: c.gatewayPort,
          gatewayToken: c.gatewayToken,
          openclawVersion: result?.version || this.envInfo?.openclawVersion || undefined,
        })

        return // 성공
      } catch (err: any) {
        lastError = err.message
        this.log(`시도 ${attempt} 실패: ${lastError}`)
        if (attempt < 3) {
          this.log('5초 후 재시도...')
          await this.sleep(5000)
        }
      }
    }

    // 3회 실패해도 서버 정보는 저장 (status=disconnected로 나중에 재확인)
    this.serverId = await saveServer({
      name: c.serverName,
      host: 'localhost',
      deployType: 'local' as any,
      gatewayPort: c.gatewayPort,
      gatewayToken: c.gatewayToken,
      openclawVersion: this.envInfo?.openclawVersion || undefined,
    })

    this.log(`Gateway 헬스 체크 3회 실패: ${lastError}`)
    this.log('서버가 등록되었지만 Gateway 연결은 나중에 확인이 필요합니다.')
  }

  /** 완료 */
  private async stepComplete(): Promise<void> {
    this.setStep('complete')
    this.log('설치 완료!')
    this.emitEvent({
      type: 'complete',
      data: {
        serverId: this.serverId,
        envInfo: this.envInfo,
        configPath: this.configFilePath,
      },
      timestamp: Date.now(),
    })
  }

  // --- 헬퍼 ---

  /**
   * 로컬 명령 실행 (스트리밍 출력)
   * 기존 installer.ts의 execWithStream을 로컬 버전으로 대체
   */
  private async execLocal(command: string, args: string[], label: string): Promise<void> {
    this.log(label)

    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
        shell: process.platform === 'win32', // Windows에서 npm 실행을 위해
      })

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          this.emitEvent({
            type: 'log',
            step: this.step,
            message: line,
            isStderr: false,
            timestamp: Date.now(),
          })
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          this.emitEvent({
            type: 'log',
            step: this.step,
            message: line,
            isStderr: true,
            timestamp: Date.now(),
          })
        }
      })

      child.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`명령 실패 (exit ${code}): ${command} ${args.join(' ')}`))
        } else {
          resolve()
        }
      })

      child.on('error', (err) => {
        reject(new Error(`명령 실행 실패: ${err.message}`))
      })
    })
  }

  private log(message: string, isStderr = false): void {
    this.emitEvent({
      type: 'log',
      step: this.step,
      message,
      isStderr,
      timestamp: Date.now(),
    })
  }

  private setStep(step: LocalInstallStep): void {
    this.step = step
    this.emitEvent({
      type: 'step',
      step,
      timestamp: Date.now(),
    })
  }

  private fail(message: string): void {
    this.step = 'failed'
    this.emitEvent({ type: 'error', step: 'failed', message, timestamp: Date.now() })
  }

  private emitEvent(event: LocalInstallEvent): void {
    if (!event.timestamp) event.timestamp = Date.now()
    this.emit('event', event)
  }

  private reset(): void {
    this.step = 'idle'
    this.config = null
    this.aborted = false
    this.envInfo = null
    this.serverId = null
    this.configFilePath = null
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}
