import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

/**
 * Empty-state placeholder. Renders inside any container. The default
 * icon is a generic Inbox; pass an icon override for context (e.g.
 * Users, BookOpen).
 */
export function EmptyState({
  title = 'Sin datos',
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center ${className ?? ''}`}
    >
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-medium">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && (
        <Button onClick={action.onClick} variant="outline" size="sm">
          {action.label}
        </Button>
      )}
    </div>
  )
}
