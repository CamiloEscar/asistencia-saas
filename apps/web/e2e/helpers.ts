/**
 * Shared helpers for E2E tests. Most of the heavy lifting (DB seeding,
 * login flows) lives in fixtures. This file only re-exports things
 * the spec files need.
 */
import type { Page } from '@playwright/test'
export { test, expect } from '@playwright/test'
export { AxeBuilder } from '@axe-core/playwright'

/** Test tenant subdomain used by default across all specs. */
export const TEST_TENANT = 'celsius'
export const TEST_TENANT_B = 'universidad-b'

/** Test credentials — created by the seed script (prisma/seed.ts). */
export const TEST_USERS = {
  superAdmin: { email: 'super@asistencia-saas.com', password: 'super1234' },
  admin: { email: 'admin@celsius.com', password: 'admin1234' },
  adminB: { email: 'admin@universidad-b.com', password: 'admin1234' },
  teacher: { email: 'teacher1@celsius.com', password: 'teacher1234' },
  student: { email: 'student1@celsius.com', password: 'student1234' },
} as const

/**
 * Login helper. Sets the auth cookies in the browser context.
 * Assumes the user already exists in the test DB.
 */
export async function login(
  page: Page,
  user: { email: string; password: string },
  options: { tenant?: string; returnTo?: string } = {},
) {
  const tenant = options.tenant ?? TEST_TENANT
  const params = new URLSearchParams()
  if (options.returnTo) params.set('returnTo', options.returnTo)
  const qs = params.toString()
  // Point the page to the tenant subdomain for the login flow.
  const url = `http://${tenant}.app.localhost:5173/login${qs ? `?${qs}` : ''}`
  await page.goto(url)
  await page.getByLabel(/email/i).fill(user.email)
  await page.getByLabel(/contraseña/i).fill(user.password)
  await page.getByRole('button', { name: /ingresar/i }).click()
  // Wait for navigation to the dashboard
  await page.waitForURL(/\/dashboard|\/admin|\/today|\/me/, { timeout: 10_000 })
}
