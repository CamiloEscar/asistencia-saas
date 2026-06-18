/**
 * Accessibility (a11y) E2E tests via @axe-core/playwright.
 *
 * Runs an automated accessibility audit on the main authenticated
 * pages. Fails the test if any serious/critical violation is found.
 *
 * Spec: REQ-X-008 (responsive + accessible), 17.3 (a11y pass)
 */
import { test, expect, AxeBuilder, TEST_TENANT } from './helpers'

const PAGES_TO_AUDIT = [
  { name: 'login', path: '/login' },
  { name: 'dashboard-admin', path: '/dashboard' },
  { name: 'today-teacher', path: '/today' },
  { name: 'me-student', path: '/me' },
] as const

test.describe('Accessibility (axe-core)', () => {
  for (const { name, path } of PAGES_TO_AUDIT) {
    test(`no serious violations on ${name}`, async ({ page }) => {
      await page.goto(`http://${TEST_TENANT}.app.localhost:5173${path}`)

      // Wait for the page to be reasonably settled
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

      const results = await new AxeBuilder({ page })
        // Limit to a11y-related rules for faster runs
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )

      if (serious.length > 0) {
        console.error(`A11y violations on ${name}:`)
        for (const v of serious) {
          console.error(`  - [${v.impact}] ${v.id}: ${v.description}`)
          for (const node of v.nodes.slice(0, 3)) {
            console.error(`    target: ${node.target.join(' ')}`)
          }
        }
      }

      expect(serious).toEqual([])
    })
  }
})
