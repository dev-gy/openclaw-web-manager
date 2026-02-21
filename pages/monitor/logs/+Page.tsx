import React from 'react'

export default function Page() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-text-bright">Live Logs</h2>
        <div className="flex items-center gap-3">
          <select className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text">
            <option value="all">All Levels</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
          <button className="px-3 py-1.5 bg-surface-hover text-text-muted rounded-lg text-sm hover:text-text transition-colors">
            Auto-scroll: ON
          </button>
        </div>
      </div>

      {/* Log Terminal */}
      <div className="flex-1 bg-[#0d0d0d] rounded-xl border border-border p-4 font-mono text-xs overflow-auto min-h-[400px]">
        <div className="text-text-muted">
          <p>$ Waiting for Gateway connection...</p>
          <p className="mt-2 text-text-muted/50">
            logs.tail WebSocket stream will be connected in Phase 4
          </p>
        </div>
      </div>
    </div>
  )
}
