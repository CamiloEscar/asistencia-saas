import { Link, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

/**
 * 500 Server Error page. Friendly Spanish copy with a retry button and
 * a link back to the dashboard. Rendered when an unhandled error bubbles
 * up to the router, or when the API returns 500.
 */
export function ServerErrorPage() {
  const error = useRouteError()
  // Log to the browser console for debugging; never expose stack traces
  // to the end user in production.
  if (error) console.error('[ServerErrorPage] Caught error:', error)

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
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-12 w-12 text-destructive" aria-hidden="true" />
          </div>
        </div>
        <h1 className="mb-2 text-4xl font-bold text-foreground">500</h1>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Error interno del servidor</h2>
        <p className="mb-8 text-muted-foreground">
          Algo salió mal de nuestro lado. Nuestro equipo ha sido notificado. Por favor, intentá
          nuevamente en unos minutos.
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
