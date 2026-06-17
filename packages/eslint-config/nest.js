import base from './base.js';

/**
 * ESLint v9 flat config for the NestJS API.
 * Extends the base config with relaxations that fit NestJS decorators and DI patterns.
 */
export default [
  ...base,
  {
    rules: {
      // NestJS decorators + reflect-metadata make these noisy without value.
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
