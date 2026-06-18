import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp, Loader2, Upload, X } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from '@/components/ui'
import { useToast } from '@/hooks/use-toast'
import type { Course } from '@asistencia/shared'
import { useBulkImport, useBulkJobStatus } from '../api/students.api'
import { useListCourses } from '@/features/courses/api/courses.api'

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [dryRun, setDryRun] = useState(true)
  const [courseId, setCourseId] = useState<string>('')
  const [result, setResult] = useState<ReturnType<typeof useBulkImport>['data'] | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const importMutation = useBulkImport()
  const jobStatus = useBulkJobStatus(jobId)
  const coursesQuery = useListCourses({ limit: 100 })

  function reset() {
    setFile(null)
    setDryRun(true)
    setCourseId('')
    setResult(null)
    setJobId(null)
  }

  async function handleSubmit() {
    if (!file) {
      toast.warning('Seleccioná un archivo CSV')
      return
    }
    try {
      const res = await importMutation.mutateAsync({
        file,
        dryRun,
        courseId: courseId || undefined,
      })
      setResult(res)
      if (res.jobId) {
        setJobId(res.jobId)
        toast.info(t('students.bulk.async', { jobId: res.jobId }))
      } else {
        toast.success(t('students.bulk.success'))
      }
    } catch (err) {
      toast.errorFromApi(err, 'errors:generic')
    }
  }

  // Auto-update result when polling returns a new payload.
  if (
    jobStatus.data &&
    jobStatus.data.jobId === jobId &&
    result?.status !== jobStatus.data.status
  ) {
    setResult(jobStatus.data)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('students.bulk.title')}</DialogTitle>
          <DialogDescription>{t('students.bulk.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          <div>
            <Label className="text-sm font-medium">Archivo CSV</Label>
            {file ? (
              <div className="mt-1 flex items-center gap-2 rounded-md border p-2">
                <FileUp className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(file.size / 1024)} KB
                </span>
                <Button size="sm" variant="ghost" type="button" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/30">
                <Upload className="h-5 w-5" />
                <span>{t('students.bulk.dropzone')}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{t('students.bulk.format')}</p>
          </div>

          {/* Course selector */}
          <div>
            <Label className="text-sm font-medium">{t('students.bulk.courseId')}</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t('students.bulk.noCourse')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t('students.bulk.noCourse')}</SelectItem>
                {(coursesQuery.data?.data ?? []).map((c: Course) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dry-run toggle */}
          <label className="flex items-start gap-3 rounded-md border p-3">
            <Switch checked={dryRun} onCheckedChange={setDryRun} />
            <div>
              <div className="text-sm font-medium">{t('students.bulk.dryRun')}</div>
              <p className="text-xs text-muted-foreground">{t('students.bulk.dryRunHelp')}</p>
            </div>
          </label>

          {/* Result */}
          {result && (
            <div className="rounded-md border bg-muted/30 p-3">
              <h3 className="text-sm font-semibold">{t('students.bulk.result.title')}</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label={t('students.bulk.preview.valid')} value={result.validRows} />
                <Stat label={t('students.bulk.preview.willSkip')} value={result.willSkip} />
                <Stat
                  label={t('students.bulk.result.created')}
                  value={
                    'created' in result ? ((result as { created?: number }).created ?? 0) : '—'
                  }
                />
                <Stat label={t('students.bulk.result.errors')} value={result.errors?.length ?? 0} />
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-3 max-h-48 overflow-auto rounded border bg-background">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">{t('students.bulk.errorsTable.row')}</th>
                        <th className="p-2 text-left">{t('students.bulk.errorsTable.field')}</th>
                        <th className="p-2 text-left">{t('students.bulk.errorsTable.message')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{e.row}</td>
                          <td className="p-2">{e.field ?? '—'}</td>
                          <td className="p-2">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!file || importMutation.isPending}>
            {importMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('students.bulk.submitting')}
              </>
            ) : (
              t('students.bulk.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}
