import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config for @asistencia/web.
 *
 * Strategy:
 *  - The API and web app are expected to be running on localhost before
 *    the tests start. For local dev, run `pnpm dev` (root). For CI,
 *    the GitHub Actions workflow starts the full stack via docker-compose.
 *  - We use a dedicated test database (`asistencia_test`) and Redis DB
 *    so we never touch dev data.
 *  - tests live in apps/web/e2e/ (any .spec.ts file)
 *  - Fixtures in apps/web/e2e/fixtures/
 *  - We test against Chromium by default; Firefox and WebKit are opt-in
 *    to keep the suite fast.
 *
 * Run locally:
 *   pnpm --filter @asistencia/web test:e2e
 *   pnpm --filter @asistencia/web test:e2e -- --headed
 *   pnpm --filter @asistencia/web test:e2e -- --ui
 */
export default defineConfig({
  testDir: './e2e',
  // Tests match `*.spec.ts` only — keeps fixtures/helpers out of the runner.
  testMatch: /.*\.spec\.ts$/,
  // 30s per test is plenty for happy paths; we use explicit waits, not timeouts.
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // Fail fast in CI, surface flaky tests locally.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Use a stable tenant subdomain for tests. In CI, the e2e setup
    // creates this tenant + admin user via the API seed.
    extraHTTPHeaders: {
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // `webServer` is opt-in. CI runs the full stack externally and
  // sets E2E_BASE_URL; locally, run `pnpm dev` before `pnpm test:e2e`.
  // Uncomment for fully self-contained local runs:
  // webServer: {
  //   command: 'pnpm dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
})
