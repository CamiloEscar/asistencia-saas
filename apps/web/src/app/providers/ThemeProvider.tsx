import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

/**
 * Theme provider. `attribute="class"` works with Tailwind's `darkMode: 'class'`
 * config. `defaultTheme="system"` respects the OS preference (per spec
 * REQ-X-007). The provider is a thin pass-through so feature code
 * doesn't have to import from `next-themes` directly.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  )
}
