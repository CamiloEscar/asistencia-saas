import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { updateUserRequestSchema } from '@asistencia/shared'
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
  Switch,
} from '@/components/ui'
import { useToast } from '@/hooks/use-toast'
import { useUpdateUser, useUser } from '../api/users.api'

type FormValues = z.infer<typeof updateUserRequestSchema>

interface EditUserDialogProps {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditUserDialog({ userId, open, onOpenChange }: EditUserDialogProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const userQuery = useUser(userId ?? undefined)
  const update = useUpdateUser()

  const form = useForm<FormValues>({
    resolver: zodResolver(updateUserRequestSchema),
    defaultValues: {
      fullName: '',
      isActive: true,
    },
  })

  useEffect(() => {
    if (userQuery.data) {
      form.reset({
        fullName: userQuery.data.fullName,
        isActive: userQuery.data.status === 'ACTIVE',
      })
    }
  }, [userQuery.data, form])

  useEffect(() => {
    if (!open) form.reset()
  }, [open, form])

  async function onSubmit(values: FormValues) {
    if (!userId) return
    try {
      await update.mutateAsync({ id: userId, data: values })
      toast.success(t('users.edit.success'))
      onOpenChange(false)
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('users.edit.title')}</DialogTitle>
          <DialogDescription>{userQuery.data?.email}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Activo</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  </FormControl>
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
                    {t('users.edit.submit')}
                  </>
                ) : (
                  t('users.edit.submit')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
