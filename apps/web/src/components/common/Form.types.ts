import type { ReactNode } from 'react'
import type { ButtonProps } from '@/components/ui/button'

export interface SubmitButtonProps extends Omit<ButtonProps, 'type' | 'disabled'> {
  label: string
  submittingLabel?: string
  /** Optional icon shown next to the label. */
  icon?: ReactNode
  type?: 'submit' | 'button' | 'reset'
}

export interface FormErrorProps {
  title?: string
  message?: string
  fieldErrors?: Array<{ field: string; message: string }>
}
