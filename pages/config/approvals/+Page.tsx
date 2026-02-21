import React from 'react'

export default function Page() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-bright">Exec Approvals</h2>
          <p className="text-sm text-text-muted mt-1">
            exec-approvals.json — Command allowlist editor
          </p>
        </div>
        <button className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm transition-colors">
          Save
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="py-16 text-center text-text-muted">
          <p className="text-4xl mb-4">🔐</p>
          <p>Approval list CRUD editor</p>
          <p className="text-xs mt-4">Implementation planned for Phase 5</p>
        </div>
      </div>
    </div>
  )
}
