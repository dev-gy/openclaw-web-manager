import React from 'react'

export default function Page() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-text-bright mb-6">Monitor</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium text-text-muted mb-3">Gateway Status</h3>
          <div className="py-8 text-center text-text-muted text-sm">
            Gateway 연결 후 status RPC 데이터 표시
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium text-text-muted mb-3">Health Check</h3>
          <div className="py-8 text-center text-text-muted text-sm">
            Gateway 연결 후 health RPC 데이터 표시
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href="/monitor/logs"
          className="flex-1 bg-surface rounded-xl border border-border p-5 hover:border-primary/50 transition-colors"
        >
          <h3 className="font-semibold text-text-bright">📋 Live Logs</h3>
          <p className="text-sm text-text-muted mt-1">Real-time log streaming</p>
        </a>
        <a
          href="/monitor/sessions"
          className="flex-1 bg-surface rounded-xl border border-border p-5 hover:border-primary/50 transition-colors"
        >
          <h3 className="font-semibold text-text-bright">🔗 Sessions</h3>
          <p className="text-sm text-text-muted mt-1">Active session list</p>
        </a>
      </div>
    </div>
  )
}
