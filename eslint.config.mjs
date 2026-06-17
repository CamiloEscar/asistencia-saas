import base from '@asistencia/eslint-config/base';

/**
 * Root ESLint v9 flat config.
 *
 * Used by `lint-staged` (which runs from the repo root). The per-package
 * `eslint.config.js`/`eslint.config.mjs` files take precedence when ESLint is
 * invoked from inside an individual package (e.g. `pnpm --filter @asistencia/api lint`).
 *
 * Scope: catches obvious TS/TSX issues across the monorepo without duplicating
 * the framework-specific rules — those are owned by each package's local config.
 */
export default [
  ...base,
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.config.{js,ts,mjs,cjs}',
      '**/.husky/**',
      '**/pnpm-lock.yaml',
    ],
  },
];
