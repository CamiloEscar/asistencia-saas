import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Menu,
  X,
  BarChart3,
  BookOpen,
  Building2,
  GraduationCap,
  Home,
  School,
  UserCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UserRole } from '@asistencia/shared'
import { Paths } from '@/app/routes/paths'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SidebarItem {
  to: string
  labelKey: string
  icon: LucideIcon
  roles: ReadonlyArray<UserRole>
}

const ITEMS: ReadonlyArray<SidebarItem> = [
  { to: Paths.admin, labelKey: 'nav.institutions', icon: Building2, roles: ['SUPER_ADMIN'] },
  { to: Paths.dashboard, labelKey: 'nav.dashboard', icon: Home, roles: ['INSTITUTION_ADMIN'] },
  { to: Paths.today, labelKey: 'nav.attendance', icon: BarChart3, roles: ['TEACHER'] },
  { to: Paths.me, labelKey: 'nav.dashboard', icon: Home, roles: ['STUDENT'] },
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
  const [open, setOpen] = useState(false)

  // Close drawer on route change (so navigating from the drawer doesn't leave it open)
  useEffect(() => {
    return () => setOpen(false)
  }, [])

  return (
    <>
      {/* Mobile drawer trigger (≥44px touch target) */}
      <div className="fixed left-2 top-2 z-40 md:hidden">
        <Button
          variant="outline"
          size="icon"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-controls="sidebar-drawer"
          onClick={() => setOpen(!open)}
          className="h-11 w-11" /* 44x44px touch target */
        >
          {open ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — drawer on mobile, fixed on desktop */}
      <aside
        id="sidebar-drawer"
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform duration-200',
          'md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        aria-label="Navegación principal"
      >
        <nav className="flex h-full flex-col gap-1 p-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                aria-label={t(item.labelKey)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden={true} />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
