import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { DisplayStateLabel } from './DisplayStateLabel.tsx'
import { EventBrand } from './EventBrand.tsx'
import { WinnerGrid } from './WinnerGrid.tsx'

interface WinnerStageProps {
  scenario:
    PublicAudienceScenario
}

export function WinnerStage({ scenario }: WinnerStageProps) {
  const confirmed = scenario.state === 'confirmed'
  const count = scenario.layoutCount ?? scenario.ticketNumbers?.length ?? 1

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
        count={count === 6 || count === 10 || count === 20 ? count : 1}
        ticketNumbers={scenario.ticketNumbers ?? []}
      />
      <DisplayStateLabel
        tone={confirmed ? 'confirmed' : 'verification'}
      >
        {scenario.statusMessage ?? 'Public result'}
      </DisplayStateLabel>
    </AudienceStage>
  )
}
