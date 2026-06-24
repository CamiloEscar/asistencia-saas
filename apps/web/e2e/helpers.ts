/**
 * Shared helpers for E2E tests. Most of the heavy lifting (DB seeding,
 * login flows) lives in fixtures. This file only re-exports things
 * the spec files need.
 */
import type { Page } from '@playwright/test'
export { test, expect } from '@playwright/test'
export { AxeBuilder } from '@axe-core/playwright'

/** Test credentials — created by the seed script (prisma/seed.ts). */
export const TEST_USERS = {
  admin: { email: 'admin@asistencia.local', password: 'admin1234' },
  teacher: { email: 'teacher1@asistencia.local', password: 'teacher1234' },
  student: { email: 'student1@asistencia.local', password: 'student1234' },
} as const

/**
 * Login helper. Sets the auth cookies in the browser context.
 * Assumes the user already exists in the test DB.
 */
export async function login(
  page: Page,
  user: { email: string; password: string },
  options: { returnTo?: string } = {},
) {
  const params = new URLSearchParams()
  if (options.returnTo) params.set('returnTo', options.returnTo)
  const qs = params.toString()
  const url = `http://localhost:5173/login${qs ? `?${qs}` : ''}`
  await page.goto(url)
  await page.getByLabel(/email/i).fill(user.email)
  await page.getByLabel(/contraseña/i).fill(user.password)
  await page.getByRole('button', { name: /ingresar/i }).click()
  // Wait for navigation to the dashboard
  await page.waitForURL(/\/dashboard|\/today|\/me/, { timeout: 10_000 })
}
