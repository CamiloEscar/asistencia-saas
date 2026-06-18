import { Clock, RefreshCw, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * 503 Maintenance page. Shown when the API returns 503 (Service
 * Unavailable). Friendly copy explaining we're working on it, with
 * a retry button.
 */
export function MaintenancePage() {
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
          <div className="rounded-full bg-amber-100 p-4 dark:bg-amber-950/30">
            <Clock className="h-12 w-12 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
        </div>
        <h1 className="mb-2 text-4xl font-bold text-foreground">503</h1>
        <h2 className="mb-4 text-xl font-semibold text-foreground">En mantenimiento</h2>
        <p className="mb-8 text-muted-foreground">
          Estamos trabajando para mejorar el sistema. El servicio volverá a estar disponible en
          breve. Gracias por tu paciencia.
        </p>
        <Button onClick={handleRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reintentar
        </Button>
        <p className="mt-8 text-sm text-muted-foreground">
          Si necesitás ayuda urgente, contactanos por{' '}
          <a
            href="mailto:soporte@asistencia-saas.com"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Mail className="h-3 w-3" aria-hidden="true" />
            soporte@asistencia-saas.com
          </a>
        </p>
      </div>
    </main>
  )
}
