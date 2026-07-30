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
  return (
    <div className="page-header">
      <div className="page-header__copy">
        {eyebrow === undefined ? null : (
          <p className="page-header__eyebrow">{eyebrow}</p>
        )}
        <h1 id={headingId}>{title}</h1>
        <p className="page-header__description">{description}</p>
      </div>
      {actions === undefined ? null : (
        <div className="page-header__actions">{actions}</div>
      )}
    </div>
  )
}
