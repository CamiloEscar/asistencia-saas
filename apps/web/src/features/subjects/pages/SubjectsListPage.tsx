import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Plus } from 'lucide-react'
import type { ListSubjectsQuery, Subject } from '@asistencia/shared'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/feedback/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { useListSubjects } from '../api/subjects.api'
import { CreateSubjectDialog, EditSubjectDialog } from '../components/CreateSubjectDialog'

export function SubjectsListPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const query: ListSubjectsQuery = {
    limit: 50,
    ...(cursor ? { cursor } : {}),
    ...(search ? { search } : {}),
  }
  const list = useListSubjects(query)
  const rows: Subject[] = list.data?.data ?? []

  const columns: DataTableColumn<Subject>[] = [
    { header: t('subjects.list.columns.code'), accessor: 'code' },
    { header: t('subjects.list.columns.name'), accessor: 'name' },
    {
      header: t('subjects.list.columns.description'),
      accessor: (r) => r.description ?? '—',
      hideOnMobile: true,
    },
    {
      header: t('subjects.list.columns.actions'),
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
        title={t('subjects.list.title')}
        description={t('subjects.list.subtitle')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('subjects.list.create')}
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
          title: t('subjects.list.empty.title'),
          description: t('subjects.list.empty.description'),
        }}
        toolbar={{
          search: {
            value: search,
            onChange: (v) => {
              setSearch(v)
              setCursor(undefined)
            },
            placeholder: t('subjects.list.searchPlaceholder'),
          },
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

      <CreateSubjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditSubjectDialog
        subjectId={editId}
        open={!!editId}
        onOpenChange={(o) => !o && setEditId(null)}
      />
    </div>
  )
}
