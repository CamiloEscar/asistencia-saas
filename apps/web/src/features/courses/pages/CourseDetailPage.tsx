import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserMinus } from 'lucide-react'
import type { User } from '@asistencia/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/feedback/PageHeader'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useToast } from '@/hooks/use-toast'
import {
  useCourse,
  useCourseStudents,
  useEnrollStudents,
  useUnenrollStudent,
} from '../api/courses.api'
import { useListStudents } from '@/features/students/api/students.api'

function formatSchedule(schedule: unknown): string {
  if (!Array.isArray(schedule)) return '—'
  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return schedule
    .map(
      (b: { day: number; startTime: string; endTime: string }) =>
        `${dayLabels[b.day]} ${b.startTime}-${b.endTime}`,
    )
    .join(', ')
}

export function CourseDetailPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const params = useParams<{ id: string }>()
  const courseId = params.id ?? ''

  const course = useCourse(courseId)
  const students = useCourseStudents(courseId)
  const allStudents = useListStudents({ limit: 200 })
  const enroll = useEnrollStudents(courseId)
  const unenroll = useUnenrollStudent(courseId)

  const [toEnroll, setToEnroll] = useState('')
  const [confirmUnenroll, setConfirmUnenroll] = useState<string | null>(null)

  async function handleEnroll() {
    if (!toEnroll || toEnroll === '__none') return
    try {
      const res = await enroll.mutateAsync({ studentIds: [toEnroll] })
      toast.success(`${res.added ?? 1} alumno(s) inscripto(s)`)
      setToEnroll('')
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  async function handleUnenroll(studentId: string) {
    try {
      await unenroll.mutateAsync(studentId)
      toast.success(t('courses.detail.unenrollSuccess'))
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
    setConfirmUnenroll(null)
  }

  if (course.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (course.isError || !course.data) {
    return <p className="text-destructive">Curso no encontrado</p>
  }

  const enrolled = students.data?.data ?? []
  const enrolledIds = new Set(enrolled.map((s) => s.id))
  const candidates = (allStudents.data?.data ?? []).filter((s) => !enrolledIds.has(s.id))

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.data.name}
        description={`${course.data.code} · ${course.data.semester}`}
        breadcrumb={
          <span>
            <a href="/courses" className="hover:underline">
              {t('courses.list.title')}
            </a>{' '}
            / {course.data.name}
          </span>
        }
      />

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">{t('courses.detail.tabs.info')}</TabsTrigger>
          <TabsTrigger value="students">
            {t('courses.detail.tabs.students')} ({enrolled.length})
          </TabsTrigger>
          <TabsTrigger value="attendance">{t('courses.detail.tabs.attendance')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>{t('courses.detail.tabs.info')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>{t('courses.list.columns.schedule')}:</strong>{' '}
                {formatSchedule((course.data as unknown as { schedule?: unknown }).schedule)}
              </p>
              <p>
                <strong>{t('courses.list.columns.startDate')}:</strong>{' '}
                {new Date(course.data.startDate).toLocaleDateString('es-AR')}
              </p>
              <p>
                <strong>{t('courses.list.columns.endDate')}:</strong>{' '}
                {new Date(course.data.endDate).toLocaleDateString('es-AR')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('courses.detail.enrollStudents')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <Select value={toEnroll} onValueChange={setToEnroll}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar alumno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none" disabled>
                      Seleccionar alumno
                    </SelectItem>
                    {candidates.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.legajo} · {s.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleEnroll}
                disabled={!toEnroll || toEnroll === '__none' || enroll.isPending}
              >
                {t('courses.detail.enrollStudents')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('courses.detail.tabs.students')}</CardTitle>
              <CardDescription>
                {enrolled.length} {enrolled.length === 1 ? 'alumno' : 'alumnos'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {enrolled.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('courses.detail.noStudents')}</p>
              ) : (
                <ul className="divide-y">
                  {enrolled.map((s: User) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.legajo} · {s.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={s.status === 'ACTIVE' ? 'success' : 'destructive'}>
                          {s.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmUnenroll(s.id)}>
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>{t('courses.detail.tabs.attendance')}</CardTitle>
              <CardDescription>Próximamente: sesiones y resumen</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!confirmUnenroll}
        onOpenChange={(o) => !o && setConfirmUnenroll(null)}
        title={t('courses.detail.unenroll', {
          name: enrolled.find((s) => s.id === confirmUnenroll)?.fullName ?? '',
        })}
        confirmLabel={t('courses.detail.unenroll')}
        variant="destructive"
        isLoading={unenroll.isPending}
        onConfirm={async () => {
          if (confirmUnenroll) await handleUnenroll(confirmUnenroll)
        }}
      />
    </div>
  )
}
