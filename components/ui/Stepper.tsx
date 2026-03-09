import React from 'react'
import { cn } from '../../lib/utils'

interface Step {
  id: string
  title: string
  description?: string
}

interface StepperProps {
  steps: Step[]
  currentStep: string
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

export function Stepper({
  steps,
  currentStep,
  orientation = 'horizontal',
  className,
}: StepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep)

  if (orientation === 'vertical') {
    return (
      <div className={cn('space-y-2', className)}>
        {steps.map((step, i) => {
          const state = i < currentIndex ? 'completed' : i === currentIndex ? 'current' : 'upcoming'
          return (
            <div key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium',
                    state === 'completed' && 'bg-success text-white',
                    state === 'current' && 'bg-accent text-white',
                    state === 'upcoming' && 'bg-border text-text-secondary',
                  )}
                >
                  {state === 'completed' ? '✓' : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-0.5 flex-1 min-h-[24px] my-1',
                      i < currentIndex ? 'bg-success' : 'bg-border',
                    )}
                  />
                )}
              </div>
              <div className="pb-4">
                <p
                  className={cn(
                    'text-sm font-medium',
                    state === 'current' ? 'text-text-primary' : 'text-text-secondary',
                  )}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-text-secondary mt-0.5">{step.description}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('flex gap-2', className)}>
      {steps.map((step, i) => (
        <div key={step.id} className="flex-1 group" title={step.title}>
          <div
            className={cn(
              'h-1.5 rounded-full transition-colors',
              i < currentIndex && 'bg-success',
              i === currentIndex && 'bg-accent',
              i > currentIndex && 'bg-border',
            )}
          />
          <p
            className={cn(
              'text-[10px] mt-1.5 truncate',
              i <= currentIndex ? 'text-text-primary' : 'text-text-secondary',
            )}
          >
            {step.title}
          </p>
        </div>
      ))}
    </div>
  )
}
