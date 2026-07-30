import { useSearchParams } from 'react-router'
import {
  getAudienceScenarioFixture,
  resolveAudienceScenarioQuery,
} from '../../prototype/scenario-query.ts'
import {
  BlackoutStage,
  CountdownStage,
  DisconnectedStage,
  RollingStage,
  StandbyStage,
  WinnerStage,
} from '../../ui/audience/index.ts'

export function AudienceDisplayPage() {
  const [searchParams] = useSearchParams()
  const scenario = getAudienceScenarioFixture(
    resolveAudienceScenarioQuery(searchParams),
  )

  switch (scenario.state) {
    case 'standby':
      return <StandbyStage scenario={scenario} />
    case 'countdown':
      return <CountdownStage scenario={scenario} />
    case 'rolling':
      return <RollingStage scenario={scenario} />
    case 'winner-reveal':
    case 'confirmed':
      return <WinnerStage scenario={scenario} />
    case 'blackout':
      return <BlackoutStage />
    case 'disconnected':
      return <DisconnectedStage scenario={scenario} />
  }
}
