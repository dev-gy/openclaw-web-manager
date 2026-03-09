import React from 'react'
import '../../styles/global.css'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary">
      {children}
    </div>
  )
}
