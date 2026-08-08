import { useEffect, useState } from 'react'
import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { AudienceDrawHeader } from './AudienceDrawHeader.tsx'
import { DisplayStateLabel } from './DisplayStateLabel.tsx'
import { WinnerGrid } from './WinnerGrid.tsx'
import { SEQUENTIAL_REVEAL_INTERVAL_MS, visibleWinnerCount } from './sequential-reveal.ts'
import { rollingFrameIndex, syntheticRollingNumber } from './rolling-number.ts'

export function WinnerStage({ scenario }: { readonly scenario: PublicAudienceScenario }) {
  const confirmed = scenario.state === 'confirmed'
  const revealEntrance = scenario.presentationMode !== 'random-number-roll'
  const count = Math.max(1, scenario.layoutCount ?? scenario.ticketNumbers?.length ?? 1)
  const sequential = scenario.state === 'reveal' && scenario.revealMode === 'sequential' && count > 1
  const speed = scenario.rollSpeedPerSecond ?? 12
  const seed = scenario.presentationSeed ?? 'raffle-os-audience'
  const [now, setNow] = useState(() => globalThis['Date']['now']())
  useEffect(() => {
    if (!sequential) return
    let timer: number | undefined
    const update = () => { const current = globalThis['Date']['now'](); setNow(current); if (visibleWinnerCount(scenario.revealStartedAt, count, current) < count) timer = globalThis['setTimeout'](update, SEQUENTIAL_REVEAL_INTERVAL_MS) }
    update()
    return () => { if (timer !== undefined) globalThis['clearTimeout'](timer) }
  }, [count, scenario.revealStartedAt, sequential])
  const lockedCount = sequential ? visibleWinnerCount(scenario.revealStartedAt, count, now) : count
  const rollingFrame = rollingFrameIndex(scenario.rollingStartedAt ?? scenario.revealStartedAt, now, speed)
  const values = scenario.ticketNumbers ?? []
  const displayedValues = sequential ? Array.from({ length: count }, (_, index) => index < lockedCount ? values[index] ?? '000000' : syntheticRollingNumber(seed, index, rollingFrame)) : values
  return <AudienceStage className="winner-stage" state={scenario.state}>
    <AudienceDrawHeader context={scenario} className="winner-stage__header" />
    <WinnerGrid confirmed={confirmed} winnerStatuses={scenario.winnerStatuses} count={count} ticketNumbers={displayedValues} lockedCount={lockedCount} rolling={sequential} revealEntrance={revealEntrance} />
    <DisplayStateLabel tone={confirmed ? 'confirmed' : 'verification'}>{scenario.statusMessage ?? 'Public result'}</DisplayStateLabel>
  </AudienceStage>
}
