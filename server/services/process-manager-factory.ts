import { ProcessManager } from './process-manager.js'
import { DirectProcessManager } from './direct-process-manager.js'
import { SystemdProcessManager } from './systemd-process-manager.js'
import { detectEnvironment, type EnvironmentInfo } from './env-detect.js'

/**
 * ProcessManager 팩토리 (싱글톤)
 *
 * GatewayClient.getInstance() 패턴 재사용.
 * detectEnvironment()로 런타임 감지 후 적절한 전략 자동 선택:
 * - systemd 환경 → SystemdProcessManager
 * - docker/bare → DirectProcessManager
 */
let instance: ProcessManager | null = null
let envInfo: EnvironmentInfo | null = null

/**
 * ProcessManager 인스턴스를 가져옵니다.
 * 최초 호출 시 환경을 감지하고 적절한 매니저를 생성합니다.
 */
export async function getProcessManager(): Promise<ProcessManager> {
  if (instance) return instance

  const env = await detectEnvironment()
  envInfo = env

  console.log(`[ProcessManager] 환경 감지: runtime=${env.runtime}, platform=${env.platform}`)
  console.log(`[ProcessManager] OpenClaw: installed=${env.openclawInstalled}, version=${env.openclawVersion}`)

  switch (env.runtime) {
    case 'systemd':
      console.log('[ProcessManager] 전략: SystemdProcessManager')
      instance = new SystemdProcessManager()
      break

    case 'docker':
    case 'bare':
    default:
      console.log('[ProcessManager] 전략: DirectProcessManager')
      instance = new DirectProcessManager()
      break
  }

  return instance
}

/**
 * 캐시된 환경 정보 반환
 * getProcessManager() 호출 후에만 사용 가능
 */
export function getEnvironmentInfo(): EnvironmentInfo | null {
  return envInfo
}

/**
 * 싱글톤 인스턴스 초기화 (테스트용)
 */
export function resetProcessManager(): void {
  if (instance) {
    instance.dispose()
    instance = null
  }
  envInfo = null
}
