import React, { useState } from 'react'

export default function Page() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (res.ok) {
      window.location.href = '/'
    } else {
      const data = await res.json()
      setError(data.message || 'Login failed')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen -m-6">
      <div className="w-full max-w-sm bg-surface rounded-xl border border-border p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-bright">🐾 OWM</h1>
          <p className="text-sm text-text-muted mt-1">OpenClaw Web Manager</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-text-muted mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text focus:border-primary focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text focus:border-primary focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-medium transition-colors"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  )
}
