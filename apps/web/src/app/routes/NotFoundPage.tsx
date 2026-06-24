import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Paths } from './paths'

/**
 * 404 page. Shown when a route does not match any of the registered
 * patterns. Lives outside the AppShell (no sidebar) because the user
 * could be in any state — authenticated or not.
 */
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Página no encontrada</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        La ruta que buscás no existe o fue movida. Verificá la URL o volvé al inicio.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link to={Paths.login}>Iniciar sesión</Link>
        </Button>
        <Button asChild>
          <Link to={Paths.dashboard}>Ir al panel</Link>
        </Button>
      </div>
    </div>
  )
}
