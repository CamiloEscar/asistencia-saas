import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  /** Right-aligned action area (buttons, filters, etc.). */
  actions?: ReactNode
  /** Optional breadcrumb above the title. */
  breadcrumb?: ReactNode
}

/**
 * Page header used at the top of every list / detail page. Provides a
 * consistent vertical rhythm: title + optional description on the left,
 * actions on the right.
 */
export function PageHeader({ title, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        {breadcrumb && <div className="text-sm text-muted-foreground">{breadcrumb}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
