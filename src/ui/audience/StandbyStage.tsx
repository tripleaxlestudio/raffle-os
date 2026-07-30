import type { PublicAudienceStandbyScenario } from '../../prototype/audience-types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { EventBrand } from './EventBrand.tsx'

interface StandbyStageProps {
  scenario: PublicAudienceStandbyScenario
}

export function StandbyStage({ scenario }: StandbyStageProps) {
  return (
    <AudienceStage className="standby-stage" state={scenario.state}>
      <EventBrand
        eventName={scenario.eventName}
        eventSubtitle={scenario.eventSubtitle}
      />
      <div className="standby-stage__message">
        <p className="audience-eyebrow">Next draw</p>
        <h1>{scenario.message}</h1>
        <p className="audience-prize">
          <span>{scenario.prizeCategory}</span>
          <strong>{scenario.prizeLabel}</strong>
        </p>
      </div>
      <div aria-hidden="true" className="audience-safe-area-markers" />
    </AudienceStage>
  )
}
