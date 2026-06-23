/**
 * Tenant rename migration — old URL behavior.
 *
 * Spec: REQ-TENANT-CELSIUS-001 (Old URL returns tenant-not-found)
 *
 * When the institution was renamed from `universidad-a` to `celsius`,
 * any request with the OLD subdomain SHALL be rejected by the API as
 * tenant-not-found (404). The frontend must not crash; it should
 * fall through to the login screen with the old subdomain visible
 * in the institution label, but any login attempt will fail.
 *
 * This test guards against regressions:
 *  - API accidentally re-introducing `universidad-a` (rollback gone wrong)
 *  - FE accidentally showing a working UI for a tenant that doesn't exist
 *
 * NOTE on environment: `api.app.localhost` does not resolve from Node.js
 * on Windows. The Chromium browser auto-resolves `*.localhost` per RFC 6761,
 * but the Playwright request fixture (Node-side) cannot. We use
 * `localhost:3000` directly — same machine, same API.
 */
import { test, expect } from '../helpers'

test.describe('Tenant rename migration', () => {
  test('API returns 404 tenant-not-found for old universidad-a subdomain', async ({ request }) => {
    // Override the default `X-Tenant-Subdomain` (celsius) to exercise the
    // legacy code path. The backend's TenantResolver must return 404 for
    // a subdomain that no longer exists in the institutions table.
    const response = await request.post('http://localhost:3000/api/v1/auth/login', {
      headers: { 'X-Tenant-Subdomain': 'universidad-a' },
      data: { email: 'admin@universidad-a.com', password: 'whatever' },
    })

    expect(response.status()).toBe(404)
  })

  test('FE renders login page for old universidad-a URL without crashing', async ({ page }) => {
    // Navigating to the legacy URL must NOT 5xx, blank-screen, or throw.
    // The expected behavior: ProtectedRoute bounces to /login, and
    // LoginPage renders with the legacy subdomain label visible.
    //
    // We use `networkidle` (best-effort, see a11y.spec.ts pattern) to
    // give React.lazy + Suspense time to load the LoginPage chunk. The
    // body-text assertion is enough to prove the page rendered without
    // crashing — we avoid `getByLabel` because it is subject to a
    // pre-existing flake (see apply-progress #235).
    await page.goto('http://universidad-a.app.localhost:5173/')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

    const body = await page.locator('body').textContent({ timeout: 10_000 })
    // The legacy subdomain must be visible in the institution label.
    expect(body ?? '').toMatch(/universidad-a/i)
  })
})
