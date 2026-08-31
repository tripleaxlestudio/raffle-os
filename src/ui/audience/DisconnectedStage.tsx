import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { EventBrand } from './EventBrand.tsx'

interface DisconnectedStageProps {
  scenario: PublicAudienceScenario
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
        <p className="audience-eyebrow">Status tampilan</p>
        <h1>{scenario.message ?? 'Koneksi tampilan terputus'}</h1>
        <p>{scenario.instruction ?? 'Silakan tunggu Operator.'}</p>
      </div>
    </AudienceStage>
  )
}
