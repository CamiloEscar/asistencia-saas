import base from '@asistencia/eslint-config/base';

/**
 * ESLint v9 flat config for @asistencia/shared.
 * Uses the base config (no framework-specific overrides).
 */
export default [
  ...base,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
