import { useFormContext, FormProvider, type UseFormReturn, type FieldValues } from 'react-hook-form'
import type { ReactNode } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { SubmitButtonProps, FormErrorProps } from './Form.types'

/**
 * <Form> wrapper. Pass the `useForm` return value and the children
 * get access to the form context (errors, watch, setValue, etc.).
 */
export function Form<T extends FieldValues>(props: {
  form: UseFormReturn<T>
  onSubmit: (values: T) => void | Promise<void>
  children: ReactNode
  className?: string
}) {
  const { form, onSubmit, children, className } = props
  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className={className}
        aria-label="form"
      >
        {children}
      </form>
    </FormProvider>
  )
}

// Note: the shadcn FormField primitives (FormField, FormItem, etc.) are
// imported directly from `@/components/ui/form` in feature code. This
// file is only the project-level helpers (Form, SubmitButton, FormError).

/**
 * Submit button wired to the form's `isSubmitting` state. Disables
 * itself while the mutation is in flight to prevent double-submits.
 */
export function SubmitButton({
  label,
  submittingLabel,
  icon,
  type = 'submit',
  ...rest
}: SubmitButtonProps) {
  const { formState } = useFormContext()
  const isSubmitting = formState.isSubmitting
  return (
    <Button type={type} disabled={isSubmitting} {...rest}>
      {isSubmitting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {submittingLabel ?? label}
        </>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </Button>
  )
}

/**
 * Top-level error display (e.g. an API failure that isn't a field
 * error). Pass a translation key; the component looks it up in i18n.
 */
export function FormError({ title = 'Error', message, fieldErrors }: FormErrorProps) {
  if (!message && (!fieldErrors || fieldErrors.length === 0)) return null
  return (
    <Alert variant="destructive" className="my-2">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {message && <p>{message}</p>}
        {fieldErrors && fieldErrors.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm">
            {fieldErrors.map((fe, i) => (
              <li key={`${fe.field}-${i}`}>
                <span className="font-medium">{fe.field}:</span> {fe.message}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  )
}
