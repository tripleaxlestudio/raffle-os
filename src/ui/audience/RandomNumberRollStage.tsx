import { useEffect, useState } from 'react'
import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { AudienceDrawHeader } from './AudienceDrawHeader.tsx'
import { DisplayStateLabel } from './DisplayStateLabel.tsx'
import { rollingFrameIndex, syntheticRollingNumber } from './rolling-number.ts'
import { SEQUENTIAL_REVEAL_INTERVAL_MS, visibleWinnerCount } from './sequential-reveal.ts'
import { WinnerGrid } from './WinnerGrid.tsx'

export function RandomNumberRollStage({ scenario }: { readonly scenario: PublicAudienceScenario }) {
  const count = Math.max(1, scenario.layoutCount ?? scenario.ticketNumbers?.length ?? scenario.rollingSlotCount ?? 1)
  const speed = scenario.rollSpeedPerSecond ?? 12
  const seed = scenario.presentationSeed ?? 'raffle-os-audience'
  const isReveal = scenario.state === 'reveal'
  const sequential = isReveal && scenario.revealMode === 'sequential' && count > 1
  const [frame, setFrame] = useState(0)
  const [now, setNow] = useState(() => globalThis['Date']['now']())
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  useEffect(() => {
    if (isReveal || scenario.prototypeStatic) return
    let handle: number | undefined
    const tick = () => { const next = rollingFrameIndex(scenario.rollingStartedAt, globalThis['Date']['now'](), speed); setFrame((previous) => previous === next ? previous : next); handle = globalThis['setTimeout'](tick, Math.max(16, Math.floor(1000 / speed))) }
    handle = globalThis['setTimeout'](() => { setFrame(rollingFrameIndex(scenario.rollingStartedAt, globalThis['Date']['now'](), speed)); if (!reducedMotion) tick() }, 0)
    return () => { if (handle !== undefined) globalThis['clearTimeout'](handle) }
  }, [isReveal, reducedMotion, scenario.prototypeStatic, scenario.rollingStartedAt, speed])
  useEffect(() => {
    if (!sequential) return
    let timer: number | undefined
    const update = () => { const current = globalThis['Date']['now'](); setNow(current); if (visibleWinnerCount(scenario.revealStartedAt, count, current) < count) timer = globalThis['setTimeout'](update, SEQUENTIAL_REVEAL_INTERVAL_MS) }
    update()
    return () => { if (timer !== undefined) globalThis['clearTimeout'](timer) }
  }, [count, scenario.revealStartedAt, sequential])
  const lockedCount = sequential ? visibleWinnerCount(scenario.revealStartedAt, count, now) : isReveal ? count : 0
  const rollingFrame = rollingFrameIndex(scenario.rollingStartedAt ?? scenario.revealStartedAt, now, speed)
  const authoritativeValues = scenario.ticketNumbers ?? []
  const values = isReveal ? Array.from({ length: count }, (_, index) => index < lockedCount ? authoritativeValues[index] ?? '000000' : syntheticRollingNumber(seed, index, rollingFrame)) : scenario.prototypeStatic && scenario.ticketNumbers !== undefined ? scenario.ticketNumbers : Array.from({ length: count }, (_, index) => syntheticRollingNumber(seed, index, frame))
  return <AudienceStage className="random-number-roll-stage" state={scenario.state}>
    <AudienceDrawHeader context={scenario} winnerCount={count} className="random-number-roll-stage__header" />
    <WinnerGrid confirmed={false} count={count} ticketNumbers={values} lockedCount={lockedCount} rolling={!isReveal || sequential} revealEntrance={!isReveal} ariaLabel="Random Number Roll ticket values" />
    <DisplayStateLabel tone={isReveal ? 'verification' : 'neutral'}>{isReveal ? 'Results under verification' : 'Rolling'}</DisplayStateLabel>
  </AudienceStage>
}
