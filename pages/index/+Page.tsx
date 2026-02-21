import React from 'react'
import { StatusCard } from '../../components/ui/StatusCard'

export default function Page() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-text-bright mb-6">Dashboard</h2>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatusCard
          title="Gateway"
          status="disconnected"
          detail="Not connected"
        />
        <StatusCard
          title="OpenClaw"
          status="unknown"
          detail="—"
        />
        <StatusCard
          title="System"
          status="unknown"
          detail="—"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-text-bright mb-4">Quick Actions</h3>
        <div className="flex gap-3">
          <a
            href="/setup/1"
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm transition-colors"
          >
            Install OpenClaw
          </a>
          <a
            href="/config"
            className="px-4 py-2 bg-surface-hover hover:bg-border text-text rounded-lg text-sm transition-colors"
          >
            Edit Config
          </a>
          <a
            href="/monitor/logs"
            className="px-4 py-2 bg-surface-hover hover:bg-border text-text rounded-lg text-sm transition-colors"
          >
            View Logs
          </a>
        </div>
      </div>
    </div>
  )
}
