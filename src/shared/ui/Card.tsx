import { useUiClass } from './ui-theme.ts'
import type { HTMLAttributes } from 'react'
import { joinClassNames } from './class-names.ts'

type CardElement = 'article' | 'div' | 'section'
type CardTone =
  | 'default'
  | 'raised'
  | 'interactive'
  | 'accent'
  | 'warning'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardElement
  padding?: 'none' | 'sm' | 'md' | 'lg'
  tone?: CardTone
}

export function Card({
  as: Component = 'section',
  className,
  padding = 'md',
  tone = 'default',
  ...props
}: CardProps) {
  const ui = useUiClass()
  return (
    <Component
      className={joinClassNames(
        ui('ui-card'),
        ui(`ui-card--${tone}`),
        ui(`ui-card--padding-${padding}`),
        className,
      )}
      {...props}
    />
  )
}
