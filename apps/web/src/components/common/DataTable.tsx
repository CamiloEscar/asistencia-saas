import * as React from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

/**
 * Generic DataTable built on top of shadcn's Table primitives.
 *
 * Behaviour:
 *  - Renders a header row from the `columns` array.
 *  - Each column can opt into a mobile "card" mode by setting `card` to
 *    a key of the row that holds the primary label.
 *  - Cursor pagination via "load more" button (no infinite scroll on
 *    purpose — keeps the API surface simple and accessible).
 *  - Optional toolbar with search + custom filters.
 *  - Loading / empty / error states handled by the parent (the parent
 *    already has the TanStack query and passes `isLoading` / `isError`
 *    / `data`).
 *
 * Note: This is a deliberately small abstraction. If a table needs
 * sorting, column-level filtering, or row selection we should evaluate
 * @tanstack/react-table at that point.
 */

export interface DataTableColumn<T> {
  /** Header label (raw string, i18n is the caller's responsibility). */
  header: string
  /** Key into the row object, or a function that returns a ReactNode. */
  accessor: keyof T | ((row: T) => React.ReactNode)
  /** Tailwind class applied to the cell (e.g. "text-right"). */
  className?: string
  /** Hide this column on mobile (≤sm). Useful for low-priority cells. */
  hideOnMobile?: boolean
}

export interface DataTableToolbarProps {
  search?: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
  }
  filters?: React.ReactNode
  actions?: React.ReactNode
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[] | ((rows: T[]) => DataTableColumn<T>[])
  rows: T[]
  rowKey: (row: T) => string
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  emptyState?: {
    title?: string
    description?: string
    action?: { label: string; onClick: () => void }
  }
  toolbar?: DataTableToolbarProps
  pagination?: {
    hasMore: boolean
    onLoadMore: () => void
    isFetchingMore?: boolean
  }
  /** Optional row click handler. */
  onRowClick?: (row: T) => void
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  isError,
  onRetry,
  emptyState,
  toolbar,
  pagination,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const resolvedColumns = typeof columns === 'function' ? columns(rows) : columns

  return (
    <div className={cn('space-y-3', className)}>
      {toolbar && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {toolbar.search && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={toolbar.search.value}
                  onChange={(e) => toolbar.search!.onChange(e.target.value)}
                  placeholder={toolbar.search.placeholder ?? 'Buscar'}
                  className="pl-9"
                />
              </div>
            )}
            {toolbar.filters}
          </div>
          {toolbar.actions && <div className="flex items-center gap-2">{toolbar.actions}</div>}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {resolvedColumns.map((c, i) => (
                <TableHead
                  key={i}
                  className={cn(c.className, c.hideOnMobile && 'hidden sm:table-cell')}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={resolvedColumns.length} className="h-32 text-center">
                  <LoadingSpinner size="md" />
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={resolvedColumns.length}>
                  <ErrorState onRetry={onRetry} />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={resolvedColumns.length} className="p-0">
                  <EmptyState
                    title={emptyState?.title ?? 'Sin datos'}
                    description={emptyState?.description}
                    action={emptyState?.action}
                  />
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {resolvedColumns.map((c, i) => (
                  <TableCell
                    key={i}
                    className={cn(c.className, c.hideOnMobile && 'hidden sm:table-cell')}
                  >
                    {typeof c.accessor === 'function'
                      ? c.accessor(row)
                      : (row[c.accessor] as React.ReactNode)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={pagination.onLoadMore}
            disabled={pagination.isFetchingMore}
          >
            {pagination.isFetchingMore ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <ChevronRight className="mr-2 h-4 w-4" />
            )}
            Cargar más
          </Button>
        </div>
      )}

      {pagination && !pagination.hasMore && rows.length > 0 && (
        <div className="flex justify-center">
          <span className="inline-flex items-center text-xs text-muted-foreground">
            <ChevronLeft className="mr-1 h-3 w-3" />
            {rows.length} {rows.length === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>
      )}
    </div>
  )
}
