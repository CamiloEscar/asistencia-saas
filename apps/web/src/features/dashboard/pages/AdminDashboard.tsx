import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, GraduationCap, School, UserPlus, UserCog, Upload, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/feedback/PageHeader'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'
import { Paths } from '@/app/routes/paths'
import { useInstitutionAdminKpis, useRecentActivity } from '../api/dashboard.api'

export function AdminDashboard() {
  const { t } = useTranslation()
  const kpis = useInstitutionAdminKpis()
  const activity = useRecentActivity(10)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.title')}
        description={`${t('dashboard.welcome', { name: '' })}`}
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label={t('dashboard.kpi.totalUsers')} value={kpis.data?.totalUsers} />
        <KpiCard label={t('dashboard.kpi.totalStudents')} value={kpis.data?.totalStudents} />
        <KpiCard label={t('dashboard.kpi.totalTeachers')} value={kpis.data?.totalTeachers} />
        <KpiCard label={t('dashboard.kpi.totalCourses')} value={kpis.data?.totalCourses} />
        <KpiCard label={t('dashboard.kpi.todaysAttendance')} value={kpis.data?.todaysAttendance} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="h-auto justify-start py-3">
              <Link to={Paths.studentNew}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t('dashboard.addStudent')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto justify-start py-3">
              <Link to={Paths.users}>
                <UserCog className="mr-2 h-4 w-4" />
                {t('dashboard.addTeacher')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto justify-start py-3">
              <Link to={Paths.courseNew}>
                <BookOpen className="mr-2 h-4 w-4" />
                {t('dashboard.createCourse')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto justify-start py-3">
              <Link to={Paths.studentsBulkImport}>
                <Upload className="mr-2 h-4 w-4" />
                {t('dashboard.importStudents')}
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{t('dashboard.recentActivity')}</CardTitle>
            <CardDescription>Últimos 10 eventos</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.isLoading && (
              <div className="flex justify-center py-6">
                <LoadingSpinner />
              </div>
            )}
            {activity.data && activity.data.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('dashboard.noActivity')}
              </p>
            )}
            {activity.data && activity.data.length > 0 && (
              <ul className="divide-y">
                {activity.data.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="font-medium">{entry.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString('es-AR')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: number | undefined
  icon?: React.ReactNode
}
function KpiCard({ label, value, icon }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">
          {value === undefined ? <LoadingSpinner size="sm" /> : value}
        </div>
      </CardContent>
    </Card>
  )
}

// Unused imports kept for future KPIs (re-enabled in Phase 14+).
void School
void Users
void GraduationCap
