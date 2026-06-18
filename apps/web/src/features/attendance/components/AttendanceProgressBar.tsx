import { cn } from '@/lib/utils'

interface AttendanceProgressBarProps {
  present: number
  late: number
  absent: number
  justified: number
  className?: string
}

/**
 * Stacked horizontal bar showing the 4 attendance states proportionally.
 * Used in dashboards, student history, and course summaries.
 */
export function AttendanceProgressBar({
  present,
  late,
  absent,
  justified,
  className,
}: AttendanceProgressBarProps) {
  const total = present + late + absent + justified
  if (total === 0) {
    return (
      <div
        className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
        role="progressbar"
        aria-label="Sin datos"
      />
    )
  }
  const segments = [
    { key: 'present', value: present, className: 'bg-green-500' },
    { key: 'late', value: late, className: 'bg-amber-500' },
    { key: 'justified', value: justified, className: 'bg-blue-500' },
    { key: 'absent', value: absent, className: 'bg-red-500' },
  ]
  return (
    <div
      className={cn('flex h-2 w-full overflow-hidden rounded-full', className)}
      role="progressbar"
      aria-valuenow={present}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      {segments.map((s) =>
        s.value > 0 ? (
          <div
            key={s.key}
            className={cn(s.className, 'h-full')}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.key}: ${s.value}`}
          />
        ) : null,
      )}
    </div>
  )
}
