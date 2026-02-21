import React from 'react'

export default function Page() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-text-bright mb-6">Active Sessions</h2>
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="py-16 text-center text-text-muted">
          <p className="text-4xl mb-4">🔗</p>
          <p>Active sessions will appear here after Gateway connection</p>
          <p className="text-xs mt-4">Implementation planned for Phase 4</p>
        </div>
      </div>
    </div>
  )
}
