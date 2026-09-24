import { useUiClass } from '../ui/ui-theme.ts'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  actions?: ReactNode
  description: string
  eyebrow?: string
  headingId?: string
  title: string
}

export function PageHeader({
  actions,
  description,
  eyebrow,
  headingId,
  title,
}: PageHeaderProps) {
  const ui = useUiClass()
  return (
    <div className={ui("page-header")}>
      <div className={ui("page-header__copy")}>
        {eyebrow === undefined ? null : (
          <p className={ui("page-header__eyebrow")}>{eyebrow}</p>
        )}
        <h1 id={headingId}>{title}</h1>
        <p className={ui("page-header__description")}>{description}</p>
      </div>
      {actions === undefined ? null : (
        <div className={ui("page-header__actions")}>{actions}</div>
      )}
    </div>
  )
}
