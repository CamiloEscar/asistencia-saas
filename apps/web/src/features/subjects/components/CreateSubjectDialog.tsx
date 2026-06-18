import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createSubjectRequestSchema } from '@asistencia/shared'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui'
import { useToast } from '@/hooks/use-toast'
import { useCreateSubject, useSubject, useUpdateSubject } from '../api/subjects.api'

type FormValues = z.infer<typeof createSubjectRequestSchema>

interface BaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateSubjectDialog({ open, onOpenChange }: BaseProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const create = useCreateSubject()
  const form = useForm<FormValues>({
    resolver: zodResolver(createSubjectRequestSchema),
    defaultValues: { code: '', name: '' },
  })
  useEffect(() => {
    if (!open) form.reset()
  }, [open, form])

  async function onSubmit(values: FormValues) {
    try {
      await create.mutateAsync({
        ...values,
        code: values.code.toUpperCase(),
      })
      toast.success(t('subjects.create.success'))
      onOpenChange(false)
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('subjects.create.title')}</DialogTitle>
          <DialogDescription>{t('subjects.create.subtitle')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('subjects.create.fields.code')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="MAT101"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>{t('subjects.create.fields.codeHelp')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('subjects.create.fields.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('subjects.create.fields.description')}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ''} />
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
                    {t('subjects.create.submit')}
                  </>
                ) : (
                  t('subjects.create.submit')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

interface EditProps extends BaseProps {
  subjectId: string | null
}

export function EditSubjectDialog({ subjectId, open, onOpenChange }: EditProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const subject = useSubject(subjectId ?? undefined)
  const update = useUpdateSubject()

  const form = useForm<FormValues>({
    resolver: zodResolver(createSubjectRequestSchema),
    defaultValues: { code: '', name: '' },
  })

  useEffect(() => {
    if (subject.data) {
      form.reset({
        code: subject.data.code,
        name: subject.data.name,
        description: subject.data.description ?? undefined,
      })
    }
  }, [subject.data, form])
  useEffect(() => {
    if (!open) form.reset()
  }, [open, form])

  async function onSubmit(values: FormValues) {
    if (!subjectId) return
    try {
      await update.mutateAsync({
        id: subjectId,
        data: { name: values.name, description: values.description },
      })
      toast.success(t('subjects.edit.success'))
      onOpenChange(false)
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('subjects.edit.title')}</DialogTitle>
          <DialogDescription>{subject.data?.code}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('subjects.create.fields.code')}</FormLabel>
                  <FormControl>
                    <Input disabled {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('subjects.create.fields.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('subjects.create.fields.description')}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('subjects.edit.submit')}
                  </>
                ) : (
                  t('subjects.edit.submit')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
