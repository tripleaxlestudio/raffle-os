import { useId, type ReactNode } from 'react'
import { Badge, type BadgeVariant } from '../ui/index.ts'

type StatusBannerTone = 'success' | 'warning' | 'info'

interface StatusBannerProps {
  badge: string
  children: ReactNode
  className?: string
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
  title,
  tone,
}: StatusBannerProps) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={`status-banner status-banner--${tone}${className === undefined ? '' : ` ${className}`}`}
    >
      <span aria-hidden="true" className="status-banner__marker" />
      <div className="status-banner__copy">
        <div className="status-banner__heading">
          <h2 id={titleId}>{title}</h2>
          <Badge variant={badgeVariants[tone]}>{badge}</Badge>
        </div>
        <p>{children}</p>
      </div>
    </section>
  )
}
