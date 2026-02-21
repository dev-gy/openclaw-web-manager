import React from 'react'

export default function Page() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-bright">Config Editor</h2>
          <p className="text-sm text-text-muted mt-1">
            openclaw.json — JSON Schema 기반 동적 폼 (Phase 5에서 구현)
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-surface-hover hover:bg-border text-text rounded-lg text-sm transition-colors">
            Reset
          </button>
          <button className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm transition-colors">
            Save & Apply
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="py-16 text-center text-text-muted">
          <p className="text-4xl mb-4">⚙️</p>
          <p>Config editor will render dynamic forms based on</p>
          <p><code className="text-primary">config.schema</code> RPC response</p>
          <p className="text-xs mt-4">Implementation planned for Phase 5</p>
        </div>
      </div>
    </div>
  )
}
