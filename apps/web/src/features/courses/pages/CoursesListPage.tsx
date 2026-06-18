import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Plus } from 'lucide-react'
import type { Course, ListCoursesQuery } from '@asistencia/shared'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/feedback/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { Paths } from '@/app/routes/paths'
import { useListCourses } from '../api/courses.api'
import { useListSubjects } from '@/features/subjects/api/subjects.api'
import { useListTeachers } from '@/features/teachers/api/teachers.api'
import { CreateCourseDialog } from '../components/CreateCourseDialog'

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

function formatDate(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d)
  return dt.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function CoursesListPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined)
  const [teacherId, setTeacherId] = useState<string | undefined>(undefined)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)

  const query: ListCoursesQuery = {
    limit: 20,
    ...(cursor ? { cursor } : {}),
    ...(search ? { search } : {}),
    ...(subjectId ? { subjectId } : {}),
    ...(teacherId ? { teacherId } : {}),
  }
  const list = useListCourses(query)
  const subjects = useListSubjects({ limit: 100 })
  const teachers = useListTeachers({ limit: 100 })
  const rows: Course[] = list.data?.data ?? []

  const columns: DataTableColumn<Course>[] = [
    { header: t('courses.list.columns.code'), accessor: 'code' },
    { header: t('courses.list.columns.name'), accessor: 'name' },
    {
      header: t('courses.list.columns.subject'),
      accessor: (r) =>
        subjects.data?.data.find((s) => s.id === r.subjectId)?.name ?? r.subjectId.slice(0, 8),
      hideOnMobile: true,
    },
    {
      header: t('courses.list.columns.teacher'),
      accessor: () => '—', // populated by teachers list
      hideOnMobile: true,
    },
    {
      header: t('courses.list.columns.schedule'),
      accessor: (r) => formatSchedule((r as unknown as { schedule?: unknown }).schedule),
      hideOnMobile: true,
    },
    { header: t('courses.list.columns.semester'), accessor: 'semester', hideOnMobile: true },
    {
      header: t('courses.list.columns.startDate'),
      accessor: (r) => formatDate(r.startDate),
      hideOnMobile: true,
    },
    { header: t('courses.list.columns.students'), accessor: (r) => r.enrolledCount ?? 0 },
    {
      header: t('courses.list.columns.actions'),
      className: 'text-right',
      accessor: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('common.actions')}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => (window.location.href = Paths.courseDetail(r.id))}>
              {t('common.details')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('courses.list.title')}
        description={t('courses.list.subtitle')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('courses.list.create')}
          </Button>
        }
      />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        emptyState={{
          title: t('courses.list.empty.title'),
          description: t('courses.list.empty.description'),
        }}
        toolbar={{
          search: {
            value: search,
            onChange: (v) => {
              setSearch(v)
              setCursor(undefined)
            },
            placeholder: t('courses.list.searchPlaceholder'),
          },
          filters: (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={subjectId ?? ''}
                onChange={(e) => {
                  setSubjectId(e.target.value || undefined)
                  setCursor(undefined)
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">{t('courses.list.filters.allSubjects')}</option>
                {(subjects.data?.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
              <select
                value={teacherId ?? ''}
                onChange={(e) => {
                  setTeacherId(e.target.value || undefined)
                  setCursor(undefined)
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">{t('courses.list.filters.allTeachers')}</option>
                {(teachers.data?.data ?? []).map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {tt.fullName}
                  </option>
                ))}
              </select>
            </div>
          ),
        }}
        pagination={
          list.data?.hasMore
            ? {
                hasMore: true,
                isFetchingMore: list.isFetching,
                onLoadMore: () => list.data?.nextCursor && setCursor(list.data.nextCursor),
              }
            : undefined
        }
      />

      <CreateCourseDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
