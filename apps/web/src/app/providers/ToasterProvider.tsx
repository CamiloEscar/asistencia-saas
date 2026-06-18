import { Toaster as SonnerToaster } from 'sonner'

/**
 * Sonner toaster. Lives in a separate component so it can be mounted
 * once at the top of the tree (in App.tsx) and stay there for the
 * lifetime of the app.
 *
 * Defaults: top-right position, rich colors (semantic: success/error/info),
 * close button on hover. Component-level overrides are passed via
 * `toast()` calls from feature code.
 */
export function ToasterProvider() {
  return <SonnerToaster position="top-right" richColors closeButton duration={5000} />
}
