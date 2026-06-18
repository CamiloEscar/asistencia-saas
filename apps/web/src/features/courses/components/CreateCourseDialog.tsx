import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import type { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createCourseRequestSchema, type ScheduleEntry } from '@asistencia/shared'
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { useToast } from '@/hooks/use-toast'
import { useCreateCourse, useEnrollStudents } from '../api/courses.api'
import { useListSubjects } from '@/features/subjects/api/subjects.api'
import { useListTeachers } from '@/features/teachers/api/teachers.api'
import { useListStudents } from '@/features/students/api/students.api'
import { ScheduleBuilder } from './ScheduleBuilder'

type FormValues = z.infer<typeof createCourseRequestSchema>

interface CreateCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateCourseDialog({ open, onOpenChange }: CreateCourseDialogProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const create = useCreateCourse()
  const enroll = useEnrollStudents('')

  const form = useForm<FormValues>({
    resolver: zodResolver(createCourseRequestSchema),
    defaultValues: {
      code: '',
      name: '',
      subjectId: '',
      semester: '',
      startDate: new Date().toISOString().slice(0, 10) as unknown as Date,
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120)
        .toISOString()
        .slice(0, 10) as unknown as Date,
      schedule: [{ day: 1, startTime: '09:00', endTime: '10:30' }],
      defaultSessionDurationMin: 80,
      teacherIds: [],
      studentIds: [],
    },
  })

  const { control, handleSubmit, watch, setValue } = form
  const schedule = watch('schedule')

  const subjects = useListSubjects({ limit: 100 })
  const teachers = useListTeachers({ limit: 100 })
  const students = useListStudents({ limit: 100 })

  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([])

  useEffect(() => {
    if (!open) {
      form.reset()
      setSelectedStudents([])
      setSelectedTeachers([])
    }
  }, [open, form])

  async function onSubmit(values: FormValues) {
    try {
      const created = await create.mutateAsync({
        ...values,
        teacherIds: selectedTeachers,
        studentIds: [],
      })
      // Enroll students in a separate call (the create endpoint accepts
      // studentIds but the BE may not auto-enroll — keep this defensive).
      if (selectedStudents.length > 0 && created.id) {
        try {
          await enroll.mutateAsync({ studentIds: selectedStudents })
        } catch {
          // ignore — the course was created
        }
      }
      toast.success(t('courses.create.success'))
      onOpenChange(false)
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('courses.create.title')}</DialogTitle>
          <DialogDescription>{t('courses.create.subtitle')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('courses.create.fields.code')}</FormLabel>
                    <FormControl>
                      <Input placeholder="MAT101-A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('courses.create.fields.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="subjectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('courses.create.fields.subjectId')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(subjects.data?.data ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.code} · {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="semester"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('courses.create.fields.semester')}</FormLabel>
                    <FormControl>
                      <Input placeholder="2026-1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('courses.create.fields.startDate')}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : String(field.value).slice(0, 10)
                        }
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('courses.create.fields.endDate')}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().slice(0, 10)
                            : String(field.value).slice(0, 10)
                        }
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('courses.create.fields.description')}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>{t('courses.create.fields.teacherIds')}</FormLabel>
              <div className="rounded-md border p-2">
                <div className="mb-2 flex flex-wrap gap-1">
                  {selectedTeachers.map((id) => {
                    const t = teachers.data?.data.find((x) => x.id === id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {t?.fullName ?? id}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTeachers((prev) => prev.filter((x) => x !== id))
                          }
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  onChange={(e) => {
                    const id = e.target.value
                    if (id && !selectedTeachers.includes(id)) {
                      setSelectedTeachers((prev) => [...prev, id])
                    }
                    e.target.value = ''
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    {t('courses.create.fields.teacherIds')}
                  </option>
                  {(teachers.data?.data ?? []).map((t) => (
                    <option key={t.id} value={t.id} disabled={selectedTeachers.includes(t.id)}>
                      {t.fullName} ({t.email})
                    </option>
                  ))}
                </select>
              </div>
            </FormItem>

            <ScheduleBuilder
              value={schedule as ScheduleEntry[]}
              onChange={(v) => setValue('schedule', v, { shouldValidate: true })}
            />

            <FormItem>
              <FormLabel>{t('courses.create.fields.initialStudents')}</FormLabel>
              <div className="rounded-md border p-2">
                <div className="mb-2 flex flex-wrap gap-1">
                  {selectedStudents.map((id) => {
                    const s = students.data?.data.find((x) => x.id === id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {s?.legajo ?? id} · {s?.fullName}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStudents((prev) => prev.filter((x) => x !== id))
                          }
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  onChange={(e) => {
                    const id = e.target.value
                    if (id && !selectedStudents.includes(id)) {
                      setSelectedStudents((prev) => [...prev, id])
                    }
                    e.target.value = ''
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Seleccionar alumno
                  </option>
                  {(students.data?.data ?? []).map((s) => (
                    <option key={s.id} value={s.id} disabled={selectedStudents.includes(s.id)}>
                      {s.legajo} · {s.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </FormItem>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('courses.create.submitting')}
                  </>
                ) : (
                  t('courses.create.submit')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
