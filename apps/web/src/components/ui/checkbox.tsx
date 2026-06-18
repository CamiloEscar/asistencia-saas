import * as React from 'react'
import { cn } from '@/lib/utils'

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>

/**
 * Plain checkbox. The native `<input type="checkbox">` is fully
 * accessible and we only need to make it match the rest of the form
 * primitives visually.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        'h-4 w-4 shrink-0 rounded-sm border border-input bg-background text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
