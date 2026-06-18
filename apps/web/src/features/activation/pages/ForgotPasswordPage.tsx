import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'
import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { AppForm, SubmitButton } from '@/components/common/Form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { forgotPasswordRequestSchema, type ForgotPasswordResponse } from '@asistencia/shared'
import apiClient from '@/lib/api-client'
import { Paths } from '@/app/routes/paths'
import { toApiError } from '@/features/auth/auth.helpers'

const schema = forgotPasswordRequestSchema
type Values = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [submitted, setSubmitted] = useState(false)
  const [resetUrl, setResetUrl] = useState<string | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: Values) {
    try {
      const { data } = await apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', values)
      setSubmitted(true)
      setResetUrl(data.resetUrl ?? null)
    } catch (err) {
      const { status, detail } = toApiError(err)
      if (status === 429) toast.error(t('errors:rateLimited'))
      else toast.error(detail ?? t('errors:generic'))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('auth.forgotPassword.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.forgotPassword.subtitle')}</p>
        </header>

        {submitted ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Enviado</AlertTitle>
            <AlertDescription>
              <p>{t('auth.forgotPassword.successMessage')}</p>
              {resetUrl && (
                <p className="mt-2 break-all rounded-md border bg-muted/30 p-2 text-xs">
                  <span className="font-medium">URL (MVP, no SMTP):</span>{' '}
                  <a href={resetUrl} className="underline">
                    {resetUrl}
                  </a>
                </p>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <AppForm form={form} onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.forgotPassword.email')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input type="email" autoComplete="email" className="pl-9" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SubmitButton label={t('auth.forgotPassword.submit')} className="w-full" />
          </AppForm>
        )}

        <p className="text-center text-sm">
          <Link to={Paths.login} className="text-muted-foreground underline hover:text-foreground">
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}
