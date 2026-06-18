import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Save, Users } from 'lucide-react'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { useToast } from '@/hooks/use-toast'
import { AttendanceStatus } from '@asistencia/shared'
import {
  useRosterState,
  useMarkAttendance,
  useUpdateAttendance,
  useUploadEvidence,
  type RosterResponse,
} from '../api/attendance.api'
import { RosterRow } from './StatusChip'
import { JustificationModal } from './JustificationModal'

interface AttendanceRosterProps {
  sessionId: string
  roster: RosterResponse
  isEdit: boolean
  onSubmitted?: () => void
}

/**
 * The core roster UI. The teacher sees a list of enrolled students,
 * clicks a status chip to set their state, optionally adds a
 * justification for LATE/JUSTIFIED, and optionally attaches evidence.
 * "Guardar" submits the whole batch to POST /sessions/:id/attendance
 * (or PATCH for edit-mode same-day).
 */
export function AttendanceRoster({
  sessionId,
  roster,
  isEdit,
  onSubmitted,
}: AttendanceRosterProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { entries, setStatus, setJustification, setEvidence, setAll, clear } = useRosterState(
    roster.students,
  )
  const mark = useMarkAttendance()
  const update = useUpdateAttendance()
  const uploadEvidence = useUploadEvidence(sessionId)

  const [justOpen, setJustOpen] = useState(false)
  const [justTarget, setJustTarget] = useState<string | null>(null)

  function _cycleStatus(studentId: string) {
    const cur = entries.get(studentId)?.status ?? ('PRESENT' as AttendanceStatus)
    const order: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'JUSTIFIED']
    const idx = order.indexOf(cur)
    const next = order[(idx + 1) % order.length] as AttendanceStatus
    setStatus(studentId, next)
    if (next === 'LATE' || next === 'JUSTIFIED') {
      setJustTarget(studentId)
      setJustOpen(true)
    }
  }

  function handleStatusChange(studentId: string, next: AttendanceStatus) {
    setStatus(studentId, next)
    if (next === 'LATE' || next === 'JUSTIFIED') {
      setJustTarget(studentId)
      setJustOpen(true)
    }
  }

  async function handleSubmit() {
    const records = Array.from(entries.values()).map((e) => ({
      studentId: e.studentId,
      status: e.status,
      justificationText: e.justificationText,
    }))
    const mutation = isEdit ? update : mark
    try {
      const result = await mutation.mutateAsync({
        sessionId,
        payload: { records },
      })
      // Upload evidence sequentially (best-effort)
      const evidences = Array.from(entries.values()).filter((e) => e.evidenceFile)
      for (const e of evidences) {
        if (e.evidenceFile) {
          // Use a deterministic id from the server (if returned)
          // For MVP we associate the evidence to a virtual recordId using the studentId.
          try {
            await uploadEvidence.mutateAsync({
              recordId: e.studentId,
              file: e.evidenceFile,
            })
          } catch {
            // ignore — evidence upload is best-effort
          }
        }
      }
      if (result.errors && result.errors.length > 0) {
        toast.warning(t('attendance.take.partial'))
      } else {
        toast.success(t('attendance.take.success'))
      }
      onSubmitted?.()
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  const counts = {
    present: Array.from(entries.values()).filter((e) => e.status === 'PRESENT').length,
    absent: Array.from(entries.values()).filter((e) => e.status === 'ABSENT').length,
    late: Array.from(entries.values()).filter((e) => e.status === 'LATE').length,
    justified: Array.from(entries.values()).filter((e) => e.status === 'JUSTIFIED').length,
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t('attendance.take.summary', counts)}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setAll('PRESENT')}>
              {t('attendance.take.markAll.present')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAll('ABSENT')}>
              {t('attendance.take.markAll.absent')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => clear()}>
              {t('attendance.take.markAll.clear')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Roster table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('attendance.take.roster')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden sm:table-cell">Justificación</TableHead>
                <TableHead>Evidencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roster.students.map((s) => {
                const entry = entries.get(s.id)!
                return (
                  <RosterRow
                    key={s.id}
                    student={s}
                    entry={entry}
                    onStatusChange={(next) => handleStatusChange(s.id, next)}
                    onJustification={() => {
                      setJustTarget(s.id)
                      setJustOpen(true)
                    }}
                    onEvidence={(file) => setEvidence(s.id, file)}
                  />
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Submit button */}
      <div className="flex justify-end">
        <Button size="lg" onClick={handleSubmit} disabled={mark.isPending || update.isPending}>
          {mark.isPending || update.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('attendance.take.submitting')}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {t('attendance.take.submit')}
            </>
          )}
        </Button>
      </div>

      {/* Justification modal */}
      <JustificationModal
        open={justOpen}
        onOpenChange={setJustOpen}
        initialStatus={
          (entries.get(justTarget ?? '')?.status as 'LATE' | 'JUSTIFIED') ?? AttendanceStatus.LATE
        }
        onSave={(text) => {
          if (justTarget) setJustification(justTarget, text)
          setJustOpen(false)
        }}
        onCancel={() => {
          // revert to PRESENT if no justification
          if (justTarget) {
            const cur = entries.get(justTarget)
            if (
              cur &&
              (cur.status === 'LATE' || cur.status === 'JUSTIFIED') &&
              !cur.justificationText
            ) {
              setStatus(justTarget, 'PRESENT')
            }
          }
          setJustOpen(false)
        }}
      />
    </div>
  )
}
