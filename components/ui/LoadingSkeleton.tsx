import React from 'react'
import { cn } from '../../lib/utils'

interface LoadingSkeletonProps {
  lines?: number
  variant?: 'grid' | 'list' | 'block'
}

export function LoadingSkeleton({
  lines = 3,
  variant = 'grid',
}: LoadingSkeletonProps) {
  if (variant === 'block') {
    return (
      <div className="animate-pulse bg-bg-secondary h-64 rounded-lg w-full" />
    )
  }

  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="animate-pulse bg-bg-secondary h-12 rounded-lg" />
        ))}
      </div>
    )
  }

  // grid (default)
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="animate-pulse bg-bg-secondary h-24 rounded-lg" />
      ))}
    </div>
  )
}
