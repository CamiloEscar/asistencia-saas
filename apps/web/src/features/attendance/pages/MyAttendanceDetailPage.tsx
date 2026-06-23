import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, FileText } from 'lucide-react'
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
  Badge,
} from '@/components/ui'
import { PageHeader } from '@/components/feedback/PageHeader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'
import { Tooltip } from '@/components/ui/tooltip'
import { Paths } from '@/app/routes/paths'
import { attendanceStatusColor } from '@asistencia/shared'
import { useMyCourseHistory } from '../api/student-attendance.api'
import { AttendanceSummaryCard } from '../components/AttendanceSummaryCard'
import { AttendanceProgressBar } from '../components/AttendanceProgressBar'

const RANGES = [
  { value: '7d', labelKey: 'attendance.myAttendance.filters.ranges.7d' },
  { value: '30d', labelKey: 'attendance.myAttendance.filters.ranges.30d' },
  { value: 'semester', labelKey: 'attendance.myAttendance.filters.ranges.semester' },
  { value: 'all', labelKey: 'attendance.myAttendance.filters.ranges.all' },
] as const

const dayMs = 24 * 60 * 60 * 1000

function buildRange(range: string): { from?: string; to?: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  switch (range) {
    case '7d':
      return { from: new Date(now.getTime() - 7 * dayMs).toISOString().slice(0, 10), to }
    case '30d':
      return { from: new Date(now.getTime() - 30 * dayMs).toISOString().slice(0, 10), to }
    case 'semester':
      return { from: new Date(now.getTime() - 120 * dayMs).toISOString().slice(0, 10), to }
    default:
      return {}
  }
}

function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function MyAttendanceDetailPage() {
  const { t } = useTranslation()
  const { courseId } = useParams<{ courseId: string }>()
  const [range, setRange] = useState('30d')
  const params = buildRange(range)
  const q = useMyCourseHistory(courseId, params.from, params.to)

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />
  if (!q.data) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('attendance.courseDetail.title')}
        breadcrumb={
          <Link to={Paths.myAttendance} className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3 w-3" /> {t('attendance.myAttendance.title')}
          </Link>
        }
        actions={
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {t(r.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <AttendanceSummaryCard
          title={t('attendance.courseDetail.overall')}
          pct={q.data.overall.attendancePct}
          present={q.data.overall.present}
          late={q.data.overall.late}
          absent={q.data.overall.absent}
          justified={q.data.overall.justified}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('attendance.courseDetail.byStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceProgressBar
              present={q.data.overall.present}
              late={q.data.overall.late}
              absent={q.data.overall.absent}
              justified={q.data.overall.justified}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span>Presentes: {q.data.overall.present}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Tardanzas: {q.data.overall.late}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Justificados: {q.data.overall.justified}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span>Ausentes: {q.data.overall.absent}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('attendance.courseDetail.timeline')}</CardTitle>
          <CardDescription>{q.data.sessions.length} sesiones</CardDescription>
        </CardHeader>
        <CardContent>
          {q.data.sessions.length === 0 ? (
            <EmptyState
              title={t('attendance.courseDetail.noSessions')}
              icon={<FileText className="h-6 w-6" />}
            />
          ) : (
            <ol className="relative space-y-2 border-l-2 border-muted pl-4">
              {q.data.sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{formatDate(s.scheduledAt)}</p>
                    {s.justificationText && (
                      <Tooltip content={s.justificationText}>
                        <p className="line-clamp-1 text-xs italic text-muted-foreground">
                          &ldquo;{s.justificationText}&rdquo;
                        </p>
                      </Tooltip>
                    )}
                  </div>
                  <Badge variant={attendanceStatusColor[s.status]}>
                    {t(`attendanceStatus.${s.status}`)}
                  </Badge>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
