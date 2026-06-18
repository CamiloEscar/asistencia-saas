import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createStudentRequestSchema } from '@asistencia/shared'
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
import { useCreateStudent, useStudent, useUpdateStudent } from '../api/students.api'

type FormValues = z.infer<typeof createStudentRequestSchema>

interface BaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateStudentDialog({ open, onOpenChange }: BaseProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const create = useCreateStudent()

  const form = useForm<FormValues>({
    resolver: zodResolver(createStudentRequestSchema),
    defaultValues: {
      legajo: '',
      fullName: '',
      email: '',
    },
  })

  useEffect(() => {
    if (!open) form.reset()
  }, [open, form])

  async function onSubmit(values: FormValues) {
    try {
      await create.mutateAsync(values)
      toast.success(t('students.create.success'))
      onOpenChange(false)
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('students.create.title')}</DialogTitle>
          <DialogDescription>{t('students.create.subtitle')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="legajo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('students.create.fields.legajo')}</FormLabel>
                  <FormControl>
                    <Input placeholder="A001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                  <FormLabel>{t('students.create.fields.email')}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="alumno@inst.com"
                      {...field}
                      value={field.value ?? ''}
                    />
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
                    {t('students.create.submit')}
                  </>
                ) : (
                  t('students.create.submit')
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
  studentId: string | null
}

export function EditStudentDialog({ studentId, open, onOpenChange }: EditProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const student = useStudent(studentId ?? undefined)
  const update = useUpdateStudent()

  const form = useForm<FormValues>({
    resolver: zodResolver(createStudentRequestSchema),
    defaultValues: { legajo: '', fullName: '' },
  })

  useEffect(() => {
    if (student.data) {
      form.reset({
        legajo: student.data.legajo ?? '',
        fullName: student.data.fullName,
        email: student.data.email,
        career: student.data.career ?? undefined,
        phone: student.data.phone ?? undefined,
      })
    }
  }, [student.data, form])

  useEffect(() => {
    if (!open) form.reset()
  }, [open, form])

  async function onSubmit(values: FormValues) {
    if (!studentId) return
    try {
      await update.mutateAsync({ id: studentId, data: values })
      toast.success(t('students.edit.success'))
      onOpenChange(false)
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('students.edit.title')}</DialogTitle>
          <DialogDescription>{student.data?.email}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="legajo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('students.create.fields.legajo')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} value={field.value ?? ''} />
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
                    {t('students.edit.submit')}
                  </>
                ) : (
                  t('students.edit.submit')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
