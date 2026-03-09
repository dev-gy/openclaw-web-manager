import React from 'react'
import '../styles/global.css'
import { Sidebar } from '../layouts/Sidebar'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { usePageContext } from 'vike-react/usePageContext'
import { useConfigChangeNotification } from '../hooks/useConfigChangeNotification'

const noSidebarRoutes = ['/login']

export default function Layout({ children }: { children: React.ReactNode }) {
  const { urlPathname } = usePageContext()
  const hideSidebar = noSidebarRoutes.some((r) => urlPathname.startsWith(r))

  if (hideSidebar) {
    return <ErrorBoundary>{children}</ErrorBoundary>
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 overflow-auto lg:ml-0" role="main">
        <ConfigChangeBanner />
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  )
}

function ConfigChangeBanner() {
  const { hasExternalChange, changedKeys, dismiss, reload } = useConfigChangeNotification()

  if (!hasExternalChange) return null

  return (
    <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center justify-between animate-in fade-in">
      <div className="flex items-center gap-2">
        <span className="text-warning text-lg">⚠️</span>
        <div>
          <p className="text-sm font-medium text-text-primary">
            외부에서 설정이 변경되었습니다
          </p>
          {changedKeys.length > 0 && (
            <p className="text-xs text-text-secondary mt-0.5">
              변경된 항목: {changedKeys.join(', ')}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={reload}
          className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs rounded-lg transition-colors"
        >
          새로고침
        </button>
        <button
          onClick={dismiss}
          className="px-3 py-1.5 bg-bg-secondary hover:bg-border text-text-secondary text-xs rounded-lg transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  )
}
