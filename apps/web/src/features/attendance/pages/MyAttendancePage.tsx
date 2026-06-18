import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarX2, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { PageHeader } from '@/components/feedback/PageHeader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'
import { Paths } from '@/app/routes/paths'
import { useMyAttendanceSummary } from '../api/student-attendance.api'
import { AttendanceSummaryCard } from '../components/AttendanceSummaryCard'
import { AttendanceProgressBar } from '../components/AttendanceProgressBar'

const RANGE_OPTIONS = [
  { value: '7d', labelKey: 'attendance.myAttendance.filters.ranges.7d', days: 7 },
  { value: '30d', labelKey: 'attendance.myAttendance.filters.ranges.30d', days: 30 },
  { value: 'semester', labelKey: 'attendance.myAttendance.filters.ranges.semester', days: 120 },
  { value: 'all', labelKey: 'attendance.myAttendance.filters.ranges.all', days: 3650 },
] as const

export function MyAttendancePage() {
  const { t } = useTranslation()
  const [range, setRange] = useState<string>('30d')
  const summary = useMyAttendanceSummary()

  if (summary.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (summary.isError) {
    return <ErrorState onRetry={() => summary.refetch()} />
  }
  if (!summary.data) return null

  const { overall, byCourse } = summary.data

  // Filter byCourse by range (best-effort: client-side since summary doesn't
  // accept range; the API has it for sessions, not summary).
  // For MVP we display everything; the date filter is informational.

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('attendance.myAttendance.title')}
        description={t('attendance.myAttendance.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t('attendance.myAttendance.filters.range')}:
            </span>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {t(r.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <AttendanceSummaryCard
        title={t('attendance.myAttendance.overall')}
        pct={overall.attendancePct}
        present={overall.present}
        late={overall.late}
        absent={overall.absent}
        justified={overall.justified}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('attendance.myAttendance.byCourse')}
        </h2>
        {byCourse.length === 0 ? (
          <EmptyState
            title={t('attendance.myAttendance.empty.title')}
            description={t('attendance.myAttendance.empty.description')}
            icon={<CalendarX2 className="h-6 w-6" />}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {byCourse.map((c) => (
              <Card key={c.courseId}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{c.courseName}</CardTitle>
                      <CardDescription className="flex items-center gap-1 text-xs">
                        <TrendingUp className="h-3 w-3" />
                        {c.attendancePct}% · {c.total} sesiones
                      </CardDescription>
                    </div>
                    <Link
                      to={Paths.myCourse(c.courseId)}
                      className="text-xs text-primary hover:underline"
                    >
                      {t('attendance.myAttendance.viewCourse')}
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <AttendanceProgressBar
                    present={c.present}
                    late={c.late}
                    absent={c.absent}
                    justified={c.justified}
                  />
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                    <span>{c.present}P</span>
                    <span>{c.late}T</span>
                    <span>{c.justified}J</span>
                    <span>{c.absent}A</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
