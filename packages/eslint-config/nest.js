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
      // Constructor parameter types MUST be value imports for `emitDecoratorMetadata`
      // to record them in `design:paramtypes` (Nest DI reads this metadata).
      // `import type` strips the value and breaks DI resolution.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
