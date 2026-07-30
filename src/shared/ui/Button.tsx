import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { joinClassNames } from './class-names.ts'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

function buttonClassName({
  className,
  size,
  variant,
}: {
  className?: string
  size: ButtonSize
  variant: ButtonVariant
}) {
  return joinClassNames(
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    className,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  size?: ButtonSize
  variant?: ButtonVariant
}

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={isLoading || undefined}
      className={buttonClassName({ className, size, variant })}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? (
        <span aria-hidden="true" className="ui-button__spinner" />
      ) : null}
      <span>{children}</span>
    </button>
  )
}

interface ButtonLinkProps
  extends Omit<LinkProps, 'children' | 'className'> {
  children: ReactNode
  className?: string
  size?: ButtonSize
  variant?: ButtonVariant
}

export function ButtonLink({
  children,
  className,
  size = 'md',
  variant = 'primary',
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName({ className, size, variant })}
      {...props}
    >
      <span>{children}</span>
    </Link>
  )
}
