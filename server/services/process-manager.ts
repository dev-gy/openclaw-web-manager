import { EventEmitter } from 'node:events'

// --- 타입 정의 ---

export type ProcessStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error'

export interface ProcessInfo {
  pid: number | null
  status: ProcessStatus
  uptime: number | null       // 초 단위
  restartCount: number
  lastError?: string
  managerType: 'systemd' | 'direct'
}

export interface ProcessEvent {
  type: 'status-change' | 'log' | 'error' | 'restart'
  status?: ProcessStatus
  message?: string
  isStderr?: boolean
  pid?: number | null
  timestamp: number
}

/**
 * ProcessManager 추상 클래스
 *
 * 환경에 따라 두 가지 전략이 구현됨:
 * - SystemdProcessManager: systemd 사용 가능한 환경 (bare metal, VM)
 * - DirectProcessManager: systemd 없는 환경 (Docker, 컨테이너)
 *
 * 이벤트:
 * - 'event': ProcessEvent 객체 (모든 이벤트 단일 채널)
 *
 * 사용 패턴은 기존 Installer 클래스와 동일:
 *   manager.on('event', (e: ProcessEvent) => { ... })
 */
export abstract class ProcessManager extends EventEmitter {
  /** OpenClaw 프로세스 시작 */
  abstract start(configPath: string): Promise<void>

  /** OpenClaw 프로세스 중지 */
  abstract stop(): Promise<void>

  /** OpenClaw 프로세스 재시작 */
  abstract restart(): Promise<void>

  /** 현재 프로세스 상태 조회 */
  abstract getStatus(): Promise<ProcessInfo>

  /** 로그 조회 (최근 N줄) */
  abstract getLogs(lines?: number): Promise<string[]>

  /** 프로세스 실행 중 여부 */
  abstract isRunning(): Promise<boolean>

  /** 리소스 정리 (폴링 타이머, 자식 프로세스 참조 등) */
  abstract dispose(): void

  /**
   * 통합 이벤트 발행 (Installer.emitEvent 패턴)
   * 모든 이벤트는 'event' 채널로 전달됨
   */
  protected emitEvent(event: ProcessEvent): void {
    if (!event.timestamp) event.timestamp = Date.now()
    this.emit('event', event)
  }

  /** 상태 변경 이벤트 헬퍼 */
  protected emitStatusChange(status: ProcessStatus, message?: string): void {
    this.emitEvent({
      type: 'status-change',
      status,
      message,
      timestamp: Date.now(),
    })
  }

  /** 로그 이벤트 헬퍼 */
  protected emitLog(message: string, isStderr = false): void {
    this.emitEvent({
      type: 'log',
      message,
      isStderr,
      timestamp: Date.now(),
    })
  }
}
