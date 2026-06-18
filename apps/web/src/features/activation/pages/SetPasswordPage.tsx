import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Check, X, KeyRound } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { AppForm, SubmitButton } from '@/components/common/Form'
import { useToast } from '@/hooks/use-toast'
import { setPasswordRequestSchema, type SetPasswordResponse } from '@asistencia/shared'
import apiClient from '@/lib/api-client'
import { landingPathForRole, Paths } from '@/app/routes/paths'
import { toApiError } from '@/features/auth/auth.helpers'
import { useAuthStore } from '@/features/auth/stores/auth.store'

type Values = z.infer<typeof setPasswordRequestSchema>

/**
 * Compute a simple strength score (0-4) from the password. Used to
 * render the live indicator on the input.
 */
function passwordStrength(p: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0
  if (p.length >= 8) score++
  if (/[A-Z]/.test(p)) score++
  if (/[0-9]/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  const labels: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: 'Muy débil',
    1: 'Débil',
    2: 'Aceptable',
    3: 'Buena',
    4: 'Fuerte',
  }
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score as 0 | 1 | 2 | 3 | 4] }
}

export function SetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const toast = useToast()
  const setUser = useAuthStore((s) => s.setUser)

  const form = useForm<Values>({
    resolver: zodResolver(setPasswordRequestSchema),
    defaultValues: { token: token || '', newPassword: '', confirmPassword: '' },
  })

  const password = form.watch('newPassword') ?? ''
  const strength = passwordStrength(password)

  async function onSubmit(values: Values) {
    try {
      const { data } = await apiClient.post<SetPasswordResponse>('/auth/set-password', {
        token: values.token,
        newPassword: values.newPassword,
      })
      setUser({
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        role: data.user.role,
      })
      toast.success(t('auth.setPassword.success'))
      navigate(landingPathForRole(data.user.role), { replace: true })
    } catch (err) {
      const { detail, status } = toApiError(err)
      if (status === 401) toast.error(t('errors:tokenExpired'))
      else toast.error(detail ?? t('errors:generic'))
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold">{t('auth.setPassword.title')}</h1>
          <p className="text-sm text-destructive">Token inválido o ausente.</p>
          <Link to={Paths.login} className="text-sm underline">
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t('auth.setPassword.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.setPassword.subtitle')}</p>
        </header>

        <AppForm form={form} onSubmit={onSubmit} className="space-y-4">
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.setPassword.newPassword')}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="password"
                      autoComplete="new-password"
                      className="pl-9"
                      placeholder="••••••••"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
                {password.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i < strength.score
                              ? strength.score <= 1
                                ? 'bg-destructive'
                                : strength.score <= 2
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{strength.label}</p>
                  </div>
                )}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.setPassword.confirmPassword')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              {password.length >= 8 ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              Al menos 8 caracteres
            </li>
            <li className="flex items-center gap-2">
              {/[A-Z]/.test(password) ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              Una mayúscula
            </li>
            <li className="flex items-center gap-2">
              {/[0-9]/.test(password) ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              Un dígito
            </li>
            <li className="flex items-center gap-2">
              {/[^A-Za-z0-9]/.test(password) ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              Un carácter especial
            </li>
          </ul>

          <SubmitButton
            label={t('auth.setPassword.submit')}
            submittingLabel={t('auth.setPassword.submit')}
            className="w-full"
          />
        </AppForm>

        <p className="text-center text-sm">
          <Link to={Paths.login} className="text-muted-foreground underline hover:text-foreground">
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}
