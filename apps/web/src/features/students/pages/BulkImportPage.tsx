import { BulkImportDialog } from '@/features/students/components/BulkImportDialog'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Standalone page that hosts the bulk student import dialog. Reached
 * via /students/bulk. The dialog is opened on mount so the user
 * lands directly in the import flow. A "back to students" link
 * keeps navigation explicit.
 */
export function BulkImportPage() {
  const [open, setOpen] = useState(true)

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" aria-hidden="true" />
            Importar estudiantes
          </CardTitle>
          <CardDescription>
            Subí un archivo CSV con los datos de tus estudiantes. Podés importar hasta 5000 filas
            por archivo. Para archivos más grandes, el procesamiento se hace en segundo plano.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Seleccionar archivo CSV
          </Button>
        </CardContent>
      </Card>

      <BulkImportDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
