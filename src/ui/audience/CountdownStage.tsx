import type { PublicAudienceCountdownScenario } from '../../prototype/audience-types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { EventBrand } from './EventBrand.tsx'

interface CountdownStageProps {
  scenario: PublicAudienceCountdownScenario
}

export function CountdownStage({ scenario }: CountdownStageProps) {
  return (
    <AudienceStage className="countdown-stage" state={scenario.state}>
      <EventBrand
        compact
        eventName={scenario.eventName}
        eventSubtitle={scenario.eventSubtitle}
      />
      <div
        className="countdown-stage__content"
        data-prototype-static="true"
      >
        <p className="audience-eyebrow">
          {scenario.prizeCategory} · {scenario.prizeLabel}
        </p>
        <h1>{scenario.message}</h1>
        <p
          aria-label={`Static countdown value: ${scenario.countdownValue}`}
          className="countdown-stage__numeral"
        >
          {scenario.countdownValue}
        </p>
      </div>
    </AudienceStage>
  )
}
