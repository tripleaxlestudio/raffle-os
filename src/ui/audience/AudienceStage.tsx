import type { ReactNode } from 'react'
import type { AudienceViewState } from './audience-view.types.ts'

interface AudienceStageProps {
  children: ReactNode
  className?: string
  state: AudienceViewState
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
