import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ClipboardCheck, Edit3, Play } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/feedback/PageHeader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'
import { Paths } from '@/app/routes/paths'
import { useTeacherToday } from '../api/teacher-dashboard.api'
import { sessionStatusLabels } from '@asistencia/shared'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export function TeacherDashboard() {
  const { t } = useTranslation()
  const today = useTeacherToday()

  const sessions = today.data?.sessions ?? []
  const total = today.data?.totalSessions ?? 0
  const taken = today.data?.sessionsWithAttendance ?? 0

  return (
    <div className="space-y-6">
      <PageHeader title={t('teacher.title')} description={t('teacher.summary', { total, taken })} />

      {today.isLoading && (
        <div className="flex justify-center py-10">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {today.isError && <ErrorState onRetry={() => today.refetch()} />}

      {today.data && sessions.length === 0 && (
        <EmptyState
          title={t('teacher.noSessions')}
          description="Cuando un administrador cree sesiones en tus cursos, aparecerán aquí."
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sessions.map((s) => {
          const status = s.status
          const action = (() => {
            if (status === 'SCHEDULED') {
              return (
                <Button asChild variant="outline" size="sm">
                  <Link to={Paths.takeAttendance(s.id)}>
                    <Play className="mr-2 h-4 w-4" />
                    {t('teacher.openSession')}
                  </Link>
                </Button>
              )
            }
            if (status === 'OPEN') {
              return (
                <Button asChild size="sm">
                  <Link to={Paths.takeAttendance(s.id)}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    {t('teacher.takeAttendance')}
                  </Link>
                </Button>
              )
            }
            if (status === 'CLOSED') {
              return (
                <Button asChild variant="outline" size="sm">
                  <Link to={Paths.editAttendance(s.id)}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    {t('teacher.editAttendance')}
                  </Link>
                </Button>
              )
            }
            return null
          })()

          return (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{s.courseName ?? 'Curso'}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-xs">
                      <CalendarDays className="h-3 w-3" />
                      {formatTime(String(s.scheduledAt))} · {s.durationMin} min
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      status === 'OPEN'
                        ? 'success'
                        : status === 'SCHEDULED'
                          ? 'secondary'
                          : status === 'CANCELLED'
                            ? 'destructive'
                            : 'outline'
                    }
                  >
                    {sessionStatusLabels[status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {s.enrolledCount} inscriptos
                  {s.attendanceTaken ? ' · asistencia registrada' : ''}
                </span>
                {action}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
