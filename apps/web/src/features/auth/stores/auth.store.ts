import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MeResponse, UserRole } from '@asistencia/shared'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
}

export interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  bootstrapping: boolean
  setBootstrapping: (v: boolean) => void
  setUser: (user: AuthUser | null) => void
  hydrate: (response: MeResponse) => void
  clearUser: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      bootstrapping: true,

      setUser: (user) => set({ user, isAuthenticated: user !== null }),
      setBootstrapping: (bootstrapping) => set({ bootstrapping }),
      hydrate: (response) =>
        set({
          user: {
            id: response.user.id,
            email: response.user.email,
            fullName: response.user.fullName,
            role: response.user.role,
          },
          isAuthenticated: true,
          bootstrapping: false,
        }),
      clearUser: () =>
        set({
          user: null,
          isAuthenticated: false,
          bootstrapping: false,
        }),
    }),
    {
      name: 'asistencia-auth',
      partialize: (state) => ({ user: state.user }),
    },
  ),
)

export const selectUserRole = (s: AuthState) => s.user?.role ?? null
