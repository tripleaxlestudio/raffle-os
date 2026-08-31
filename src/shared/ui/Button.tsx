import { themeClass, useUiTheme, type UiTheme } from './ui-theme.ts'
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Link, type LinkProps } from 'react-router'
import { joinClassNames } from './class-names.ts'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'success'
export type ButtonSize = 'sm' | 'md' | 'lg'

function buttonClassName({
  className,
  theme,
  square,
  size,
  variant,
}: {
  className?: string
  theme: UiTheme
  square: boolean
  size: ButtonSize
  variant: ButtonVariant
}) {
  return joinClassNames(
    themeClass(theme, 'ui-button'),
    themeClass(theme, `ui-button--${variant}`),
    themeClass(theme, `ui-button--${size}`),
    square && themeClass(theme, 'ui-button--square'),
    className,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  square?: boolean
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
      square = false,
      type = 'button',
      variant = 'primary',
      ...props
    },
    ref,
  ) {
    const theme = useUiTheme()
    return (
      <button
        aria-busy={isLoading || undefined}
        className={buttonClassName({ className, size, variant, theme, square })}
        disabled={disabled || isLoading}
        ref={ref}
        type={type}
        {...props}
      >
        {isLoading ? (
          <span aria-hidden="true" className={themeClass(theme, "ui-button__spinner")} />
        ) : null}
        {!isLoading && icon !== undefined && !iconAfter ? (
          <span aria-hidden="true" className={themeClass(theme, "ui-button__icon")}>
            {icon}
          </span>
        ) : null}
        {square && children === undefined ? null : <span>{children}</span>}
        {!isLoading && icon !== undefined && iconAfter ? (
          <span aria-hidden="true" className={themeClass(theme, "ui-button__icon")}>
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
  square?: boolean
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
  square = false,
  variant = 'primary',
  ...props
}: ButtonLinkProps) {
  const theme = useUiTheme()
  return (
    <Link
      className={buttonClassName({ className, size, variant, theme, square })}
      {...props}
    >
      {icon === undefined || iconAfter ? null : (
        <span aria-hidden="true" className={themeClass(theme, "ui-button__icon")}>
          {icon}
        </span>
      )}
      <span>{children}</span>
      {icon === undefined || !iconAfter ? null : (
        <span aria-hidden="true" className={themeClass(theme, "ui-button__icon")}>
          {icon}
        </span>
      )}
    </Link>
  )
}
