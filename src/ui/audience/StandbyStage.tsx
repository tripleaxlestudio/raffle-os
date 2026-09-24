import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { EventBrand } from './EventBrand.tsx'
import { AudiencePrizeImage } from './AudiencePrizeImage.tsx'

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
        {scenario.displayTest ? <p className="audience-test-badge" role="status">TES TAMPILAN · BUKAN UNDIAN RESMI</p> : null}
        <p className="audience-eyebrow">{scenario.nextDrawReady ? 'Undian berikutnya' : scenario.displayTest === false ? 'Tampilan siap' : 'Undian berikutnya'}</p>
        {scenario.nextDrawReady && scenario.prizeImageAssetId !== undefined ? <AudiencePrizeImage assetId={scenario.prizeImageAssetId} prizeName={scenario.prizeLabel} /> : null}
        {scenario.nextDrawReady ? <h1>{scenario.prizeLabel}</h1> : <h1>{scenario.message ?? 'Undian segera dimulai'}</h1>}
        <p className="audience-prize">
          <span>{scenario.prizeCategory}</span>
          {scenario.nextDrawReady ? <strong>{scenario.winnerCount} Pemenang</strong> : <strong>{scenario.prizeLabel}</strong>}
        </p>
        {scenario.nextDrawReady ? <p className="standby-stage__next-draw-message">{scenario.message ?? 'Undian segera dimulai'}</p> : null}
      </div>
      <div aria-hidden="true" className="audience-safe-area-markers" />
    </AudienceStage>
  )
}
