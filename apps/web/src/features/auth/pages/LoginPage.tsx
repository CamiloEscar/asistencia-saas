import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppForm } from '@/components/common/Form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import { useLogin, postLoginRedirect, captureReturnTo } from '@/features/auth/hooks/use-auth'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { landingPathForRole, Paths } from '@/app/routes/paths'
import { toApiError } from '@/features/auth/auth.helpers'

const loginSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(1, { message: 'Contraseña requerida' }),
})

type LoginValues = z.infer<typeof loginSchema>

/**
 * Login page. Subdomain is auto-detected on mount; if missing (e.g.
 * `app.example.com` plain), we still show the form but with a banner
 * saying "subdomain not detected".
 */
export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useLogin()
  const toast = useToast()
  const authed = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.user?.role ?? null)

  // If already authenticated, bounce to the role landing.
  useEffect(() => {
    if (authed && role) {
      navigate(landingPathForRole(role), { replace: true })
    }
  }, [authed, role, navigate])

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  })

  async function onSubmit(values: LoginValues) {
    try {
      const ret = searchParams.get('returnTo')
      if (ret) captureReturnTo(ret)
      await login.mutateAsync(values)
      // Redirect to returnTo if any, else the role landing.
      const dest = postLoginRedirect(landingPathForRole(role))
      navigate(dest, { replace: true })
    } catch (err) {
      const { detail, title } = toApiError(err)
      toast.error(detail ?? title)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.login.subtitle')}</p>
        </header>

        <AppForm form={form} onSubmit={onSubmit} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.login.email')}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder={t('auth.login.emailPlaceholder')}
                      className="pl-9"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.login.password')}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder={t('auth.login.passwordPlaceholder')}
                      className="pl-9"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? t('auth.login.submitting') : t('auth.login.submit')}
          </Button>
        </AppForm>

        <div className="space-y-2 text-center text-sm">
          <Link
            to={Paths.forgotPassword}
            className="block text-muted-foreground underline hover:text-foreground"
          >
            {t('auth.login.forgotPassword')}
          </Link>
          <Link
            to={Paths.setPassword}
            className="block text-muted-foreground underline hover:text-foreground"
          >
            {t('auth.login.setPassword')}
          </Link>
          <p className="pt-2 text-xs text-muted-foreground">{t('auth.login.noAccount')}</p>
        </div>
      </div>
    </div>
  )
}
