import React from 'react'

export default function Page() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-text-bright mb-6">Server</h2>

      <div className="space-y-4">
        {/* Server Info */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-text-bright mb-4">Server Info</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="Host" value="—" />
            <InfoRow label="OS" value="—" />
            <InfoRow label="Node.js" value="—" />
            <InfoRow label="OpenClaw" value="—" />
            <InfoRow label="Gateway Port" value="—" />
            <InfoRow label="Uptime" value="—" />
          </div>
        </div>

        {/* Update */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text-bright">Update</h3>
              <p className="text-sm text-text-muted mt-1">Check and install OpenClaw updates</p>
            </div>
            <a
              href="/server/update"
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm transition-colors"
            >
              Check for Updates
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-text-muted">{label}</span>
      <p className="text-text-bright font-mono">{value}</p>
    </div>
  )
}
