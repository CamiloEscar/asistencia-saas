/**
 * Super admin creates an institution.
 *
 * Critical path: the FIRST user of the platform is a super admin who
 * provisions institutions. They fill the form, the API creates the
 * institution + initial admin user, and the response includes a
 * one-time set-password link that must be copyable.
 *
 * Spec: SC-4 (provision institution in < 5 min)
 */
import { test, expect } from './helpers'

test.describe('Super admin: create institution', () => {
  test('super admin can create a new institution with initial admin', async ({ page }) => {
    // 1. Login as super admin (uses the root domain, no subdomain)
    await page.goto('http://app.localhost:5173/login')
    await page.getByLabel(/email/i).fill('super@asistencia-saas.com')
    await page.getByLabel(/contraseña/i).fill('super1234')
    await page.getByRole('button', { name: /ingresar/i }).click()

    // Super admin lands on /admin
    await page.waitForURL(/\/admin/, { timeout: 10_000 })

    // 2. Navigate to institutions list
    await page
      .getByRole('link', { name: /instituciones/i })
      .first()
      .click()
    await page.waitForURL(/\/institutions/, { timeout: 5_000 })

    // 3. Click "Crear institución"
    await page.getByRole('button', { name: /crear.+institución/i }).click()

    // 4. Fill the dialog form
    const timestamp = Date.now()
    const subdomain = `e2e-${timestamp}`

    await page
      .getByLabel(/nombre/i)
      .first()
      .fill(`E2E Test Institution ${timestamp}`)
    await page.getByLabel(/subdominio/i).fill(subdomain)
    await page.getByLabel(/email.+admin|admin.+email/i).fill(`admin-${timestamp}@e2e.com`)
    await page.getByLabel(/nombre.+admin|admin.+nombre/i).fill('Admin')
    await page.getByLabel(/apellido.+admin|admin.+apellido/i).fill('E2E')

    // 5. Submit
    await page
      .getByRole('button', { name: /crear|guardar/i })
      .last()
      .click()

    // 6. Expect success: a copyable link or success message
    await expect(
      page.getByText(/éxito|creada|activación|set.password|copiar/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})
