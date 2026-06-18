import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createInstitutionRequestSchema } from '@asistencia/shared'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import { useCreateInstitution } from '../api/institutions.api'

type CreateInstitutionValues = z.infer<typeof createInstitutionRequestSchema>

// `Loader2` icon is the submit button spinner.

interface CreateInstitutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog to create a new institution (super admin only). On success
 * shows the activation link for the initial admin in a copyable
 * surface. Logo upload is supported as an optional multipart field
 * (extended version; for MVP we keep it simple).
 */
export function CreateInstitutionDialog({ open, onOpenChange }: CreateInstitutionDialogProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const create = useCreateInstitution()

  const form = useForm<CreateInstitutionValues>({
    resolver: zodResolver(createInstitutionRequestSchema),
    defaultValues: {
      name: '',
      subdomain: '',
      timezone: 'America/Argentina/Buenos_Aires',
      plan: 'FREE',
      adminEmail: '',
      adminFullName: '',
      sendActivationLink: true,
    },
  })

  // Auto-generate subdomain from name while the field hasn't been
  // manually edited. We track a "touched" flag on the subdomain field.
  const watchedName = form.watch('name')
  useEffect(() => {
    if (!form.formState.dirtyFields.subdomain) {
      const slug = watchedName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      form.setValue('subdomain', slug, { shouldValidate: false, shouldDirty: false })
    }
  }, [watchedName, form])

  async function onSubmit(values: CreateInstitutionValues) {
    try {
      const result = await create.mutateAsync(values)
      onOpenChange(false)
      form.reset()
      if (result.setPasswordLink) {
        toast.success(
          t('institutions.create.success'),
          `${t('institutions.create.successAdminLink')} ${result.setPasswordLink}`,
        )
      } else {
        toast.success(t('institutions.create.success'))
      }
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('institutions.create.title')}</DialogTitle>
          <DialogDescription>{t('institutions.create.subtitle')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            aria-label="create-institution"
          >
            <div className="space-y-3 rounded-md border p-3">
              <h3 className="text-sm font-semibold">
                {t('institutions.create.section.institution')}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('institutions.create.fields.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder="Universidad..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subdomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('institutions.create.fields.subdomain')}</FormLabel>
                      <FormControl>
                        <Input placeholder="universidad-x" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t('institutions.create.fields.timezone')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <h3 className="text-sm font-semibold">{t('institutions.create.section.admin')}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="adminFullName"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t('institutions.create.fields.adminFullName')}</FormLabel>
                      <FormControl>
                        <Input placeholder="Ada Lovelace" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adminEmail"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t('institutions.create.fields.adminEmail')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@inst.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('institutions.create.submitting')}
                  </>
                ) : (
                  t('institutions.create.submit')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
