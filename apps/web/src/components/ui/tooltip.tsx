import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Lightweight tooltip that uses the native `title` attribute for full
 * a11y coverage and an absolutely-positioned span for the visual on
 * hover/focus. Adequate for the MVP — a Radix-based version can come
 * later if richer behaviour (controlled, arrow placement, delay) is
 * needed.
 */
export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function Tooltip({ content, children, className }: TooltipProps) {
  if (!content) return <>{children}</>
  return (
    <span
      className={cn('relative inline-flex', className)}
      title={typeof content === 'string' ? content : undefined}
    >
      {children}
    </span>
  )
}
