import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui'
import { AttendanceStatus, attendanceStatusLabels } from '@asistencia/shared'

interface JustificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStatus: 'LATE' | 'JUSTIFIED'
  onSave: (text: string) => void
  onCancel: () => void
}

const schema = z.object({
  text: z.string().min(1, 'La justificación es obligatoria').max(500, 'Máximo 500 caracteres'),
})

type FormValues = z.infer<typeof schema>

/**
 * Modal that opens when the user picks LATE or JUSTIFIED. The textarea
 * has a live counter; saving commits the text to the row, cancel
 * reverts the row to the previous state.
 */
export function JustificationModal({
  open,
  onOpenChange,
  initialStatus,
  onSave,
  onCancel,
}: JustificationModalProps) {
  const { t } = useTranslation()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text: '' },
  })
  const [count, setCount] = useState(0)

  function handleSave(values: FormValues) {
    onSave(values.text)
    form.reset()
  }

  function handleCancel() {
    onCancel()
    form.reset()
  }

  const placeholder =
    initialStatus === AttendanceStatus.LATE
      ? t('attendance.justification.late')
      : t('attendance.justification.justified')

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleCancel()
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('attendance.justification.title')}</DialogTitle>
          <DialogDescription>{attendanceStatusLabels[initialStatus]}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-3">
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{placeholder}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      maxLength={500}
                      placeholder={t('attendance.justification.placeholder')}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        setCount(e.target.value.length)
                      }}
                    />
                  </FormControl>
                  <div className="flex items-center justify-between">
                    <FormMessage />
                    <span
                      className={`text-xs ${
                        count >= 500 ? 'text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      {t('attendance.justification.counter', { count })}
                    </span>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                {t('attendance.justification.cancel')}
              </Button>
              <Button type="submit">{t('attendance.justification.save')}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
