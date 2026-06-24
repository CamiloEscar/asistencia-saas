import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Plus, RotateCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/feedback/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useToast } from '@/hooks/use-toast'
import { type ListUsersQuery, type User } from '@asistencia/shared'
import {
  useDeactivateUser,
  useListUsers,
  useReactivateUser,
  useResetPassword,
} from '../api/users.api'
import { CreateUserDialog } from '../components/CreateUserDialog'
import { EditUserDialog } from '../components/EditUserDialog'

export function UsersListPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<string | undefined>(undefined)
  const [activeOnly, setActiveOnly] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const query: ListUsersQuery = {
    limit: 20,
    ...(cursor ? { cursor } : {}),
    ...(search ? { search } : {}),
    ...(role ? { role: role as ListUsersQuery['role'] } : {}),
    ...(activeOnly ? { isActive: true } : {}),
  }
  const list = useListUsers(query)
  const deactivate = useDeactivateUser()
  const reactivate = useReactivateUser()
  const resetPassword = useResetPassword()

  const rows: User[] = list.data?.data ?? []

  const columns: DataTableColumn<User>[] = [
    {
      header: t('users.list.columns.firstName'),
      accessor: (r) => r.fullName.split(' ').slice(0, -1).join(' ') || r.fullName,
    },
    {
      header: t('users.list.columns.lastName'),
      accessor: (r) => r.fullName.split(' ').slice(-1)[0] || '',
    },
    { header: t('users.list.columns.email'), accessor: 'email' },
    {
      header: t('users.list.columns.role'),
      accessor: (r) => <Badge variant="secondary">{t(`roles.${r.role}`)}</Badge>,
    },
    {
      header: t('users.list.columns.isActive'),
      accessor: (r) => (
        <Badge variant={r.status === 'ACTIVE' ? 'success' : 'destructive'}>
          {r.status === 'ACTIVE' ? t('users.status.ACTIVE') : t('users.status.INACTIVE')}
        </Badge>
      ),
    },
    {
      header: t('users.list.columns.actions'),
      className: 'text-right',
      accessor: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('common.actions')}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setEditId(r.id)}>
              {t('users.actions.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                try {
                  const result = await resetPassword.mutateAsync(r.id)
                  toast.success(
                    t('users.actions.resetPasswordSuccess', {
                      password: result.temporaryPassword,
                    }),
                  )
                } catch (err) {
                  toast.errorFromApi(err, 'errors:generic')
                }
              }}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              {t('users.actions.resetPassword')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {r.status === 'ACTIVE' ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmId(r.id)}
              >
                {t('users.actions.deactivate')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={async () => {
                  try {
                    await reactivate.mutateAsync(r.id)
                    toast.success('Usuario reactivado')
                  } catch (err) {
                    toast.errorFromApi(err, 'errors:generic')
                  }
                }}
              >
                {t('users.actions.reactivate')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('users.list.title')}
        description={t('users.list.subtitle')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('users.list.create')}
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
          title: t('users.list.empty.title'),
          description: t('users.list.empty.description'),
        }}
        toolbar={{
          search: {
            value: search,
            onChange: (v) => {
              setSearch(v)
              setCursor(undefined)
            },
            placeholder: t('users.list.searchPlaceholder'),
          },
          filters: (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                {t('users.list.filters.role')}
              </label>
              <select
                value={role ?? ''}
                onChange={(e) => {
                  setRole(e.target.value || undefined)
                  setCursor(undefined)
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">{t('users.list.filters.all')}</option>
                <option value="ADMIN">{t('roles.ADMIN')}</option>
                <option value="TEACHER">{t('roles.TEACHER')}</option>
                <option value="STUDENT">{t('roles.STUDENT')}</option>
              </select>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => {
                    setActiveOnly(e.target.checked)
                    setCursor(undefined)
                  }}
                />
                {t('users.list.filters.active')}
              </label>
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

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditUserDialog userId={editId} open={!!editId} onOpenChange={(o) => !o && setEditId(null)} />

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="¿Desactivar usuario?"
        description="El usuario no podrá iniciar sesión. Podés reactivarlo después."
        confirmLabel={t('users.actions.deactivate')}
        variant="destructive"
        isLoading={deactivate.isPending}
        onConfirm={async () => {
          if (!confirmId) return
          try {
            await deactivate.mutateAsync(confirmId)
            toast.success('Usuario desactivado')
            setConfirmId(null)
          } catch (err) {
            toast.errorFromApi(err, 'errors:generic')
          }
        }}
      />
    </div>
  )
}
