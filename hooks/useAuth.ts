import { useState, useEffect, useCallback } from 'react'

interface AuthState {
  authenticated: boolean
  username: string | null
  loading: boolean
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    authenticated: false,
    username: null,
    loading: true,
  })

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setAuth({ authenticated: true, username: data.username, loading: false })
      } else {
        setAuth({ authenticated: false, username: null, loading: false })
      }
    } catch {
      setAuth({ authenticated: false, username: null, loading: false })
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (res.ok) {
      setAuth({ authenticated: true, username, loading: false })
      return true
    }
    return false
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuth({ authenticated: false, username: null, loading: false })
    window.location.href = '/login'
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return { ...auth, login, logout, checkAuth }
}
