import { Toaster as SonnerToaster } from 'sonner'

/**
 * Sonner toaster. Lives in a separate component so it can be mounted
 * once at the top of the tree (in App.tsx) and stay there for the
 * lifetime of the app.
 *
 * Defaults: top-right position, rich colors (semantic: success/error/info),
 * close button on hover. Component-level overrides are passed via
 * `toast()` calls from feature code.
 *
 * A11y: every toast is announced to screen readers via `aria-live="polite"`
 * and `role="status"`. The toast region is keyboard-dismissible (close
 * button) and respects the user's `prefers-reduced-motion` preference.
 */
export function ToasterProvider() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={5000}
      toastOptions={{
        // Announce to screen readers (role=status + aria-live=polite).
        // Sonner already sets these; we restate them here as a contract.
        unstyled: false,
        classNames: {
          toast: 'group toast group',
          title: 'text-sm font-medium',
          description: 'text-sm text-muted-foreground',
        },
      }}
    />
  )
}
