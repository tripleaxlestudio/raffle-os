import { useUiClass } from '../ui/ui-theme.ts'
import { useId, type ReactNode } from 'react'
import { Badge, type BadgeVariant } from '../ui/index.ts'

type StatusBannerTone = 'success' | 'warning' | 'info'

interface StatusBannerProps {
  badge: string
  children: ReactNode
  className?: string
  icon?: ReactNode
  title: string
  tone: StatusBannerTone
}

const badgeVariants: Record<StatusBannerTone, BadgeVariant> = {
  success: 'success',
  warning: 'warning',
  info: 'info',
}

export function StatusBanner({
  badge,
  children,
  className,
  icon,
  title,
  tone,
}: StatusBannerProps) {
  const ui = useUiClass()
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={`${ui(`status-banner status-banner--${tone}`)}${className === undefined ? '' : ` ${className}`}`}
    >
      <span aria-hidden="true" className={ui("status-banner__marker")}>{icon}</span>
      <div className={ui("status-banner__copy")}>
        <div className={ui("status-banner__heading")}>
          <h2 id={titleId}>{title}</h2>
          <Badge variant={badgeVariants[tone]}>{badge}</Badge>
        </div>
        <p>{children}</p>
      </div>
    </section>
  )
}
