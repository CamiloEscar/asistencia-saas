import reactConfig from '@asistencia/eslint-config/react'

/**
 * ESLint v9 flat config for apps/web (React SPA).
 * Extends the shared `@asistencia/eslint-config/react` preset.
 */
export default [
  ...reactConfig,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    // shadcn-style UI primitives co-locate `cva()` helpers with the component.
    // That pattern is intentional and Fast Refresh accepts the trade-off here.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Playwright E2E tests, scripts, and config. These files don't need
    // react-refresh rules but otherwise use the same TS rules.
    files: ['e2e/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // playwright.config.ts is hand-written at the app root.
    files: ['playwright.config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]
