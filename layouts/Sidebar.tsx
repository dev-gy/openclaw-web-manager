import React from 'react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/setup/1', label: 'Install', icon: '📦' },
  { href: '/config', label: 'Config', icon: '⚙️' },
  { href: '/monitor', label: 'Monitor', icon: '📡' },
  { href: '/server', label: 'Server', icon: '🖥️' },
]

export function Sidebar() {
  return (
    <aside className="w-60 bg-surface border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-text-bright">
          🐾 OWM
        </h1>
        <p className="text-xs text-text-muted mt-1">
          OpenClaw Web Manager
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted hover:bg-surface-hover hover:text-text-bright transition-colors"
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary" />
          <span className="text-xs text-text-muted">Gateway: connecting...</span>
        </div>
      </div>
    </aside>
  )
}
