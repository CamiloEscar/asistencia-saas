import reactConfig from '@asistencia/eslint-config/react';

/**
 * ESLint v9 flat config for apps/web (React SPA).
 * Extends the shared `@asistencia/eslint-config/react` preset.
 */
export default [
  ...reactConfig,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    // shadcn-style UI primitives co-locate `cva()` helpers with the component.
    // That pattern is intentional and Fast Refresh accepts the trade-off here.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
];
