import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, CheckCircle2, PlusCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/feedback/PageHeader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'
import { Paths } from '@/app/routes/paths'
import { useRecentInstitutions, useSuperAdminStats } from '../api/institutions.api'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function SuperAdminDashboard() {
  const { t } = useTranslation()
  const stats = useSuperAdminStats()
  const recent = useRecentInstitutions(5)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('superAdmin.title')}
        description={t('superAdmin.subtitle')}
        actions={
          <Button asChild>
            <Link to={Paths.institutionNew}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('dashboard.createInstitution')}
            </Link>
          </Button>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('dashboard.kpi.totalInstitutions')}
          value={stats.data?.total ?? '—'}
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
          loading={stats.isLoading}
        />
        <KpiCard
          label={t('dashboard.kpi.activeInstitutions')}
          value={stats.data?.active ?? '—'}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          loading={stats.isLoading}
        />
        <KpiCard
          label={t('dashboard.kpi.inactiveInstitutions')}
          value={stats.data?.inactive ?? '—'}
          icon={<XCircle className="h-4 w-4 text-destructive" />}
          loading={stats.isLoading}
        />
        <KpiCard
          label={t('dashboard.kpi.totalUsers')}
          value="—"
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
          loading={true /* until /super/users/stats ships */}
        />
      </div>

      {/* Recent institutions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">{t('dashboard.recentInstitutions')}</CardTitle>
            <CardDescription>Últimos 5</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to={Paths.institutions}>{t('dashboard.viewAll')}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.isLoading && (
            <div className="flex justify-center py-6">
              <LoadingSpinner />
            </div>
          )}
          {recent.isError && <ErrorState onRetry={() => recent.refetch()} />}
          {recent.data && recent.data.data.length === 0 && (
            <EmptyState
              title={t('common.noData')}
              description="Aún no hay instituciones creadas."
              action={{
                label: t('dashboard.createInstitution'),
                onClick: () => window.location.assign(Paths.institutionNew),
              }}
            />
          )}
          {recent.data && recent.data.data.length > 0 && (
            <ul className="divide-y">
              {recent.data.data.map((inst) => (
                <li key={inst.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{inst.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inst.subdomain} · {inst.plan} · {formatDate(String(inst.createdAt))}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={Paths.institutionDetail(inst.id)}>Ver</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  loading?: boolean
}
function KpiCard({ label, value, icon, loading }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSpinner size="sm" />
        ) : (
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}
