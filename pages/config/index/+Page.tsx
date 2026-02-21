import React from 'react'

export default function Page() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-text-bright mb-6">Configuration</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConfigCard
          title="openclaw.json"
          desc="Main configuration: models, gateway, channels, heartbeat, cron"
          href="/config/editor"
          icon="📄"
        />
        <ConfigCard
          title="exec-approvals.json"
          desc="Command allowlist with deny-on-miss policy"
          href="/config/approvals"
          icon="🔐"
        />
        <ConfigCard
          title="HEARTBEAT.md"
          desc="Periodic health check checklist"
          href="/config/editor?file=HEARTBEAT.md"
          icon="💓"
        />
        <ConfigCard
          title="IDENTITY.md"
          desc="Agent persona: name, personality, role"
          href="/config/editor?file=IDENTITY.md"
          icon="🤖"
        />
      </div>
    </div>
  )
}

function ConfigCard({
  title,
  desc,
  href,
  icon,
}: {
  title: string
  desc: string
  href: string
  icon: string
}) {
  return (
    <a
      href={href}
      className="block bg-surface rounded-xl border border-border p-5 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="font-semibold text-text-bright">{title}</h3>
          <p className="text-sm text-text-muted mt-1">{desc}</p>
        </div>
      </div>
    </a>
  )
}
