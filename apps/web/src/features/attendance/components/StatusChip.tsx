import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, CheckCheck, FileUp, Trash2, X } from 'lucide-react'
import type { AttendanceStatus } from '@asistencia/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { RosterEntry } from '../api/attendance.api'

const VARIANTS: Record<
  AttendanceStatus,
  { selected: string; idle: string; icon: React.ReactNode }
> = {
  PRESENT: {
    selected:
      'bg-green-500 text-white border-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700',
    idle: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800',
    icon: <Check className="h-3 w-3" />,
  },
  ABSENT: {
    selected:
      'bg-red-500 text-white border-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700',
    idle: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
    icon: <X className="h-3 w-3" />,
  },
  LATE: {
    selected:
      'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700',
    idle: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
    icon: <CheckCheck className="h-3 w-3" />,
  },
  JUSTIFIED: {
    selected:
      'bg-blue-500 text-white border-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700',
    idle: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    icon: <FileUp className="h-3 w-3" />,
  },
}

interface StatusChipProps {
  status: AttendanceStatus
  selected: boolean
  onClick: () => void
  hasJustification?: boolean
  ariaLabel: string
}

/**
 * Status chip for the attendance roster. Clickable, color-coded, with
 * a small dot/badge when justification is attached.
 */
export function StatusChip({
  status,
  selected,
  onClick,
  hasJustification,
  ariaLabel,
}: StatusChipProps) {
  const { t } = useTranslation()
  const v = VARIANTS[status]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        selected ? v.selected : v.idle,
      )}
    >
      {v.icon}
      <span>{t(`attendanceStatus.${status}`)}</span>
      {hasJustification && (
        <Tooltip content="Tiene justificación">
          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
        </Tooltip>
      )}
    </button>
  )
}

interface RosterRowProps {
  student: { id: string; fullName: string; legajo?: string | null }
  entry: RosterEntry
  onStatusChange: (status: AttendanceStatus) => void
  onJustification: () => void
  onEvidence: (file: File | undefined) => void
  editing?: boolean
}

export function RosterRow({
  student,
  entry,
  onStatusChange,
  onJustification,
  onEvidence,
}: RosterRowProps) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const hasJustification = !!entry.justificationText
  const evidencePreview = entry.evidenceFile?.name

  return (
    <tr className="border-b">
      <td className="p-3">
        <div className="text-sm font-medium">{student.fullName}</div>
        <div className="text-xs text-muted-foreground">{student.legajo ?? '—'}</div>
      </td>
      <td className="p-3">
        <div className="flex flex-wrap gap-1">
          {(['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED'] as AttendanceStatus[]).map((s) => (
            <StatusChip
              key={s}
              status={s}
              selected={entry.status === s}
              onClick={() => onStatusChange(s)}
              hasJustification={entry.status === s && hasJustification}
              ariaLabel={t(`attendanceStatus.${s}`)}
            />
          ))}
        </div>
      </td>
      <td className="hidden p-3 sm:table-cell">
        {(entry.status === 'LATE' || entry.status === 'JUSTIFIED') && (
          <button
            type="button"
            onClick={onJustification}
            className="text-xs text-primary hover:underline"
          >
            {hasJustification ? entry.justificationText : 'Agregar justificación'}
          </button>
        )}
      </td>
      <td className="p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => onEvidence(e.target.files?.[0])}
        />
        {evidencePreview ? (
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs">
              <FileUp className="mr-1 h-3 w-3" />
              {evidencePreview}
            </Badge>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => {
                if (fileRef.current) fileRef.current.value = ''
                onEvidence(undefined)
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className="mr-1 h-3 w-3" />
            Evidencia
          </Button>
        )}
      </td>
    </tr>
  )
}
