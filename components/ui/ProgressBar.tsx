import React from 'react'
import { cn } from '../../lib/utils'

type ProgressVariant = 'default' | 'success' | 'warning' | 'error'

interface ProgressBarProps {
  value: number
  variant?: ProgressVariant
  size?: 'sm' | 'md'
  showLabel?: boolean
  indeterminate?: boolean
  className?: string
}

const variantColors: Record<ProgressVariant, string> = {
  default: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
}

export function ProgressBar({
  value,
  variant = 'default',
  size = 'md',
  showLabel = false,
  indeterminate = false,
  className,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-text-secondary">Progress</span>
          <span className="text-xs text-text-secondary">{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full bg-bg-secondary overflow-hidden',
          size === 'sm' ? 'h-1' : 'h-2',
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            variantColors[variant],
            indeterminate && 'animate-pulse w-full',
          )}
          style={indeterminate ? undefined : { width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
