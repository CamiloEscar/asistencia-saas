import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Plus } from 'lucide-react'
import type { ListTeachersQuery, Teacher } from '@asistencia/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/feedback/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { useListTeachers } from '../api/teachers.api'
import { CreateTeacherDialog } from '../components/CreateTeacherDialog'

export function TeachersListPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)

  const query: ListTeachersQuery = {
    limit: 20,
    ...(cursor ? { cursor } : {}),
    ...(search ? { search } : {}),
    ...(activeOnly ? { isActive: true } : {}),
  }
  const list = useListTeachers(query)
  const rows: Teacher[] = list.data?.data ?? []

  const columns: DataTableColumn<Teacher>[] = [
    {
      header: t('teachers.list.columns.firstName'),
      accessor: (r) => r.fullName.split(' ').slice(0, -1).join(' ') || r.fullName,
    },
    {
      header: t('teachers.list.columns.lastName'),
      accessor: (r) => r.fullName.split(' ').slice(-1)[0] || '',
    },
    { header: t('teachers.list.columns.email'), accessor: 'email' },
    { header: t('teachers.list.columns.courses'), accessor: (r) => r.courseCount ?? 0 },
    {
      header: t('teachers.list.columns.isActive'),
      accessor: (r) => (
        <Badge variant={r.isActive ? 'success' : 'destructive'}>
          {r.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      header: t('teachers.list.columns.actions'),
      className: 'text-right',
      accessor: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('common.actions')}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => window.alert(`Ver detalle de ${r.fullName}`)}>
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
        title={t('teachers.list.title')}
        description={t('teachers.list.subtitle')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('teachers.list.create')}
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
          title: t('teachers.list.empty.title'),
          description: t('teachers.list.empty.description'),
        }}
        toolbar={{
          search: {
            value: search,
            onChange: (v) => {
              setSearch(v)
              setCursor(undefined)
            },
            placeholder: t('teachers.list.searchPlaceholder'),
          },
          filters: (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => {
                  setActiveOnly(e.target.checked)
                  setCursor(undefined)
                }}
              />
              {t('students.list.filters.active')}
            </label>
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

      <CreateTeacherDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
