import { cn } from '@/lib/utils'

/**
 * Generic loading skeleton. Use the `className` prop to set width/height
 * (typically with Tailwind utilities: `h-4 w-32` for a text line).
 * Respects `prefers-reduced-motion` (animation is set to 2s instead
 * of 1.5s and can be disabled by setting the `reduce` class on a
 * parent — handled globally by the Tailwind `motion-reduce:` variant).
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-busy="true"
      aria-live="polite"
      {...props}
    />
  )
}

/** Skeleton for a single DataTable row (5 cols). */
export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex w-full items-center gap-4 border-b px-4 py-3" aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4 flex-1', i === 0 && 'max-w-[40%]')} />
      ))}
    </div>
  )
}

/** Skeleton block for a DataTable (header + 5 rows). */
export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border bg-card" role="status" aria-label="Cargando datos">
      <div className="border-b bg-muted/30 px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
      <span className="sr-only">Cargando datos, esperá un momento</span>
    </div>
  )
}

/** Skeleton block for a KPI card (label + big number). */
export function SkeletonKpiCard() {
  return (
    <div className="rounded-lg border bg-card p-5" role="status" aria-label="Cargando indicador">
      <Skeleton className="mb-2 h-3 w-20" />
      <Skeleton className="mb-1 h-8 w-24" />
      <Skeleton className="h-3 w-32" />
      <span className="sr-only">Cargando indicador</span>
    </div>
  )
}

/** Skeleton grid for a dashboard (4 KPI cards). */
export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKpiCard key={i} />
      ))}
    </div>
  )
}

/** Skeleton for a course detail page header (title + meta + actions). */
export function SkeletonCourseHeader() {
  return (
    <div
      className="rounded-lg border bg-card p-6"
      role="status"
      aria-label="Cargando información del curso"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex-1">
          <Skeleton className="mb-2 h-6 w-1/2" />
          <Skeleton className="mb-1 h-4 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-1 h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando información del curso, esperá un momento</span>
    </div>
  )
}
