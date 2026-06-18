import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Paths } from './paths'

/**
 * 403 page. Shown when an authenticated user hits a route they don't
 * have permission for. Provides a single "back to dashboard" action;
 * the dashboard is computed by role at the time of navigation.
 */
export function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">403</p>
      <h1 className="text-3xl font-semibold tracking-tight">Sin permisos</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        No tenés permisos para acceder a esta página. Si creés que es un error, contactá al
        administrador de tu institución.
      </p>
      <Button asChild>
        <Link to={Paths.dashboard}>Volver al panel</Link>
      </Button>
    </div>
  )
}
