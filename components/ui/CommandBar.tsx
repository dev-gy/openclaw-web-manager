import React, { useState, useEffect, useCallback } from 'react'

/**
 * CommandBar — 게임 HUD 스타일 커맨드 퀵슬롯 바
 *
 * Star-Office-UI 컨셉:
 * - 게임 핫키 바처럼 번호 키(1~0)에 커맨드 할당
 * - 아이콘 + 이름 + 쿨다운 표시
 * - 실행 시 시각적 피드백 (진행 중, 성공, 실패)
 * - 키보드 단축키 지원 (Ctrl+1~0)
 */

export type CommandSlotStatus = 'idle' | 'executing' | 'success' | 'error' | 'cooldown'

export interface CommandSlot {
  id: string
  icon: string
  name: string
  description: string
  /** 'api' = fetch call, 'navigate' = page navigation, 'action' = custom callback */
  type: 'api' | 'navigate' | 'action'
  /** For 'api': endpoint URL, For 'navigate': href */
  target: string
  /** HTTP method for API calls */
  method?: 'GET' | 'POST' | 'DELETE'
  /** POST body for API calls */
  body?: Record<string, unknown>
  /** Cooldown in ms after execution */
  cooldown?: number
  /** Whether the command requires Gateway connection */
  requiresConnection?: boolean
}

interface CommandBarProps {
  commands: CommandSlot[]
  connected?: boolean
  onAction?: (commandId: string) => Promise<void> | void
  className?: string
}

interface SlotState {
  status: CommandSlotStatus
  cooldownEnd?: number
  message?: string
}

