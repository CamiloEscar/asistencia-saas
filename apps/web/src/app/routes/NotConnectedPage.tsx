import { Link } from 'react-router-dom'
import { WifiOff, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Offline / no connection page. Shown when the network is unavailable
 * or when API health checks fail repeatedly. Provides a retry button
 * and a link to the dashboard (in case the issue is on the server side).
 */
export function NotConnectedPage() {
  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen items-center justify-center bg-background p-4 focus:outline-none"
    >
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-orange-100 p-4 dark:bg-orange-950/30">
            <WifiOff
              className="h-12 w-12 text-orange-600 dark:text-orange-400"
              aria-hidden="true"
            />
          </div>
        </div>
        <h1 className="mb-2 text-4xl font-bold text-foreground">Sin conexión</h1>
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          No pudimos conectar con el servidor
        </h2>
        <p className="mb-8 text-muted-foreground">
          Verificá tu conexión a internet y volvé a intentar. Si el problema persiste, puede ser una
          caída temporal del servicio.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={handleRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              Ir al inicio
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
