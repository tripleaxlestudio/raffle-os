import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { AudienceDrawHeader } from './AudienceDrawHeader.tsx'

export function CountdownStage({ scenario }: { readonly scenario: PublicAudienceScenario }) {
  return <AudienceStage className="countdown-stage" state={scenario.state}>
    <AudienceDrawHeader context={scenario} />
    <div className="countdown-stage__content" data-prototype-static={scenario.prototypeStatic ? 'true' : undefined}>
      <h1>{scenario.message}</h1>
      <p aria-label={`Static countdown value: ${scenario.countdownValue ?? '—'}`} className="countdown-stage__numeral">{scenario.countdownValue ?? '—'}</p>
    </div>
  </AudienceStage>
}
