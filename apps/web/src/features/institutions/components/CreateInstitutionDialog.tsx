import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Copy, Image as ImageIcon, Loader2, X } from 'lucide-react'
import { commonTimezones, createInstitutionRequestSchema } from '@asistencia/shared'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import { useCreateInstitution, useUploadLogo } from '../api/institutions.api'

// We extend the shared schema with the UI-only fields (firstName, lastName,
// logo) and combine them on submit. The shared schema only accepts a single
// `adminFullName`; we split it on the FE so the form is more usable and
// re-combine before sending.
const dialogSchema = z.object({
  name: createInstitutionRequestSchema.shape.name,
  subdomain: createInstitutionRequestSchema.shape.subdomain,
  timezone: createInstitutionRequestSchema.shape.timezone,
  plan: createInstitutionRequestSchema.shape.plan,
  adminEmail: createInstitutionRequestSchema.shape.adminEmail,
  adminFirstName: z.string().min(1, 'Nombre requerido').max(100),
  adminLastName: z.string().min(1, 'Apellido requerido').max(100),
  sendActivationLink: createInstitutionRequestSchema.shape.sendActivationLink,
})
type DialogValues = z.infer<typeof dialogSchema>

const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB

interface CreateInstitutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog to create a new institution (super admin only).
 *
 * Form fields: name, subdomain (auto-generated from name), timezone (IANA),
 * plan, admin first/last/email, optional logo (max 2 MB).
 *
 * On success: shows the activation link in a copyable toast. The logo, if
 * provided, is uploaded in a follow-up PATCH /institutions/:id/logo call
 * (the create endpoint doesn't accept multipart in the MVP).
 */
export function CreateInstitutionDialog({ open, onOpenChange }: CreateInstitutionDialogProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const create = useCreateInstitution()
  const uploadLogo = useUploadLogo()
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [activationLink, setActivationLink] = useState<string | null>(null)

  const form = useForm<DialogValues>({
    resolver: zodResolver(dialogSchema),
    defaultValues: {
      name: '',
      subdomain: '',
      timezone: 'America/Argentina/Buenos_Aires',
      plan: 'FREE',
      adminEmail: '',
      adminFirstName: '',
      adminLastName: '',
      sendActivationLink: true,
    },
  })

  // Auto-generate subdomain from name while the field hasn't been
  // manually edited.
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

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo demasiado grande (máx. 2 MB)')
      e.target.value = ''
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen')
      e.target.value = ''
      return
    }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function clearLogo() {
    setLogoFile(null)
    setLogoPreview(null)
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      toast.success(t('institutions.create.copied'))
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  async function onSubmit(values: DialogValues) {
    try {
      const result = await create.mutateAsync({
        name: values.name,
        subdomain: values.subdomain,
        timezone: values.timezone,
        plan: values.plan,
        adminEmail: values.adminEmail,
        adminFullName: `${values.adminFirstName} ${values.adminLastName}`.trim(),
        sendActivationLink: values.sendActivationLink,
      })

      // If a logo was selected, upload it after the institution is created.
      if (logoFile && result.institution?.id) {
        try {
          await uploadLogo.mutateAsync({ id: result.institution.id, file: logoFile })
        } catch {
          toast.warning('Institución creada, pero el logo no se subió')
        }
      }

      onOpenChange(false)
      form.reset()
      clearLogo()
      const link = result.setPasswordLink
      if (link) {
        setActivationLink(link)
        toast.success(t('institutions.create.success'), t('institutions.create.successAdminLink'))
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
            {/* Institution section */}
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {commonTimezones.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Logo upload (optional) */}
              <div className="space-y-2">
                <FormLabel>{t('institutions.create.fields.logo')}</FormLabel>
                {logoPreview ? (
                  <div className="flex items-center gap-3 rounded-md border p-2">
                    <img
                      src={logoPreview}
                      alt="logo preview"
                      className="h-12 w-12 rounded object-cover"
                    />
                    <div className="flex-1 truncate text-xs text-muted-foreground">
                      {logoFile?.name} ({Math.round((logoFile?.size ?? 0) / 1024)} KB)
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={clearLogo}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/30">
                    <ImageIcon className="h-4 w-4" />
                    <span>Subir imagen (máx. 2 MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleLogoChange}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Admin section */}
            <div className="space-y-3 rounded-md border p-3">
              <h3 className="text-sm font-semibold">{t('institutions.create.section.admin')}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="adminFirstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('institutions.create.fields.adminFirstName')}</FormLabel>
                      <FormControl>
                        <Input placeholder="Ada" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adminLastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('institutions.create.fields.adminLastName')}</FormLabel>
                      <FormControl>
                        <Input placeholder="Lovelace" {...field} />
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

            {/* Activation link result */}
            {activationLink && (
              <div className="rounded-md border border-dashed p-3">
                <FormDescription>{t('institutions.create.successAdminLink')}</FormDescription>
                <div className="mt-1 flex items-center gap-2">
                  <Input readOnly value={activationLink} className="font-mono text-xs" />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copyLink(activationLink)}
                  >
                    <Copy className="mr-1 h-4 w-4" />
                    {t('institutions.create.copyLink')}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={create.isPending || uploadLogo.isPending}>
                {create.isPending || uploadLogo.isPending ? (
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
