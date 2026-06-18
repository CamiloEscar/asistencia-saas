import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp, MoreHorizontal, Plus } from 'lucide-react'
import type { ListStudentsQuery, User } from '@asistencia/shared'
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
import { useListStudents } from '../api/students.api'
import { BulkImportDialog } from '../components/BulkImportDialog'
import { CreateStudentDialog, EditStudentDialog } from '../components/CreateStudentDialog'

export function StudentsListPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const query: ListStudentsQuery = {
    limit: 20,
    ...(cursor ? { cursor } : {}),
    ...(search ? { search } : {}),
    ...(activeOnly ? { isActive: true } : {}),
  }
  const list = useListStudents(query)
  const rows: User[] = list.data?.data ?? []

  const columns: DataTableColumn<User>[] = [
    { header: t('students.list.columns.legajo'), accessor: (r) => r.legajo ?? '—' },
    {
      header: t('students.list.columns.firstName'),
      accessor: (r) => r.fullName.split(' ').slice(0, -1).join(' ') || r.fullName,
    },
    {
      header: t('students.list.columns.lastName'),
      accessor: (r) => r.fullName.split(' ').slice(-1)[0] || '',
    },
    { header: t('students.list.columns.email'), accessor: 'email', hideOnMobile: true },
    {
      header: t('students.list.columns.career'),
      accessor: (r) => r.career ?? '—',
      hideOnMobile: true,
    },
    {
      header: t('students.list.columns.isActive'),
      accessor: (r) => (
        <Badge variant={r.status === 'ACTIVE' ? 'success' : 'destructive'}>
          {r.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      header: t('students.list.columns.actions'),
      className: 'text-right',
      accessor: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('common.actions')}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditId(r.id)}>{t('common.edit')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('students.list.title')}
        description={t('students.list.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <FileUp className="mr-2 h-4 w-4" />
              {t('students.list.bulkImport')}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('students.list.create')}
            </Button>
          </>
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
          title: t('students.list.empty.title'),
          description: t('students.list.empty.description'),
        }}
        toolbar={{
          search: {
            value: search,
            onChange: (v) => {
              setSearch(v)
              setCursor(undefined)
            },
            placeholder: t('students.list.searchPlaceholder'),
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

      <CreateStudentDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditStudentDialog
        studentId={editId}
        open={!!editId}
        onOpenChange={(o) => !o && setEditId(null)}
      />
      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  )
}
