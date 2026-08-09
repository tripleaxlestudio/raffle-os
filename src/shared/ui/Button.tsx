import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
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
  icon?: ReactNode
  iconAfter?: boolean
  isLoading?: boolean
  size?: ButtonSize
  variant?: ButtonVariant
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      className,
      disabled,
      icon,
      iconAfter = false,
      isLoading = false,
      size = 'md',
      type = 'button',
      variant = 'primary',
      ...props
    },
    ref,
  ) {
    return (
      <button
        aria-busy={isLoading || undefined}
        className={buttonClassName({ className, size, variant })}
        disabled={disabled || isLoading}
        ref={ref}
        type={type}
        {...props}
      >
        {isLoading ? (
          <span aria-hidden="true" className="ui-button__spinner" />
        ) : null}
        {!isLoading && icon !== undefined && !iconAfter ? (
          <span aria-hidden="true" className="ui-button__icon">
            {icon}
          </span>
        ) : null}
        <span>{children}</span>
        {!isLoading && icon !== undefined && iconAfter ? (
          <span aria-hidden="true" className="ui-button__icon">
            {icon}
          </span>
        ) : null}
      </button>
    )
  },
)

interface ButtonLinkProps
  extends Omit<LinkProps, 'children' | 'className'> {
  children: ReactNode
  className?: string
  icon?: ReactNode
  iconAfter?: boolean
  size?: ButtonSize
  variant?: ButtonVariant
}

export function ButtonLink({
  children,
  className,
  icon,
  iconAfter = false,
  size = 'md',
  variant = 'primary',
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName({ className, size, variant })}
      {...props}
    >
      {icon === undefined || iconAfter ? null : (
        <span aria-hidden="true" className="ui-button__icon">
          {icon}
        </span>
      )}
      <span>{children}</span>
      {icon === undefined || !iconAfter ? null : (
        <span aria-hidden="true" className="ui-button__icon">
          {icon}
        </span>
      )}
    </Link>
  )
}
