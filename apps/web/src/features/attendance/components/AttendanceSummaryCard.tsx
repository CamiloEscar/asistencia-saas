import { useTranslation } from 'react-i18next'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AttendanceSummaryCardProps {
  title: string
  pct: number // 0..100
  present: number
  late: number
  absent: number
  justified: number
  className?: string
}

/**
 * Reusable summary card. Displays the overall attendance % as a large
 * number with a color-coded background (green ≥90%, amber 75-90%,
 * red <75%) and a small breakdown tooltip-style line.
 */
export function AttendanceSummaryCard({
  title,
  pct,
  present,
  late,
  absent,
  justified,
  className,
}: AttendanceSummaryCardProps) {
  const { t } = useTranslation()
  const rounded = Math.round(pct)
  const color = rounded >= 90 ? 'success' : rounded >= 75 ? 'warning' : 'destructive'
  const bg =
    color === 'success'
      ? 'bg-green-50 dark:bg-green-950/30'
      : color === 'warning'
        ? 'bg-amber-50 dark:bg-amber-950/30'
        : 'bg-red-50 dark:bg-red-950/30'
  const fg =
    color === 'success'
      ? 'text-green-700 dark:text-green-300'
      : color === 'warning'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-red-700 dark:text-red-300'
  const Icon = rounded >= 90 ? TrendingUp : rounded >= 75 ? Minus : TrendingDown

  return (
    <Card className={cn(bg, 'border-current/20', className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className={cn('text-3xl font-bold tabular-nums', fg)}>{rounded}%</p>
          </div>
          <Icon className={cn('h-8 w-8', fg)} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t('attendance.summaryCard.breakdown', {
            present,
            late,
            absent,
            justified,
          })}
        </p>
      </CardContent>
    </Card>
  )
}
