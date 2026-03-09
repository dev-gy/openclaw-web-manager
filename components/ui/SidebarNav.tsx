import React from 'react'
import { cn } from '../../lib/utils'

interface NavItem {
  href: string
  label: string
  icon?: React.ReactNode
}

interface NavGroup {
  title?: string
  items: NavItem[]
}

interface SidebarNavProps {
  groups: NavGroup[]
  currentPath?: string
  collapsed?: boolean
  className?: string
}

export function SidebarNav({ groups, currentPath = '', collapsed = false, className }: SidebarNavProps) {
  return (
    <nav className={cn('space-y-4', className)}>
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.title && !collapsed && (
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              {group.title}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive =
                currentPath === item.href ||
                (item.href !== '/' && currentPath.startsWith(item.href))

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-text-secondary hover:bg-card-hover hover:text-text-primary',
                    collapsed && 'justify-center',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  {!collapsed && <span>{item.label}</span>}
                </a>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
