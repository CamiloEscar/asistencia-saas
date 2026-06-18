import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ScheduleEntry } from '@asistencia/shared'

interface ScheduleBuilderProps {
  value: ScheduleEntry[]
  onChange: (value: ScheduleEntry[]) => void
}

const DAYS = [
  { value: 1, labelKey: 'courses.create.schedule.days.1' },
  { value: 2, labelKey: 'courses.create.schedule.days.2' },
  { value: 3, labelKey: 'courses.create.schedule.days.3' },
  { value: 4, labelKey: 'courses.create.schedule.days.4' },
  { value: 5, labelKey: 'courses.create.schedule.days.5' },
  { value: 6, labelKey: 'courses.create.schedule.days.6' },
  { value: 0, labelKey: 'courses.create.schedule.days.0' },
]

/**
 * Weekly schedule editor. Rows are added/removed dynamically. Each row
 * validates that endTime > startTime and that no two rows on the same
 * day overlap.
 */
export function ScheduleBuilder({ value, onChange }: ScheduleBuilderProps) {
  const { t } = useTranslation()

  function addRow() {
    onChange([...value, { day: 1, startTime: '09:00', endTime: '10:30' }])
  }

  function removeRow(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function update(i: number, patch: Partial<ScheduleEntry>) {
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  function hasConflict(target: ScheduleEntry, selfIndex: number): boolean {
    return value.some((other, i) => {
      if (i === selfIndex) return false
      if (other.day !== target.day) return false
      // Overlap: !(other.end <= target.start || other.start >= target.end)
      return !(other.endTime <= target.startTime || other.startTime >= target.endTime)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{t('courses.create.schedule.title')}</Label>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" />
          {t('courses.create.schedule.add')}
        </Button>
      </div>

      {value.length === 0 && (
        <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Sin bloques. Agregá al menos uno.
        </div>
      )}

      <div className="space-y-2">
        {value.map((row, i) => {
          const conflict = hasConflict(row, i)
          const invalidTime = row.startTime >= row.endTime
          return (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border p-2">
              <div className="min-w-[120px] flex-1">
                <Label className="text-xs">{t('courses.create.schedule.day')}</Label>
                <Select
                  value={String(row.day)}
                  onValueChange={(v) => update(i, { day: Number(v) as ScheduleEntry['day'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {t(d.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[100px] flex-1">
                <Label className="text-xs">{t('courses.create.schedule.startTime')}</Label>
                <Input
                  type="time"
                  value={row.startTime}
                  onChange={(e) => update(i, { startTime: e.target.value })}
                />
              </div>
              <div className="min-w-[100px] flex-1">
                <Label className="text-xs">{t('courses.create.schedule.endTime')}</Label>
                <Input
                  type="time"
                  value={row.endTime}
                  onChange={(e) => update(i, { endTime: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(i)}
                aria-label={t('courses.create.schedule.remove')}
              >
                <X className="h-4 w-4" />
              </Button>
              {(conflict || invalidTime) && (
                <div className="basis-full text-xs text-destructive">
                  {invalidTime
                    ? 'La hora de fin debe ser posterior a la de inicio'
                    : 'Hay un solapamiento con otro bloque del mismo día'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
