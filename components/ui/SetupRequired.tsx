import React from 'react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

interface SetupRequiredProps {
  pageName: string
  variant: 'setup' | 'disconnected' | 'error'
  description?: string
  errorMessage?: string
  onRetry?: () => void
}

const variantConfig = {
  setup: {
    iconBg: 'bg-bg-secondary',
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-secondary">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Gateway에 연결되지 않았습니다',
  },
  disconnected: {
    iconBg: 'bg-warning/10',
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-warning">
        <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Gateway 연결이 끊어졌습니다',
  },
  error: {
    iconBg: 'bg-error/10',
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-error">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    title: '연결 상태를 확인할 수 없습니다',
  },
} as const

export function SetupRequired({
  pageName,
  variant,
  description,
  errorMessage,
  onRetry,
}: SetupRequiredProps) {
  const config = variantConfig[variant]

  const bodyText = (() => {
    if (description) return description
    switch (variant) {
      case 'setup':
        return `${pageName}을(를) 사용하려면 먼저 Gateway를 연결해야 합니다.`
      case 'disconnected':
        return `${pageName}을(를) 사용하려면 Gateway에 다시 연결해야 합니다.`
      case 'error':
        return '서버와의 통신에 문제가 있습니다. 네트워크 연결을 확인하세요.'
    }
  })()

  return (
    <div className="max-w-lg mx-auto mt-12 text-center">
      {/* 아이콘 */}
      <div
        className={cn(
          'w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6',
          config.iconBg,
        )}
      >
        {config.icon}
      </div>

      {/* 제목 */}
      <h2 className="text-lg font-semibold text-text-primary mb-2">
        {config.title}
      </h2>

      {/* 본문 */}
      <p className="text-sm text-text-secondary mb-1">
        {bodyText}
      </p>

      {/* 에러 메시지 (error variant) */}
      {variant === 'error' && errorMessage && (
        <p className="text-xs text-error mt-1 mb-1">
          {errorMessage}
        </p>
      )}

      {/* 주 버튼 + 보조 링크 */}
      <div className="mt-6 space-y-3">
        {variant === 'setup' && (
          <>
            <div>
              <a href="/setup/1">
                <Button variant="primary" size="lg">
                  설치 마법사로 이동
                </Button>
              </a>
            </div>
            <p className="text-xs text-text-secondary">
              이미 Gateway가 실행 중이라면{' '}
              <a href="/server/connection" className="text-accent hover:underline">
                직접 연결 설정
              </a>
            </p>
          </>
        )}

        {variant === 'disconnected' && (
          <>
            <div>
              <a href="/server/connection">
                <Button variant="primary" size="lg">
                  재연결 시도
                </Button>
              </a>
            </div>
            <p className="text-xs text-text-secondary">
              <a href="/setup/1" className="text-accent hover:underline">
                새로운 Gateway로 연결
              </a>
            </p>
          </>
        )}

        {variant === 'error' && (
          <>
            <div>
              <Button variant="primary" size="lg" onClick={onRetry}>
                다시 시도
              </Button>
            </div>
            <p className="text-xs text-text-secondary">
              <a href="/setup/1" className="text-accent hover:underline">
                설치 마법사로 이동
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
