import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { EventBrand } from './EventBrand.tsx'

interface StandbyStageProps {
  scenario: PublicAudienceScenario
}

export function StandbyStage({ scenario }: StandbyStageProps) {
  return (
    <AudienceStage className="standby-stage" state={scenario.state}>
      <EventBrand
        eventName={scenario.eventName}
        eventSubtitle={scenario.eventSubtitle}
        logo={scenario.logo}
      />
      <div className="standby-stage__message">
        {scenario.displayTest ? <p className="audience-test-badge" role="status">DISPLAY TEST · NOT AN OFFICIAL DRAW</p> : null}
        <p className="audience-eyebrow">Next draw</p>
        <h1>{scenario.message ?? 'Draw will begin shortly'}</h1>
        <p className="audience-prize">
          <span>{scenario.prizeCategory}</span>
          <strong>{scenario.prizeLabel}</strong>
        </p>
      </div>
      <div aria-hidden="true" className="audience-safe-area-markers" />
    </AudienceStage>
  )
}
