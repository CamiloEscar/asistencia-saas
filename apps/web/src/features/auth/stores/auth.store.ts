import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MeResponse, UserRole } from '@asistencia/shared'

/**
 * Tenant + auth context for the entire FE. Persisted to localStorage so
 * a page refresh keeps the user signed in (the access token lives in an
 * HttpOnly cookie managed by the BE — never in localStorage).
 *
 * State shape:
 *  - user: the currently-authenticated user, or null when signed out.
 *  - institution: the active tenant (subdomain + name + timezone), or null
 *    for SUPER_ADMIN (who has no tenant).
 *  - isAuthenticated: derived from `user !== null`.
 *
 * Actions:
 *  - setUser: replaces the user (used by AuthProvider after /auth/me).
 *  - setInstitution: replaces the institution context.
 *  - setInstitutionSlug: updates the subdomain only (cheap, no /me call).
 *  - clearUser: signs the user out locally.
 */

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
}

export interface AuthInstitution {
  id: string
  name: string
  subdomain: string
  timezone: string
}

export interface AuthState {
  user: AuthUser | null
  institution: AuthInstitution | null
  /** Subdomain is the only piece of state the api-client reads on every
   *  request. We persist it independently so axios has it on the very
   *  first request of a fresh page load (before /auth/me returns). */
  institutionSlug: string | null
  isAuthenticated: boolean

  setUser: (user: AuthUser | null) => void
  setInstitution: (institution: AuthInstitution | null) => void
  setInstitutionSlug: (subdomain: string | null) => void
  /** Apply a /auth/me response in one shot. */
  hydrate: (response: MeResponse) => void
  clearUser: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      institution: null,
      institutionSlug: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: user !== null }),
      setInstitution: (institution) =>
        set({ institution, institutionSlug: institution?.subdomain ?? null }),
      setInstitutionSlug: (institutionSlug) => set({ institutionSlug }),
      hydrate: (response) =>
        set({
          user: {
            id: response.user.id,
            email: response.user.email,
            fullName: response.user.fullName,
            role: response.user.role,
          },
          institution: response.institution,
          institutionSlug: response.institution?.subdomain ?? null,
          isAuthenticated: true,
        }),
      clearUser: () =>
        set({
          user: null,
          institution: null,
          institutionSlug: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'asistencia-auth',
      // Persist only what is safe + useful. The user is in an HttpOnly
      // cookie, but the role/display info is fine to cache locally so
      // the UI doesn't flicker on first paint.
      partialize: (state) => ({
        user: state.user,
        institution: state.institution,
        institutionSlug: state.institutionSlug,
      }),
    },
  ),
)

/** Selector helper: pick the role without subscribing to the whole store. */
export const selectUserRole = (s: AuthState) => s.user?.role ?? null
