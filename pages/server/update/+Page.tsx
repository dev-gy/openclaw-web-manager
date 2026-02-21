import React from 'react'

export default function Page() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-text-bright mb-6">Update OpenClaw</h2>
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="py-16 text-center text-text-muted">
          <p className="text-4xl mb-4">🔄</p>
          <p>Update mechanism: <code className="text-primary">update.run</code> RPC</p>
          <p>or SSH <code className="text-primary">npm update -g openclaw</code></p>
          <p className="text-xs mt-4">Implementation planned for Phase 3</p>
        </div>
      </div>
    </div>
  )
}
