import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Calendar, ExternalLink } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
} from '@/components/ui'
import { PageHeader } from '@/components/feedback/PageHeader'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'
import { Paths } from '@/app/routes/paths'
import { useMyCourses, useTeacherToday } from '@/features/dashboard/api/teacher-dashboard.api'
import { useOpenSession, useSessionRoster } from '../api/attendance.api'
import { AttendanceRoster } from '../components/AttendanceRoster'

/**
 * Take attendance page (the critical-path UI).
 *
 * Flow:
 *  1. Pick a course (from the teacher's courses)
 *  2. Pick a date (default: today)
 *  3. Roster loads → AttendanceRoster takes over
 *
 * If the session already has attendance and is the same day, the page
 * loads in edit mode (PATCH instead of POST).
 */
export function TakeAttendancePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = useParams<{ sessionId?: string }>()
  const today = useTeacherToday()
  const myCourses = useMyCourses()
  const [courseId, setCourseId] = useState<string>('')
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const openSession = useOpenSession()

  // If a sessionId was passed in the URL, preselect it.
  useEffect(() => {
    if (params.sessionId && today.data) {
      const s = today.data.sessions.find((x) => x.id === params.sessionId)
      if (s) {
        setCourseId(s.courseId)
        if (s.status === 'SCHEDULED') {
          // auto-open the session
          openSession.mutate(s.id)
        }
      }
    }
  }, [params.sessionId, today.data, openSession])

  if (params.sessionId) {
    return <SessionMode sessionId={params.sessionId} date={date} />
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('attendance.take.title')} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('attendance.take.selectCourse')}</CardTitle>
          </CardHeader>
          <CardContent>
            {myCourses.isLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar curso" />
                </SelectTrigger>
                <SelectContent>
                  {(myCourses.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('attendance.take.selectDate')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {courseId && date && (
        <TodaySessionForCourse
          courseId={courseId}
          date={date}
          onPick={(sessionId) => navigate(Paths.takeAttendance(sessionId))}
        />
      )}
    </div>
  )
}

function TodaySessionForCourse({
  courseId,
  date,
  onPick,
}: {
  courseId: string
  date: string
  onPick: (sessionId: string) => void
}) {
  const today = useTeacherToday()
  const match = (today.data?.sessions ?? []).find(
    (s) => s.courseId === courseId && s.scheduledAt.toString().slice(0, 10) === date,
  )
  if (!match) {
    return <p className="text-sm text-muted-foreground">No hay sesión para esa fecha.</p>
  }
  return (
    <Button onClick={() => onPick(match.id)} variant="default" size="lg">
      <ExternalLink className="mr-2 h-4 w-4" />
      Abrir sesión de{' '}
      {new Date(match.scheduledAt).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      })}
    </Button>
  )
}

function SessionMode({ sessionId, date }: { sessionId: string; date: string }) {
  const { t } = useTranslation()
  const roster = useSessionRoster(sessionId)
  const isToday = new Date(date).toDateString() === new Date().toDateString()

  if (roster.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (roster.isError || !roster.data) {
    return <p className="text-destructive">No se pudo cargar la sesión.</p>
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('attendance.take.title')}
        description={`${roster.data.session.courseName ?? ''} · ${new Date(roster.data.session.scheduledAt).toLocaleString('es-AR')}`}
      />
      {isToday && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
          {t('attendance.take.editingBanner', { date })}
        </div>
      )}
      <AttendanceRoster
        sessionId={sessionId}
        roster={roster.data}
        isEdit={isToday}
        onSubmitted={() => {
          // navigate back to today view
          window.location.href = Paths.today
        }}
      />
    </div>
  )
}
