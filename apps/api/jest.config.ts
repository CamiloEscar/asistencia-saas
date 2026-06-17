import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';

const tsconfig = JSON.parse(
  readFileSync(join(__dirname, 'tsconfig.json'), 'utf-8'),
) as { compilerOptions: { paths: Record<string, string[]>; baseUrl?: string } };

const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
  setupFiles: ['<rootDir>/test/setup.ts'],
  setupFilesAfterEach: [],
  testTimeout: 60_000, // testcontainers cold start
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  // Coverage thresholds enforced in CI:
  //   70% on application/, 60% on infrastructure/
  // We don't gate globally here so the bootstrap can land before the
  // application code exists.
  clearMocks: true,
  restoreMocks: true,
  // Avoid spinning up real Postgres/Redis for the smoke test only.
  // Per-suite testcontainers setup lives in test/setup-testcontainers.ts.
};

export default config;
