import type { PublicAudienceDisconnectedScenario } from '../../prototype/audience-types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { EventBrand } from './EventBrand.tsx'

interface DisconnectedStageProps {
  scenario: PublicAudienceDisconnectedScenario
}

export function DisconnectedStage({
  scenario,
}: DisconnectedStageProps) {
  return (
    <AudienceStage
      className="disconnected-stage"
      state={scenario.state}
    >
      <EventBrand
        compact
        eventName={scenario.eventName}
        eventSubtitle={scenario.eventSubtitle}
      />
      <div className="disconnected-stage__message" role="status">
        <span
          aria-hidden="true"
          className="disconnected-stage__marker"
        />
        <p className="audience-eyebrow">Display status</p>
        <h1>{scenario.message}</h1>
        <p>{scenario.instruction}</p>
      </div>
    </AudienceStage>
  )
}
