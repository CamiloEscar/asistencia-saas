import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, GraduationCap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress-shim'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/feedback/PageHeader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'
import { Paths } from '@/app/routes/paths'
import { useStudentAttendanceSummary, useRecentAbsences } from '../api/student-dashboard.api'

export function StudentDashboard() {
  const { t } = useTranslation()
  const summary = useStudentAttendanceSummary()
  const absences = useRecentAbsences(5)

  const overall = summary.data?.overall

  if (summary.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (summary.isError) return <ErrorState onRetry={() => summary.refetch()} />
  if (!summary.data || !overall || overall.total === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('student.title')} />
        <EmptyState
          title={t('student.noEnrollments')}
          icon={<GraduationCap className="h-6 w-6" />}
        />
      </div>
    )
  }

  const lowCourses = (summary.data.byCourse ?? []).filter((c) => c.attendancePct < 75)

  return (
    <div className="space-y-6">
      <PageHeader title={t('student.title')} />

      {/* Big KPI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('student.overallAttendance')}</CardTitle>
          <CardDescription>
            {overall.total} registros · {overall.present} presente, {overall.late} tardanzas,{' '}
            {overall.absent} ausentes, {overall.justified} justificados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold tracking-tight">
              {overall.attendancePct.toFixed(0)}%
            </div>
            <Progress value={overall.attendancePct} className="flex-1" />
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {lowCourses.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">{t('student.alerts')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {lowCourses.map((c) => (
                <li key={c.courseId} className="flex items-center justify-between gap-3 text-sm">
                  <span>{c.courseName}</span>
                  <Badge variant="warning">{c.attendancePct.toFixed(0)}%</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Per-course breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('student.perCourse')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {summary.data.byCourse.map((c) => (
              <li key={c.courseId} className="flex items-center gap-3">
                <Link
                  to={Paths.myCourse(c.courseId)}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                >
                  {c.courseName}
                </Link>
                <span className="w-12 text-right text-sm tabular-nums">
                  {c.attendancePct.toFixed(0)}%
                </span>
                <Progress value={c.attendancePct} className="w-32" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Recent absences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('student.recentAbsences')}</CardTitle>
        </CardHeader>
        <CardContent>
          {absences.data && absences.data.length > 0 ? (
            <ul className="divide-y">
              {absences.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate">{a.courseName}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.status === 'ABSENT' ? 'destructive' : 'warning'}>
                      {t(`attendanceStatus.${a.status}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.recordedAt).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-center text-sm text-muted-foreground">
              No tuviste ausencias recientes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
