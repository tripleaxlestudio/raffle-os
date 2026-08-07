import { useEffect, useState } from 'react'
import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { DisplayStateLabel } from './DisplayStateLabel.tsx'
import { EventBrand } from './EventBrand.tsx'
import { WinnerGrid } from './WinnerGrid.tsx'
import { SEQUENTIAL_REVEAL_INTERVAL_MS, visibleWinnerCount } from './sequential-reveal.ts'

interface WinnerStageProps {
  scenario:
    PublicAudienceScenario
}

export function WinnerStage({ scenario }: WinnerStageProps) {
  const confirmed = scenario.state === 'confirmed'
  const count = Math.max(1, scenario.layoutCount ?? scenario.ticketNumbers?.length ?? 1)
  const sequential = scenario.state === 'reveal' && scenario.revealMode === 'sequential' && count > 1
  const [visibleCount, setVisibleCount] = useState(() => sequential ? visibleWinnerCount(scenario.revealStartedAt, count) : count)

  useEffect(() => {
    if (!sequential) return
    let timer: number | undefined
    const update = () => {
      const visible = visibleWinnerCount(scenario.revealStartedAt, count)
      setVisibleCount(visible)
      if (visible < count) timer = globalThis['setTimeout'](update, SEQUENTIAL_REVEAL_INTERVAL_MS)
    }
    update()
    return () => { if (timer !== undefined) globalThis['clearTimeout'](timer) }
  }, [count, scenario.revealStartedAt, sequential])

  return (
    <AudienceStage className="winner-stage" state={scenario.state}>
      <header className="winner-stage__header">
        <EventBrand
          compact
          eventName={scenario.eventName}
          eventSubtitle={scenario.eventSubtitle}
        />
        <div className="winner-stage__prize">
          <p>{scenario.prizeCategory}</p>
          <h1>{scenario.prizeLabel}</h1>
        </div>
      </header>
      <WinnerGrid
        confirmed={confirmed}
        count={count}
        ticketNumbers={scenario.ticketNumbers ?? []}
        visibleCount={sequential ? visibleCount : count}
      />
      <DisplayStateLabel
        tone={confirmed ? 'confirmed' : 'verification'}
      >
        {scenario.statusMessage ?? 'Public result'}
      </DisplayStateLabel>
    </AudienceStage>
  )
}
