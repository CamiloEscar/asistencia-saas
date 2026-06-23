import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import type { AttendanceRecord, ListAttendanceQuery } from '@asistencia/shared'
import { AttendanceStatus, attendanceStatusColor } from '@asistencia/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/feedback/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { useListAttendance } from '../api/attendance.api'
import { useListCourses } from '@/features/courses/api/courses.api'

function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function exportCsv(rows: AttendanceRecord[], t: (key: string) => string): void {
  const header = ['Fecha', 'Alumno', 'Curso', 'Estado', 'Justificación']
  const lines = rows.map((r) => [
    formatDate(r.recordedAt),
    r.studentName ?? r.studentId,
    r.courseName ?? '',
    t(`attendanceStatus.${r.status}`),
    r.justificationText ?? '',
  ])
  const csv = [header, ...lines]
    .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `asistencia-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AttendanceHistoryPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [courseId, setCourseId] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const query: ListAttendanceQuery = {
    limit: 20,
    ...(cursor ? { cursor } : {}),
    ...(search ? { search } : {}),
    ...(courseId ? { courseId } : {}),
    ...(status ? { status: status as ListAttendanceQuery['status'] } : {}),
  }
  const list = useListAttendance(query)
  const courses = useListCourses({ limit: 100 })

  const rows: AttendanceRecord[] = list.data?.data ?? []

  const columns: DataTableColumn<AttendanceRecord>[] = [
    {
      header: t('attendance.history.columns.date'),
      accessor: (r) => formatDate(r.recordedAt),
    },
    {
      header: t('attendance.history.columns.student'),
      accessor: (r) => r.studentName ?? r.studentId.slice(0, 8),
    },
    {
      header: t('attendance.history.columns.course'),
      accessor: (r) => r.courseName ?? '—',
      hideOnMobile: true,
    },
    {
      header: t('attendance.history.columns.status'),
      accessor: (r) => (
        <Badge variant={attendanceStatusColor[r.status]}>{t(`attendanceStatus.${r.status}`)}</Badge>
      ),
    },
    {
      header: t('attendance.history.columns.observations'),
      accessor: (r) =>
        r.justificationText ? (
          <span className="line-clamp-1 text-xs italic">&ldquo;{r.justificationText}&rdquo;</span>
        ) : (
          '—'
        ),
      hideOnMobile: true,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('attendance.history.title')}
        actions={
          <Button variant="outline" onClick={() => exportCsv(rows, t)}>
            <Download className="mr-2 h-4 w-4" />
            {t('attendance.history.exportCsv')}
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
          title: t('attendance.history.empty.title'),
          description: t('attendance.history.empty.description'),
          action: undefined,
        }}
        toolbar={{
          search: {
            value: search,
            onChange: (v) => {
              setSearch(v)
              setCursor(undefined)
            },
            placeholder: 'Buscar...',
          },
          filters: (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={courseId ?? ''}
                onChange={(e) => {
                  setCourseId(e.target.value || undefined)
                  setCursor(undefined)
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">{t('attendance.history.filters.allCourses')}</option>
                {(courses.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={status ?? ''}
                onChange={(e) => {
                  setStatus(e.target.value || undefined)
                  setCursor(undefined)
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">{t('attendance.history.filters.allStatuses')}</option>
                {Object.values(AttendanceStatus).map((s) => (
                  <option key={s} value={s}>
                    {t(`attendanceStatus.${s}`)}
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
    </div>
  )
}
