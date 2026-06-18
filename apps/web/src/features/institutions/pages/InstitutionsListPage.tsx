import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Plus } from 'lucide-react'
import type { Institution } from '@asistencia/shared'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/feedback/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { Paths } from '@/app/routes/paths'
import { useListInstitutions } from '../api/institutions.api'
import { CreateInstitutionDialog } from '../components/CreateInstitutionDialog'

function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function InstitutionsListPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)

  const query = {
    limit: 20,
    ...(cursor ? { cursor } : {}),
    ...(search ? { search } : {}),
    ...(activeOnly ? { status: 'ACTIVE' as const } : {}),
  }

  const { data, isLoading, isError, refetch, isFetching } = useListInstitutions(query)

  const rows: Institution[] = data?.data ?? []

  const columns: DataTableColumn<Institution>[] = [
    { header: t('institutions.list.columns.name'), accessor: 'name' },
    { header: t('institutions.list.columns.subdomain'), accessor: 'subdomain' },
    {
      header: t('institutions.list.columns.email'),
      accessor: (r) => (r.subdomain ? `${r.subdomain}@app.com` : '—'),
      hideOnMobile: true,
    },
    {
      header: t('institutions.list.columns.status'),
      accessor: (r) => (
        <Badge variant={r.status === 'ACTIVE' ? 'success' : 'destructive'}>
          {r.status === 'ACTIVE' ? t('institutionStatus.ACTIVE') : t('institutionStatus.INACTIVE')}
        </Badge>
      ),
    },
    {
      header: t('institutions.list.columns.plan'),
      accessor: (r) => <Badge variant="outline">{r.plan}</Badge>,
      hideOnMobile: true,
    },
    {
      header: t('institutions.list.columns.createdAt'),
      accessor: (r) => formatDate(r.createdAt),
      hideOnMobile: true,
    },
    {
      header: t('institutions.list.columns.actions'),
      className: 'text-right',
      accessor: (r) => (
        <Button asChild size="sm" variant="ghost">
          <Link to={Paths.institutionDetail(r.id)}>
            <Eye className="mr-1 h-4 w-4" />
            Ver
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('institutions.list.title')}
        description={t('institutions.list.subtitle')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('institutions.list.create')}
          </Button>
        }
      />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        emptyState={{
          title: t('institutions.list.empty.title'),
          description: t('institutions.list.empty.description'),
        }}
        toolbar={{
          search: {
            value: search,
            onChange: (v) => {
              setSearch(v)
              setCursor(undefined)
            },
            placeholder: t('institutions.list.searchPlaceholder'),
          },
          filters: (
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={activeOnly}
                onCheckedChange={(v) => {
                  setActiveOnly(v)
                  setCursor(undefined)
                }}
              />
              {t('institutions.list.filters.active')}
            </label>
          ),
        }}
        pagination={
          data?.hasMore
            ? {
                hasMore: true,
                isFetchingMore: isFetching,
                onLoadMore: () => data?.nextCursor && setCursor(data.nextCursor),
              }
            : undefined
        }
      />

      <CreateInstitutionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
