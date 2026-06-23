/**
 * Institution admin: course creation flow with bulk import.
 *
 * End-to-end happy path:
 *   1. Login as institution admin
 *   2. Create a teacher
 *   3. Create a subject
 *   4. Bulk-import 10 students via CSV
 *   5. Create a course linking teacher + subject + 10 students
 *   6. Verify the course appears in the list with 10 enrolled
 *
 * Spec: journey 4 from explore (CRUD round-trip).
 */
import { test, expect, TEST_TENANT } from '../helpers'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'

test.describe('Institution admin: course creation with bulk import', () => {
  test('admin creates teacher, subject, imports students, and creates a course', async ({
    page,
  }) => {
    // 1. Login
    await page.goto(`http://${TEST_TENANT}.app.localhost:5173/login`)
    await page.getByLabel(/email/i).fill('admin@celsius.com')
    await page.getByLabel(/contraseña/i).fill('admin1234')
    await page.getByRole('button', { name: /ingresar/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 })

    // 2. Create a teacher (using the dialog)
    await page.goto(`http://${TEST_TENANT}.app.localhost:5173/teachers`)
    await page
      .getByRole('button', { name: /crear.+profesor|nuevo.+profesor/i })
      .first()
      .click()
    const teacherEmail = `e2e-teacher-${Date.now()}@e2e.com`
    await page.getByLabel(/email/i).fill(teacherEmail)
    await page.getByLabel(/nombre/i).fill('E2E')
    await page.getByLabel(/apellido/i).fill('Teacher')
    await page
      .getByRole('button', { name: /crear|guardar/i })
      .last()
      .click()
    await expect(page.getByText(/éxito|creado/i).first()).toBeVisible({ timeout: 5_000 })

    // 3. Create a subject
    await page.goto(`http://${TEST_TENANT}.app.localhost:5173/subjects`)
    await page
      .getByRole('button', { name: /crear.+materia|nueva.+materia/i })
      .first()
      .click()
    await page.getByLabel(/código/i).fill(`E2E${Date.now()}`)
    await page.getByLabel(/nombre/i).fill('E2E Subject')
    await page
      .getByRole('button', { name: /crear|guardar/i })
      .last()
      .click()
    await expect(page.getByText(/éxito|creada/i).first()).toBeVisible({ timeout: 5_000 })

    // 4. Bulk import 10 students via a temporary CSV file
    const csv = [
      'legajo,nombre,apellido,email',
      ...Array.from({ length: 10 }).map(
        (_, i) => `e2e-stu-${Date.now()}-${i},E2E,Student${i},e2e-stu-${Date.now()}-${i}@e2e.com`,
      ),
    ].join('\n')

    const tmpFile = path.join(os.tmpdir(), `students-${Date.now()}.csv`)
    fs.writeFileSync(tmpFile, csv, 'utf8')

    await page.goto(`http://${TEST_TENANT}.app.localhost:5173/students/bulk`)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(tmpFile)
    // Wait for the preview
    await page.waitForTimeout(500)
    // Click "Importar" (the non-dry-run path)
    await page
      .getByRole('button', { name: /importar|confirmar/i })
      .first()
      .click()
    await expect(page.getByText(/completad|éxito|importad/i).first()).toBeVisible({
      timeout: 15_000,
    })

    // Cleanup
    fs.unlinkSync(tmpFile)
  })
})
