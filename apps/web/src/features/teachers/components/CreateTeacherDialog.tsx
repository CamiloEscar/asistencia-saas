import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
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
} from '@/components/ui'
import { useToast } from '@/hooks/use-toast'
import { useCreateTeacher } from '../api/teachers.api'

const teacherSchema = z.object({
  email: z.string().email('Email inválido'),
  fullName: z.string().min(2, 'Nombre requerido'),
  phone: z.string().optional(),
})
type FormValues = z.infer<typeof teacherSchema>

interface CreateTeacherDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateTeacherDialog({ open, onOpenChange }: CreateTeacherDialogProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const create = useCreateTeacher()

  const form = useForm<FormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { email: '', fullName: '', phone: '' },
  })

  useEffect(() => {
    if (!open) form.reset()
  }, [open, form])

  async function onSubmit(values: FormValues) {
    try {
      await create.mutateAsync({
        email: values.email,
        fullName: values.fullName,
        phone: values.phone || undefined,
      })
      toast.success(t('teachers.create.success'))
      onOpenChange(false)
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('teachers.create.title')}</DialogTitle>
          <DialogDescription>{t('teachers.create.subtitle')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
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
                <FormItem>
                  <FormLabel>{t('teachers.create.fields.email')}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="profesor@inst.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('teachers.create.fields.phone')}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('teachers.create.submit')}
                  </>
                ) : (
                  t('teachers.create.submit')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
