import React from 'react'

type Status = 'connected' | 'disconnected' | 'warning' | 'unknown'

interface StatusCardProps {
  title: string
  status: Status
  detail: string
}

const statusColors: Record<Status, string> = {
  connected: 'bg-success',
  disconnected: 'bg-error',
  warning: 'bg-warning',
  unknown: 'bg-text-secondary',
}

const statusLabels: Record<Status, string> = {
  connected: '정상',
  disconnected: '끊김',
  warning: '주의',
  unknown: '알 수 없음',
}

export function StatusCard({ title, status, detail }: StatusCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-secondary">{title}</span>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          <span className="text-xs text-text-secondary">{statusLabels[status]}</span>
        </div>
      </div>
      <p className="text-sm text-text-primary">{detail}</p>
    </div>
  )
}
