import React, { forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 bg-bg-primary border rounded-lg text-sm text-text-primary',
            'placeholder:text-text-secondary/50',
            'focus:outline-none focus:ring-1 transition-colors',
            error
              ? 'border-error focus:border-error focus:ring-error/30'
              : 'border-border focus:border-accent focus:ring-accent/30',
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
