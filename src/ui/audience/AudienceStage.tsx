import type { ReactNode } from 'react'
import type { PublicAudienceScenario } from '../../prototype/audience-types.ts'

interface AudienceStageProps {
  children: ReactNode
  className?: string
  state: PublicAudienceScenario['state']
}

export function AudienceStage({
  children,
  className,
  state,
}: AudienceStageProps) {
  const classes = ['audience-stage', `audience-stage--${state}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={classes}
      data-audience-state={state}
      data-safe-area
    >
      {children}
    </section>
  )
}
