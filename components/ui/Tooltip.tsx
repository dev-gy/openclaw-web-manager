import React from 'react'
import { cn } from '../../lib/utils'

interface TooltipProps {
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  children: React.ReactNode
}

const positionStyles: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

export function Tooltip({ content, position = 'top', className, children }: TooltipProps) {
  return (
    <div className={cn('relative group inline-flex', className)}>
      {children}
      <div
        className={cn(
          'absolute z-50 px-2 py-1 text-xs rounded-md whitespace-nowrap',
          'bg-text-primary text-bg-primary',
          'opacity-0 invisible group-hover:opacity-100 group-hover:visible',
          'transition-all duration-150 pointer-events-none',
          positionStyles[position],
        )}
        role="tooltip"
      >
        {content}
      </div>
    </div>
  )
}
