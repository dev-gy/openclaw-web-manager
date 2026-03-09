import os from 'node:os'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

export interface EnvironmentInfo {
  runtime: 'docker' | 'systemd' | 'bare'
  platform: string       // 'linux' | 'darwin' | 'win32'
  os: string             // e.g. 'Linux 5.15.0'
  distro: string         // e.g. 'Ubuntu 22.04'
  nodeVersion: string    // e.g. 'v22.0.0'
  ramTotal: string       // e.g. '4.0 GB'
  ramFree: string        // e.g. '2.1 GB'
  isRoot: boolean
  openclawInstalled: boolean
  openclawVersion: string | null
  openclawPath: string | null
}

let cached: EnvironmentInfo | null = null

/**
 * 실행 환경을 감지합니다.
 * - Docker 컨테이너 여부
 * - systemd 사용 가능 여부
 * - OpenClaw 설치 여부
 */
export async function detectEnvironment(): Promise<EnvironmentInfo> {
  if (cached) return cached

  const platform = os.platform()
  const runtime = detectRuntime(platform)
  const distro = platform === 'linux' ? getLinuxDistro() : `${os.type()} ${os.release()}`
  const { installed, version, path } = detectOpenClaw()

  cached = {
    runtime,
    platform,
    os: `${os.type()} ${os.release()}`,
    distro,
    nodeVersion: process.version,
    ramTotal: formatBytes(os.totalmem()),
    ramFree: formatBytes(os.freemem()),
    isRoot: process.getuid?.() === 0,
    openclawInstalled: installed,
    openclawVersion: version,
    openclawPath: path,
  }

  return cached
}

/** 캐시를 초기화합니다 (테스트용) */
export function resetCache(): void {
  cached = null
}

// --- 내부 함수 ---

function detectRuntime(platform: string): 'docker' | 'systemd' | 'bare' {
  // Windows/macOS는 항상 bare
  if (platform !== 'linux') return 'bare'

  // Docker/컨테이너 감지 (다중 시그널)
  if (isContainer()) return 'docker'

  // systemd 감지
  if (isSystemdAvailable()) return 'systemd'

  return 'bare'
}

function isContainer(): boolean {
  // 1. /.dockerenv 파일 (Docker 표준)
  try {
    if (fs.existsSync('/.dockerenv')) return true
  } catch { /* ignore */ }

  // 2. /proc/1/cgroup에 컨테이너 시그니처
  try {
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8')
    if (/docker|containerd|kubepods|libpod/.test(cgroup)) return true
  } catch { /* ignore */ }

  // 3. /proc/self/mountinfo에 Docker overlay
  try {
    const mountinfo = fs.readFileSync('/proc/self/mountinfo', 'utf8')
    if (mountinfo.includes('/docker/containers/')) return true
  } catch { /* ignore */ }

  // 4. 환경변수 (Podman, systemd-nspawn)
  if (process.env.container) return true

  return false
}

function isSystemdAvailable(): boolean {
  try {
    return fs.statSync('/run/systemd/system').isDirectory()
  } catch {
    return false
  }
}

function getLinuxDistro(): string {
  try {
    const content = fs.readFileSync('/etc/os-release', 'utf8')
    const match = content.match(/PRETTY_NAME="?([^"\n]+)"?/)
    return match?.[1] ?? 'Unknown Linux'
  } catch {
    return 'Unknown Linux'
  }
}

function detectOpenClaw(): { installed: boolean; version: string | null; path: string | null } {
  try {
    const path = execSync('which openclaw 2>/dev/null', { encoding: 'utf8' }).trim()
    if (!path) return { installed: false, version: null, path: null }

    try {
      const version = execSync('openclaw --version 2>/dev/null', { encoding: 'utf8' }).trim()
      return { installed: true, version, path }
    } catch {
      return { installed: true, version: null, path }
    }
  } catch {
    return { installed: false, version: null, path: null }
  }
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}
