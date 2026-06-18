import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginRequest, LoginResponse, MeResponse } from '@asistencia/shared'
import apiClient, { setReturnTo } from '@/lib/api-client'
import { useAuthStore } from '../stores/auth.store'
import { applyReturnTo } from '../auth.helpers'

/**
 * Auth-related TanStack Query hooks. Login / logout are mutations
 * (POST). /auth/me is a query — the AuthProvider hydrates the store
 * from it, but any component that needs the current user can also
 * read it via `useCurrentUser` (the store remains the source of truth
 * for re-renders).
 */
export const authKeys = {
  me: ['auth', 'me'] as const,
}

export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      const { data } = await apiClient.get<MeResponse>('/auth/me')
      return data
    },
    // /auth/me is cheap; we let TanStack refetch on demand rather than
    // treating it as a polled resource.
    staleTime: 30_000,
    retry: 0,
  })
}

export function useLogin() {
  const hydrate = useAuthStore((s) => s.hydrate)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', credentials)
      return data
    },
    onSuccess: async (data) => {
      // Manually call /auth/me so the store has the institution
      // context. Cheaper than overloading the login response.
      const me = await apiClient
        .get<MeResponse>('/auth/me')
        .then((r) => r.data)
        .catch(() => null)
      if (me) hydrate(me)
      hydrate({ user: data.user, institution: null })
      await queryClient.invalidateQueries({ queryKey: authKeys.me })
    },
  })
}

export function useLogout() {
  const clearUser = useAuthStore((s) => s.clearUser)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout', null)
    },
    onSettled: () => {
      clearUser()
      queryClient.clear()
    },
  })
}

/**
 * Manual refresh trigger. The api-client's interceptor calls this
 * implicitly on 401, so feature code rarely needs it. Exposed for
 * cases like "user clicks a 'refresh' button".
 */
export function useRefresh() {
  const hydrate = useAuthStore((s) => s.hydrate)
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<LoginResponse>('/auth/refresh', null)
      return data
    },
    onSuccess: async () => {
      const me = await apiClient
        .get<MeResponse>('/auth/me')
        .then((r) => r.data)
        .catch(() => null)
      if (me) hydrate(me)
    },
  })
}

/** Helper for the login page: returns the post-login redirect path. */
export function postLoginRedirect(defaultPath: string): string {
  return applyReturnTo(defaultPath)
}

/** Helper for the login page: capture the current path as returnTo. */
export function captureReturnTo(currentPath: string): void {
  setReturnTo(currentPath)
}
