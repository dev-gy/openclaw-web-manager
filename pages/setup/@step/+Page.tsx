import React from 'react'
import { usePageContext } from 'vike-react/usePageContext'

const steps = [
  { id: '1', title: 'Server Connection', desc: 'SSH 접속 정보 입력' },
  { id: '2', title: 'Pre-check', desc: 'OS, RAM, Node.js 버전 확인' },
  { id: '3', title: 'Node.js Install', desc: 'Node.js v24 설치' },
  { id: '4', title: 'OpenClaw Install', desc: 'npm install -g openclaw' },
  { id: '5', title: 'Configuration', desc: 'LLM API 키, Gateway 설정' },
  { id: '6', title: 'Daemon Setup', desc: 'systemd 서비스 등록' },
  { id: '7', title: 'Health Check', desc: 'Gateway 응답 확인' },
  { id: '8', title: 'Complete', desc: '설치 완료' },
]

export default function Page() {
  const { routeParams } = usePageContext()
  const currentStep = routeParams.step || '1'
  const stepIndex = steps.findIndex((s) => s.id === currentStep)
  const step = steps[stepIndex] || steps[0]

  return (
    <div>
      <h2 className="text-2xl font-bold text-text-bright mb-6">Install OpenClaw</h2>

      {/* Stepper */}
      <div className="flex gap-2 mb-8">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={`flex-1 h-1.5 rounded-full ${
              i <= stepIndex ? 'bg-primary' : 'bg-border'
            }`}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="mb-4">
          <span className="text-xs text-primary font-medium">
            Step {step.id} of {steps.length}
          </span>
          <h3 className="text-lg font-semibold text-text-bright mt-1">{step.title}</h3>
          <p className="text-sm text-text-muted">{step.desc}</p>
        </div>

        {/* Step 1: SSH Connection Form */}
        {currentStep === '1' && <SSHConnectionForm />}

        {/* Other steps: placeholder */}
        {currentStep !== '1' && (
          <div className="py-12 text-center text-text-muted">
            Step {currentStep} content will be implemented in Phase 3
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t border-border">
          {stepIndex > 0 ? (
            <a
              href={`/setup/${steps[stepIndex - 1].id}`}
              className="px-4 py-2 text-sm text-text-muted hover:text-text transition-colors"
            >
              ← Previous
            </a>
          ) : (
            <div />
          )}
          {stepIndex < steps.length - 1 && (
            <a
              href={`/setup/${steps[stepIndex + 1].id}`}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm transition-colors"
            >
              Next →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function SSHConnectionForm() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-muted mb-1">Host</label>
          <input
            type="text"
            placeholder="192.168.1.100"
            className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-text-muted mb-1">Port</label>
          <input
            type="number"
            defaultValue={22}
            className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-text-muted mb-1">Username</label>
        <input
          type="text"
          placeholder="root"
          className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text focus:border-primary focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm text-text-muted mb-1">Authentication</label>
        <select className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text focus:border-primary focus:outline-none">
          <option value="password">Password</option>
          <option value="key">SSH Key</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-text-muted mb-1">Password</label>
        <input
          type="password"
          className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text focus:border-primary focus:outline-none"
        />
      </div>
      <button className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-white rounded-lg text-sm transition-colors">
        Test Connection
      </button>
    </div>
  )
}
