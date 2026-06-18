import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  BookOpen,
  Building2,
  GraduationCap,
  Home,
  School,
  UserCog,
  Users,
} from 'lucide-react'
import type { UserRole } from '@asistencia/shared'
import { Paths } from '@/app/routes/paths'
import { cn } from '@/lib/utils'

interface SidebarItem {
  to: string
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
  roles: ReadonlyArray<UserRole>
}

const ITEMS: ReadonlyArray<SidebarItem> = [
  {
    to: Paths.admin,
    labelKey: 'nav.institutions',
    icon: Building2,
    roles: ['SUPER_ADMIN'],
  },
  {
    to: Paths.dashboard,
    labelKey: 'nav.dashboard',
    icon: Home,
    roles: ['INSTITUTION_ADMIN'],
  },
  {
    to: Paths.today,
    labelKey: 'nav.attendance',
    icon: BarChart3,
    roles: ['TEACHER'],
  },
  {
    to: Paths.me,
    labelKey: 'nav.dashboard',
    icon: Home,
    roles: ['STUDENT'],
  },
  { to: Paths.users, labelKey: 'nav.users', icon: UserCog, roles: ['INSTITUTION_ADMIN'] },
  {
    to: Paths.courses,
    labelKey: 'nav.courses',
    icon: BookOpen,
    roles: ['INSTITUTION_ADMIN', 'TEACHER'],
  },
  {
    to: Paths.students,
    labelKey: 'nav.students',
    icon: GraduationCap,
    roles: ['INSTITUTION_ADMIN', 'TEACHER'],
  },
  { to: Paths.teachers, labelKey: 'nav.teachers', icon: Users, roles: ['INSTITUTION_ADMIN'] },
  { to: Paths.subjects, labelKey: 'nav.subjects', icon: School, roles: ['INSTITUTION_ADMIN'] },
]

interface SidebarProps {
  role: UserRole
}

export function Sidebar({ role }: SidebarProps) {
  const { t } = useTranslation()
  const items = ITEMS.filter((item) => item.roles.includes(role))

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card md:block">
      <nav className="flex h-full flex-col gap-1 p-3" aria-label="Navegación principal">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={t(item.labelKey)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
