# Playwright E2E

End-to-end tests for the asistencia-saas frontend. Uses [Playwright](https://playwright.dev/).

## Run locally

1. Start the dev stack (Postgres, Redis, API, web):

   ```bash
   pnpm dev
   ```

   Or with docker-compose:

   ```bash
   docker compose -f infra/docker/docker-compose.yml up -d
   pnpm --filter @asistencia/api dev
   pnpm --filter @asistencia/web dev
   ```

2. Seed the test database:

   ```bash
   pnpm --filter @asistencia/api exec prisma db seed
   ```

3. Run the suite:

   ```bash
   pnpm --filter @asistencia/web test:e2e
   ```

   Headed mode (debug):

   ```bash
   pnpm --filter @asistencia/web test:e2e -- --headed
   ```

   UI mode:

   ```bash
   pnpm --filter @asistencia/web test:e2e:ui
   ```

## Suite structure

- `auth/login.spec.ts` — login, set-password, forgot-password
- `admin/manage-courses.spec.ts` — admin creates teacher + subject + students + course
- `attendance/teacher-take-attendance.spec.ts` — critical path: teacher takes attendance
- `attendance/student-views-attendance.spec.ts` — student views their history
- `a11y.spec.ts` — axe-core automated accessibility checks

## Conventions

- Use `data-testid` attributes for stable selectors. Avoid text content.
- Use proper waits (`waitFor`, `waitForURL`, `toBeVisible`) — never `waitForTimeout`.
- Each test is independent: re-seeds via fixtures, no shared state.
- Tests run against Chromium by default. Firefox and WebKit are opt-in.

## Reports

After a run, the HTML report is at `apps/web/playwright-report/`. Open it with:

```bash
pnpm --filter @asistencia/web exec playwright show-report
```
