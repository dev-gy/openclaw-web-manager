import React from 'react'
import { cn } from '../../lib/utils'

type AlertVariant = 'success' | 'error' | 'warning' | 'info'

interface AlertProps {
  variant: AlertVariant
  title?: string
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
  children: React.ReactNode
}

const variantStyles: Record<AlertVariant, string> = {
  success: 'bg-success/10 border-success/30 text-success',
  error: 'bg-error/10 border-error/30 text-error',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  info: 'bg-info/10 border-info/30 text-info',
}

const icons: Record<AlertVariant, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

export function Alert({
  variant,
  title,
  dismissible,
  onDismiss,
  className,
  children,
}: AlertProps) {
  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg border text-sm',
        variantStyles[variant],
        className,
      )}
      role="alert"
    >
      <span className="flex-shrink-0 text-base leading-none mt-0.5">{icons[variant]}</span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium mb-0.5">{title}</p>}
        <div className="opacity-90">{children}</div>
      </div>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  )
}
