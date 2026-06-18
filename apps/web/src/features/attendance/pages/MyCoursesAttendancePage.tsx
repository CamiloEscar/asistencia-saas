import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Calendar, ClipboardCheck, Clock, ExternalLink } from 'lucide-react'
import type { ClassSession } from '@asistencia/shared'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from '@/components/ui'
import { PageHeader } from '@/components/feedback/PageHeader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'
import { Paths } from '@/app/routes/paths'
import { useMyCourses, useTeacherToday } from '@/features/dashboard/api/teacher-dashboard.api'

function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Teacher entry point for attendance. Shows the teacher's courses in
 * a grid of cards. Today's sessions are highlighted with a "Take
 * attendance" CTA. Other courses show "View history" instead.
 */
export function MyCoursesAttendancePage() {
  const { t } = useTranslation()
  const myCourses = useMyCourses()
  const today = useTeacherToday()

  const courses = myCourses.data ?? []
  const todaySessions = today.data?.sessions ?? []
  const todayByCourse = new Map<string, ClassSession>()
  todaySessions.forEach((s) => todayByCourse.set(s.courseId, s))

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('attendance.myCourses.title')}
        description={t('attendance.myCourses.subtitle')}
      />

      {myCourses.isLoading && (
        <div className="flex justify-center py-10">
          <LoadingSpinner size="lg" />
        </div>
      )}
      {myCourses.isError && <ErrorState onRetry={() => myCourses.refetch()} />}
      {myCourses.data && courses.length === 0 && (
        <EmptyState
          title={t('attendance.myCourses.noCourses')}
          description="Cuando un administrador te asigne cursos, aparecerán aquí."
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => {
          const session = todayByCourse.get(c.id)
          return (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 text-xs">
                  <Clock className="h-3 w-3" />
                  {c.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {session ? (
                  <div className="rounded-md border bg-muted/30 p-2 text-sm">
                    <div className="flex items-center gap-1 font-medium">
                      <Calendar className="h-3 w-3" />
                      {t('attendance.myCourses.sessionToday')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(session.scheduledAt)} · {session.durationMin} min
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge variant="outline">{session.enrolledCount} inscriptos</Badge>
                      <Button asChild size="sm">
                        <Link to={Paths.takeAttendance(session.id)}>
                          <ClipboardCheck className="mr-1 h-4 w-4" />
                          {t('attendance.myCourses.takeAttendance')}
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin sesión hoy</p>
                )}
                <div className="flex justify-end">
                  <Button asChild variant="ghost" size="sm">
                    <Link to={Paths.courseDetail(c.id)}>
                      <ExternalLink className="mr-1 h-4 w-4" />
                      {t('attendance.myCourses.viewHistory')}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
