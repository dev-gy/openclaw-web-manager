import React, { useState, useEffect } from 'react'
import { usePageContext } from 'vike-react/usePageContext'
import { SidebarNav, ThemeToggle } from '../components/ui'
import { useConnectionStatus } from '../hooks/useConnectionStatus'

const navGroups = [
  {
    items: [
      { href: '/', label: '🏠 대시보드' },
      { href: '/setup/1', label: '🧙 설치 마법사' },
    ],
  },
  {
    title: '⚙️ 설정',
    items: [
      { href: '/config', label: '설정 홈' },
      { href: '/config/quick', label: '빠른 설정' },
      { href: '/config/channels', label: '📡 채널 관리' },
      { href: '/config/agents', label: '🎮 캐릭터 시트' },
      { href: '/config/approvals', label: '🎒 스킬 인벤토리' },
      { href: '/config/prompts', label: '📜 스펠북' },
      { href: '/config/security', label: '🛡️ 보안 설정' },
      { href: '/config/editor', label: '📝 전체 편집기' },
      { href: '/config/snapshots', label: '💾 스냅샷' },
    ],
  },
  {
    title: '👁️ 모니터링',
    items: [
      { href: '/monitor', label: '모니터링 홈' },
      { href: '/monitor/agents', label: '🏢 에이전트 오피스' },
      { href: '/monitor/sessions', label: '📊 세션 관리' },
      { href: '/monitor/logs', label: '📜 실시간 로그' },
    ],
  },
  {
    title: '🖥️ 서버',
    items: [
      { href: '/server', label: '서버 정보' },
      { href: '/server/connection', label: '🔌 연결 설정' },
    ],
  },
]

export function Sidebar() {
  const { urlPathname } = usePageContext()
  const currentPath = urlPathname
  const { isConnected } = useConnectionStatus()
  const [mobileOpen, setMobileOpen] = useState(false)

  // 페이지 이동 시 모바일 메뉴 닫기
  useEffect(() => {
    setMobileOpen(false)
  }, [currentPath])

  // ESC 키로 모바일 메뉴 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    if (mobileOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [mobileOpen])

  return (
    <>
      {/* 모바일 햄버거 버튼 */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 p-2 bg-card border border-border rounded-lg shadow-sm"
        aria-label="메뉴 열기"
        aria-expanded={mobileOpen}
      >
        <svg className="w-5 h-5 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* 모바일 오버레이 */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-60 bg-card border-r border-border flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        role="navigation"
        aria-label="주 메뉴"
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary">OWM</h1>
            <p className="text-xs text-text-secondary mt-1">OpenClaw Web Manager</p>
          </div>
          {/* 모바일 닫기 버튼 */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-text-secondary hover:text-text-primary"
            aria-label="메뉴 닫기"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 p-3 overflow-y-auto">
          <SidebarNav groups={navGroups} currentPath={currentPath} />
        </div>

        <div className="p-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-error'}`}
                role="status"
                aria-label={isConnected ? 'Gateway 연결됨' : 'Gateway 미연결'}
              />
              <span className="text-xs text-text-secondary">
                {isConnected ? 'Gateway 연결됨' : '미연결'}
              </span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  )
}
