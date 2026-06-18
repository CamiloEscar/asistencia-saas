import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'
import { Copy, Loader2 } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { useToast } from '@/hooks/use-toast'
import { createUserRequestSchema, userRoleValues, userRoleLabels } from '@asistencia/shared'
import { useCreateUser } from '../api/users.api'

type FormValues = z.infer<typeof createUserRequestSchema>

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Create a new user in the active institution. The role is restricted to
 * tenant roles (no SUPER_ADMIN from the FE). When the user is created
 * without a password, the BE returns a set-password link that the user
 * must be sent manually (no SMTP in MVP).
 */
export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const create = useCreateUser()
  const [resultLink, setResultLink] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(createUserRequestSchema),
    defaultValues: {
      email: '',
      fullName: '',
      role: 'TEACHER',
      sendActivationLink: true,
    },
  })

  useEffect(() => {
    if (!open) {
      form.reset()
      setResultLink(null)
    }
  }, [open, form])

  async function onSubmit(values: FormValues) {
    try {
      const result = await create.mutateAsync(values)
      onOpenChange(false)
      form.reset()
      if (result.setPasswordLink) {
        setResultLink(result.setPasswordLink)
        toast.success(t('users.create.success'), t('users.create.successLink'))
      } else if (result.temporaryPassword) {
        toast.success(
          t('users.create.success'),
          t('users.create.passwordShown', { password: result.temporaryPassword }),
        )
      } else {
        toast.success(t('users.create.success'))
      }
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      toast.success(t('users.create.copied'))
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('users.create.title')}</DialogTitle>
          <DialogDescription>{t('users.create.subtitle')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            aria-label="create-user"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nombre completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ada Lovelace" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="user@inst.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.create.fields.role')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {userRoleValues
                          .filter((r) => r !== 'SUPER_ADMIN')
                          .map((r) => (
                            <SelectItem key={r} value={r}>
                              {userRoleLabels[r]}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.create.fields.tempPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>{t('users.create.fields.tempPasswordHelp')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {resultLink && (
              <div className="rounded-md border border-dashed p-3">
                <FormDescription>{t('users.create.successLink')}</FormDescription>
                <div className="mt-1 flex items-center gap-2">
                  <Input readOnly value={resultLink} className="font-mono text-xs" />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copyLink(resultLink)}
                  >
                    <Copy className="mr-1 h-4 w-4" />
                    {t('users.create.copyLink')}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('users.create.submit')}
                  </>
                ) : (
                  t('users.create.submit')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
