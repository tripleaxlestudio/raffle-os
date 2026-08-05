import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { EventBrand } from './EventBrand.tsx'

interface CountdownStageProps {
  scenario: PublicAudienceScenario
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
        data-prototype-static={scenario.prototypeStatic ? 'true' : undefined}
      >
        <p className="audience-eyebrow">
          {scenario.prizeCategory} · {scenario.prizeLabel}
        </p>
        <h1>{scenario.message}</h1>
        <p
          aria-label={`Static countdown value: ${scenario.countdownValue ?? '—'}`}
          className="countdown-stage__numeral"
        >
          {scenario.countdownValue ?? '—'}
        </p>
      </div>
    </AudienceStage>
  )
}
