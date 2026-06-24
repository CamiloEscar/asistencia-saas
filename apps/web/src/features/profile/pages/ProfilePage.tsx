import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { updateMeRequestSchema } from '@asistencia/shared'
import { useMutation } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui'
import { PageHeader } from '@/components/feedback/PageHeader'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/features/auth/use-auth'

type ProfileFormValues = z.infer<typeof updateMeRequestSchema>

export function ProfilePage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { user } = useAuth()

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(updateMeRequestSchema),
    defaultValues: { fullName: user?.fullName ?? '' },
  })

  useEffect(() => {
    if (user) profileForm.reset({ fullName: user.fullName })
  }, [user, profileForm])

  const updateMe = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const { data: res } = await apiClient.patch<{
        user: { id: string; email: string; fullName: string; role: string }
      }>('/users/me', data)
      return res
    },
    onSuccess: (data) => {
      toast.success(t('profile.password.success'))
      if (data.user?.fullName) profileForm.setValue('fullName', data.user.fullName)
    },
    onError: (err) => toast.errorFromApi(err, 'errors:generic'),
  })

  async function onProfileSubmit(values: ProfileFormValues) {
    updateMe.mutate({ fullName: values.fullName })
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      <PageHeader title={t('profile.title')} description={t('profile.subtitle')} />

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.info.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">{t('profile.info.email')}</div>
              <div className="font-medium">{user.email}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t('profile.info.role')}</div>
              <div className="font-medium">{t(`roles.${user.role}`)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.info.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-3">
              <FormField
                control={profileForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('profile.info.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateMe.isPending}>
                {updateMe.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.save')}
                  </>
                ) : (
                  t('common.save')
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.password.title')}</CardTitle>
          <CardDescription>Cambiá tu contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.language.title')}</CardTitle>
          <CardDescription>{t('profile.language.help')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{t('profile.language.current')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Requerido'),
    newPassword: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
      .regex(/[0-9]/, 'Debe incluir al menos un dígito')
      .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial'),
    confirmPassword: z.string().min(1, 'Requerido'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  })
type PasswordValues = z.infer<typeof passwordSchema>

function PasswordForm() {
  const { t } = useTranslation()
  const toast = useToast()
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const change = useMutation({
    mutationFn: async (data: PasswordValues) => {
      await apiClient.patch('/users/me', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
    },
    onSuccess: () => {
      toast.success(t('profile.password.success'))
      form.reset()
    },
    onError: (err) => toast.errorFromApi(err, 'errors:generic'),
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => change.mutate(v))} className="space-y-3">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('profile.password.current')}</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('profile.password.new')}</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('profile.password.confirm')}</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('profile.password.submitting')}
            </>
          ) : (
            t('profile.password.submit')
          )}
        </Button>
        <FormDescription>10+ caracteres, mayúscula, dígito, carácter especial.</FormDescription>
      </form>
    </Form>
  )
}
