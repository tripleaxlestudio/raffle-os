import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { DisplayStateLabel } from './DisplayStateLabel.tsx'
import { EventBrand } from './EventBrand.tsx'

interface RollingStageProps {
  scenario: PublicAudienceScenario
}

export function RollingStage({ scenario }: RollingStageProps) {
  return (
    <AudienceStage className="rolling-stage" state={scenario.state}>
      <EventBrand
        compact
        eventName={scenario.eventName}
        eventSubtitle={scenario.eventSubtitle}
      />
      <div className="rolling-stage__content">
        <p className="audience-eyebrow">
          {scenario.prizeCategory} · {scenario.prizeLabel}
        </p>
        <h1>{scenario.message ?? 'Drawing in progress'}</h1>
        <ul
          aria-label="Presentational ticket stream"
          className="rolling-ticket-stream"
          data-prototype-static={scenario.prototypeStatic ? 'true' : undefined}
        >
          {(scenario.ticketNumbers ?? []).map((ticketNumber) => (
            <li className="rolling-ticket" key={ticketNumber}>
              <span>{ticketNumber}</span>
            </li>
          ))}
        </ul>
      </div>
      <DisplayStateLabel>Presentation preview</DisplayStateLabel>
    </AudienceStage>
  )
}
