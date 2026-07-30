import type { HTMLAttributes } from 'react'
import { joinClassNames } from './class-names.ts'

export type BadgeVariant =
  | 'neutral'
  | 'practice'
  | 'live'
  | 'pending'
  | 'confirmed'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  indicator?: boolean
  variant?: BadgeVariant
}

export function Badge({
  children,
  className,
  indicator = false,
  variant = 'neutral',
  ...props
}: BadgeProps) {
  return (
    <span
      className={joinClassNames(
        'ui-badge',
        `ui-badge--${variant}`,
        className,
      )}
      data-indicator={indicator || undefined}
      {...props}
    >
      {children}
    </span>
  )
}
