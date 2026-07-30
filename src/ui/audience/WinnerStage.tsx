import type {
  PublicAudienceConfirmedScenario,
  PublicAudienceWinnerRevealScenario,
} from '../../prototype/audience-types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { DisplayStateLabel } from './DisplayStateLabel.tsx'
import { EventBrand } from './EventBrand.tsx'
import { WinnerGrid } from './WinnerGrid.tsx'

interface WinnerStageProps {
  scenario:
    | PublicAudienceWinnerRevealScenario
    | PublicAudienceConfirmedScenario
}

export function WinnerStage({ scenario }: WinnerStageProps) {
  const confirmed = scenario.state === 'confirmed'

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
        count={scenario.layoutCount}
        ticketNumbers={scenario.ticketNumbers}
      />
      <DisplayStateLabel
        tone={confirmed ? 'confirmed' : 'verification'}
      >
        {scenario.statusMessage}
      </DisplayStateLabel>
    </AudienceStage>
  )
}
