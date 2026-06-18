import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  /** Optional icon override (defaults to AlertCircle). */
  icon?: React.ReactNode
}

/**
 * Error placeholder. Use as the `error` branch of a TanStack Query
 * render-prop, or as a static "something went wrong" block.
 */
export function ErrorState({
  title = 'Algo salió mal',
  description = 'No pudimos cargar la información.',
  onRetry,
  retryLabel = 'Reintentar',
  icon,
}: ErrorStateProps) {
  return (
    <Alert variant="destructive" className="my-4">
      {icon ?? <AlertCircle className="h-4 w-4" />}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2 flex flex-col gap-3">
        <p>{description}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="self-start">
            {retryLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
