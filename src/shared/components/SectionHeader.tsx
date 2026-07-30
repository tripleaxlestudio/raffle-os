import type { ReactNode } from 'react'
import { joinClassNames } from '../ui/class-names.ts'

type SectionHeadingLevel = 2 | 3 | 4

interface SectionHeaderProps {
  actions?: ReactNode
  className?: string
  description?: string
  eyebrow?: string
  headingLevel?: SectionHeadingLevel
  title: string
}

function SectionHeading({
  level,
  title,
}: {
  level: SectionHeadingLevel
  title: string
}) {
  switch (level) {
    case 3:
      return <h3>{title}</h3>
    case 4:
      return <h4>{title}</h4>
    case 2:
      return <h2>{title}</h2>
  }
}

export function SectionHeader({
  actions,
  className,
  description,
  eyebrow,
  headingLevel = 2,
  title,
}: SectionHeaderProps) {
  return (
    <div className={joinClassNames('section-header', className)}>
      <div className="section-header__copy">
        {eyebrow === undefined ? null : (
          <p className="section-header__eyebrow">{eyebrow}</p>
        )}
        <SectionHeading level={headingLevel} title={title} />
        {description === undefined ? null : (
          <p className="section-header__description">{description}</p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="section-header__actions">{actions}</div>
      )}
    </div>
  )
}