export function CommandBar({ commands, connected = true, onAction, className = '' }: CommandBarProps) {
  const [states, setStates] = useState<Record<string, SlotState>>({})

  // 쿨다운 타이머
  useEffect(() => {
    const interval = setInterval(() => {
      setStates((prev) => {
        const now = Date.now()
        let changed = false
        const next = { ...prev }
        for (const [id, state] of Object.entries(next)) {
          if (state.status === 'cooldown' && state.cooldownEnd && now >= state.cooldownEnd) {
            next[id] = { status: 'idle' }
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 200)
    return () => clearInterval(interval)
  }, [])

  // 성공/에러 상태 자동 초기화
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = []
    for (const [id, state] of Object.entries(states)) {
      if (state.status === 'success' || state.status === 'error') {
        const t = setTimeout(() => {
          setStates((prev) => {
            const cmd = commands.find((c) => c.id === id)
            if (cmd?.cooldown) {
              return { ...prev, [id]: { status: 'cooldown', cooldownEnd: Date.now() + cmd.cooldown } }
            }
            return { ...prev, [id]: { status: 'idle' } }
          })
        }, 1500)
        timeouts.push(t)
      }
    }
    return () => timeouts.forEach(clearTimeout)
  }, [states, commands])

  const executeCommand = useCallback(
    async (cmd: CommandSlot) => {
      const state = states[cmd.id]
      if (state?.status === 'executing' || state?.status === 'cooldown') return
      if (cmd.requiresConnection && !connected) {
        setStates((prev) => ({
          ...prev,
          [cmd.id]: { status: 'error', message: 'Gateway 미연결' },
        }))
        return
      }

      if (cmd.type === 'navigate') {
        window.location.href = cmd.target
        return
      }

      setStates((prev) => ({ ...prev, [cmd.id]: { status: 'executing' } }))

      try {
        if (cmd.type === 'action' && onAction) {
          await onAction(cmd.id)
        } else if (cmd.type === 'api') {
          const res = await fetch(cmd.target, {
            method: cmd.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: cmd.body ? JSON.stringify(cmd.body) : undefined,
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || `${res.status} 에러`)
          }
        }
        setStates((prev) => ({ ...prev, [cmd.id]: { status: 'success' } }))
      } catch (err: any) {
        setStates((prev) => ({
          ...prev,
          [cmd.id]: { status: 'error', message: err.message || '실행 실패' },
        }))
      }
    },
    [states, connected, onAction]
  )

  // 키보드 단축키 (Ctrl+1~0)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      const keyMap: Record<string, number> = {
        '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
        '6': 5, '7': 6, '8': 7, '9': 8, '0': 9,
      }
      const idx = keyMap[e.key]
      if (idx !== undefined && idx < commands.length) {
        e.preventDefault()
        executeCommand(commands[idx])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commands, executeCommand])

  return (
    <div className={`command-bar ${className}`}>
      <div className="flex items-center gap-1">
        {/* 바 라벨 */}
        <div className="hidden sm:flex items-center gap-1 mr-2 px-2 py-1">
          <span className="text-[10px] text-text-secondary font-mono uppercase tracking-widest">CMD</span>
        </div>

        {/* 슬롯 그리드 */}
        <div className="flex gap-1 flex-wrap">
          {commands.map((cmd, idx) => {
            const state = states[cmd.id] || { status: 'idle' }
            const disabled =
              state.status === 'executing' ||
              state.status === 'cooldown' ||
              (cmd.requiresConnection && !connected)
            const slotKey = idx < 9 ? `${idx + 1}` : idx === 9 ? '0' : ''

            return (
              <button
                key={cmd.id}
                onClick={() => executeCommand(cmd)}
                disabled={disabled}
                title={`${cmd.description}${slotKey ? ` (Ctrl+${slotKey})` : ''}`}
                className={`
                  command-slot group relative
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                  text-xs font-medium transition-all duration-150
                  border
                  ${getSlotStyle(state.status, !!disabled)}
                `}
              >
                {/* 슬롯 번호 */}
                {slotKey && (
                  <span className="absolute -top-1.5 -left-1 w-4 h-4 bg-bg-secondary border border-border rounded text-[9px] font-mono text-text-secondary flex items-center justify-center">
                    {slotKey}
                  </span>
                )}

                {/* 아이콘 */}
                <span className={`text-sm ${state.status === 'executing' ? 'animate-spin' : ''}`}>
                  {getStatusIcon(state.status, cmd.icon)}
                </span>

                {/* 이름 */}
                <span className="hidden sm:inline whitespace-nowrap">
                  {cmd.name}
                </span>

                {/* 쿨다운 오버레이 */}
                {state.status === 'cooldown' && state.cooldownEnd && (
                  <CooldownOverlay endTime={state.cooldownEnd} />
                )}

                {/* 실행 중 펄스 */}
                {state.status === 'executing' && (
                  <span className="absolute inset-0 rounded-lg bg-accent/20 animate-pulse" />
                )}

                {/* 툴팁 (에러 메시지) */}
                {state.status === 'error' && state.message && (
                  <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-error text-white text-[10px] rounded whitespace-nowrap z-10">
                    {state.message}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── 헬퍼 ───

function getSlotStyle(status: CommandSlotStatus, disabled: boolean): string {
  if (disabled && status !== 'executing') {
    return 'bg-bg-secondary border-border text-text-secondary opacity-50 cursor-not-allowed'
  }
  switch (status) {
    case 'executing':
      return 'bg-accent/10 border-accent/40 text-accent cursor-wait'
    case 'success':
      return 'bg-success/10 border-success/40 text-success'
    case 'error':
      return 'bg-error/10 border-error/40 text-error'
    case 'cooldown':
      return 'bg-bg-secondary border-border text-text-secondary cursor-not-allowed'
    default:
      return 'bg-bg-secondary border-border text-text-primary hover:bg-border hover:border-accent/30 cursor-pointer'
  }
}

function getStatusIcon(status: CommandSlotStatus, defaultIcon: string): string {
  switch (status) {
    case 'executing':
      return '\u23F3' // hourglass
    case 'success':
      return '\u2705' // check
    case 'error':
      return '\u274C' // cross
    default:
      return defaultIcon
  }
}

function CooldownOverlay({ endTime }: { endTime: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, endTime - Date.now()))

  useEffect(() => {
    const interval = setInterval(() => {
      const r = Math.max(0, endTime - Date.now())
      setRemaining(r)
      if (r <= 0) clearInterval(interval)
    }, 100)
    return () => clearInterval(interval)
  }, [endTime])

  const seconds = Math.ceil(remaining / 1000)
  if (seconds <= 0) return null

  return (
    <span className="absolute inset-0 rounded-lg bg-bg-primary/60 flex items-center justify-center">
      <span className="text-[10px] font-mono text-text-secondary">{seconds}s</span>
    </span>
  )
}

// ─── 기본 커맨드 프리셋 ───

export const DEFAULT_COMMANDS: CommandSlot[] = [
  {
    id: 'refresh',
    icon: '\uD83D\uDD04',
    name: '\uC0C8\uB85C\uACE0\uCE68',
    description: '\uB300\uC2DC\uBCF4\uB4DC \uB370\uC774\uD130 \uC0C8\uB85C\uACE0\uCE68',
    type: 'action',
    target: '',
  },
  {
    id: 'reconnect',
    icon: '\uD83D\uDD0C',
    name: '\uC7AC\uC5F0\uACB0',
    description: 'Gateway \uC7AC\uC5F0\uACB0',
    type: 'api',
    target: '/api/connection/reconnect',
    method: 'POST',
    cooldown: 5000,
    requiresConnection: false,
  },
  {
    id: 'restart',
    icon: '\u26A1',
    name: '\uC7AC\uC2DC\uC791',
    description: 'Gateway \uD504\uB85C\uC138\uC2A4 \uC7AC\uC2DC\uC791',
    type: 'api',
    target: '/api/server/restart',
    method: 'POST',
    cooldown: 10000,
    requiresConnection: true,
  },
  {
    id: 'snapshot',
    icon: '\uD83D\uDCBE',
    name: '\uC2A4\uB0C5\uC0F7',
    description: '\uD604\uC7AC \uC124\uC815 \uC2A4\uB0C5\uC0F7 \uC800\uC7A5',
    type: 'api',
    target: '/api/config/snapshots',
    method: 'POST',
    body: { label: '\uD035 \uC2AC\uB86F \uC800\uC7A5' },
    cooldown: 3000,
    requiresConnection: true,
  },
  {
    id: 'detect',
    icon: '\uD83D\uDD0D',
    name: '\uAC10\uC9C0',
    description: 'Gateway \uC790\uB3D9 \uAC10\uC9C0',
    type: 'api',
    target: '/api/connection/detect',
    method: 'POST',
    cooldown: 5000,
    requiresConnection: false,
  },
  {
    id: 'go-office',
    icon: '\uD83C\uDFE2',
    name: '\uC624\uD53C\uC2A4',
    description: '\uC5D0\uC774\uC804\uD2B8 \uC624\uD53C\uC2A4\uB85C \uC774\uB3D9',
    type: 'navigate',
    target: '/monitor/agents',
  },
  {
    id: 'go-inventory',
    icon: '\uD83C\uDF92',
    name: '\uC778\uBCA4\uD1A0\uB9AC',
    description: '\uC2A4\uD0AC \uC778\uBCA4\uD1A0\uB9AC\uB85C \uC774\uB3D9',
    type: 'navigate',
    target: '/config/approvals',
  },
  {
    id: 'go-spellbook',
    icon: '\uD83D\uDCDC',
    name: '\uC2A4\uD3A0\uBD81',
    description: '\uC2DC\uC2A4\uD15C \uD504\uB86C\uD504\uD2B8 \uB77C\uC774\uBE0C\uB7EC\uB9AC\uB85C \uC774\uB3D9',
    type: 'navigate',
    target: '/config/prompts',
  },
]
