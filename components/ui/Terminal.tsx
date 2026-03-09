import React, { useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'

interface TerminalLine {
  text: string
  type?: 'stdout' | 'stderr' | 'info' | 'command'
  timestamp?: string
}

interface TerminalProps {
  lines: TerminalLine[]
  title?: string
  maxHeight?: string
  autoScroll?: boolean
  className?: string
}

const lineColors: Record<string, string> = {
  stdout: 'text-gray-300',
  stderr: 'text-red-400',
  info: 'text-blue-400',
  command: 'text-green-400',
}

export function Terminal({
  lines,
  title,
  maxHeight = '400px',
  autoScroll = true,
  className,
}: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  return (
    <div className={cn('bg-[#0d0d0d] rounded-xl border border-border overflow-hidden', className)}>
      {title && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs text-gray-500 font-mono">{title}</span>
        </div>
      )}
      <div
        ref={scrollRef}
        className="p-4 overflow-auto font-mono text-xs leading-relaxed"
        style={{ maxHeight }}
      >
        {lines.length === 0 ? (
          <span className="text-gray-600">Waiting for output...</span>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              {line.timestamp && (
                <span className="text-gray-600 flex-shrink-0">[{line.timestamp}]</span>
              )}
              <span className={lineColors[line.type || 'stdout']}>
                {line.type === 'command' && '$ '}
                {line.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
