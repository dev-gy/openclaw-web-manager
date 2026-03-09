import React from 'react'
import { cn } from '../../lib/utils'

interface CardProps {
  variant?: 'default' | 'interactive'
  status?: 'success' | 'warning' | 'error' | null
  padding?: 'sm' | 'md' | 'lg'
  className?: string
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLDivElement>
}

const statusBorder: Record<string, string> = {
  success: 'border-l-success',
  warning: 'border-l-warning',
  error: 'border-l-error',
}

const paddingStyles: Record<string, string> = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({
  variant = 'default',
  status,
  padding = 'md',
  className,
  children,
  onClick,
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-xl border border-border',
        paddingStyles[padding],
        status && `border-l-4 ${statusBorder[status]}`,
        variant === 'interactive' && 'hover:border-accent/50 transition-colors cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
