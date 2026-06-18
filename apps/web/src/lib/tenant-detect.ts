/**
 * Subdomain detection from `window.location.hostname`.
 *
 * Recognised shapes (MVP):
 *  - `universidad-a.app.localhost:5173` → "universidad-a"
 *  - `universidad-a.app.com`            → "universidad-a"
 *  - `app.example.com` (no subdomain)   → null
 *  - `localhost:5173` (no subdomain)    → null
 *
 * The result is stored in a Zustand store (auth store) and sent on every
 * API call via the `X-Tenant-Subdomain` header (per spec FE-REQ-AUTH-001).
 */
export function detectSubdomain(): string | null {
  if (typeof window === 'undefined') return null
  const hostname = window.location.hostname

  // Production: foo.app.com → "foo"
  if (hostname.endsWith('.app.com')) {
    const sub = hostname.replace('.app.com', '')
    return sub.length > 0 ? sub : null
  }

  // Dev: foo.app.localhost → "foo". Be tolerant: 127.0.0.1 / localhost → null.
  if (hostname.endsWith('.app.localhost')) {
    const sub = hostname.replace('.app.localhost', '')
    return sub.length > 0 ? sub : null
  }

  return null
}
