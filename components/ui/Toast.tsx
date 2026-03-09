import React from 'react'
import { cn } from '../../lib/utils'
import type { Toast as ToastType } from '../../hooks/useToast'

interface ToastContainerProps {
  toasts: ToastType[]
  onDismiss: (id: string) => void
}

const variantStyles: Record<string, string> = {
  success: 'border-l-success bg-success/10 text-success',
  error: 'border-l-error bg-error/10 text-error',
  warning: 'border-l-warning bg-warning/10 text-warning',
  info: 'border-l-info bg-info/10 text-info',
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 border border-border shadow-lg',
            'bg-card backdrop-blur-sm animate-in slide-in-from-right',
            variantStyles[toast.variant],
          )}
          role="alert"
        >
          <span className="flex-1 text-sm">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity text-text-secondary"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
