import { Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/use-auth'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/**
 * Authenticated app shell. Layout: sidebar (left) + topbar (top) + main
 * (center). The sidebar collapses below the `md` breakpoint. The
 * topbar is sticky and shows the institution name + user menu + theme
 * toggle.
 *
 * Components inside the shell get a max-width container and vertical
 * padding via the inner `<main>` class.
 */
export function AppShell() {
  const { user } = useAuth()
  if (!user) return <LoadingScreen />
  return (
    <div className="flex min-h-screen w-full bg-muted/20">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
