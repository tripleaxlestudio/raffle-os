import type { HTMLAttributes } from 'react'
import { joinClassNames } from './class-names.ts'

type CardElement = 'article' | 'div' | 'section'
type CardTone = 'default' | 'raised' | 'accent' | 'warning'

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
  return (
    <Component
      className={joinClassNames(
        'ui-card',
        `ui-card--${tone}`,
        `ui-card--padding-${padding}`,
        className,
      )}
      {...props}
    />
  )
}
