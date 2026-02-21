import React from 'react'

type Status = 'connected' | 'disconnected' | 'warning' | 'unknown'

interface StatusCardProps {
  title: string
  status: Status
  detail: string
}

const statusColors: Record<Status, string> = {
  connected: 'bg-secondary',
  disconnected: 'bg-danger',
  warning: 'bg-warning',
  unknown: 'bg-text-muted',
}

const statusLabels: Record<Status, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  warning: 'Warning',
  unknown: 'Unknown',
}

export function StatusCard({ title, status, detail }: StatusCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-muted">{title}</span>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          <span className="text-xs text-text-muted">{statusLabels[status]}</span>
        </div>
      </div>
      <p className="text-sm text-text">{detail}</p>
    </div>
  )
}
