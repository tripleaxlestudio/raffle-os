import { useEffect, useState } from 'react'
import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { AudienceDrawHeader } from './AudienceDrawHeader.tsx'
import { rollingFrameIndex, syntheticRollingNumber } from './rolling-number.ts'
import { WinnerGrid } from './WinnerGrid.tsx'
import { useReducedMotionPreference } from '../../shared/hooks/useReducedMotionPreference.ts'

export function RollingStage({ scenario }: { readonly scenario: PublicAudienceScenario }) {
  const speed = scenario.rollSpeedPerSecond ?? 12
  const startedAt = scenario.rollingStartedAt
  const slotCount = Math.min(100, Math.max(1, scenario.rollingSlotCount ?? scenario.ticketNumbers?.length ?? 1))
  const seed = scenario.presentationSeed ?? 'raffle-os-audience'
  const reducedMotion = useReducedMotionPreference()
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (scenario.prototypeStatic) return
    let handle: number | undefined
    const tick = () => { const next = rollingFrameIndex(startedAt, globalThis['Date']['now'](), speed); setFrame((previous) => previous === next ? previous : next); handle = globalThis['setTimeout'](tick, Math.max(16, Math.floor(1000 / speed))) }
    handle = globalThis['setTimeout'](() => { setFrame(rollingFrameIndex(startedAt, globalThis['Date']['now'](), speed)); if (!reducedMotion) tick() }, 0)
    return () => { if (handle !== undefined) globalThis['clearTimeout'](handle) }
  }, [reducedMotion, scenario.prototypeStatic, speed, startedAt])
  const values = scenario.prototypeStatic && scenario.ticketNumbers !== undefined ? scenario.ticketNumbers : Array.from({ length: slotCount }, (_, slot) => syntheticRollingNumber(seed, slot, frame))
  const winnerCount = scenario.winnerCount ?? slotCount
  return <AudienceStage className="rolling-stage" state={scenario.state}>
    <AudienceDrawHeader context={scenario} winnerCount={winnerCount} className="rolling-stage__header"><p className="rolling-stage__status">Putaran berlangsung</p></AudienceDrawHeader>
    <div className="rolling-stage__content">
      <WinnerGrid confirmed={false} count={slotCount} ticketNumbers={values} lockedCount={scenario.prototypeStatic ? slotCount : 0} rolling={!scenario.prototypeStatic} prototypeStatic={scenario.prototypeStatic} revealEntrance className="rolling-ticket-stream" ariaLabel={scenario.prototypeStatic ? 'Aliran tiket presentasi' : 'Nomor tiket putaran sintetis'} />
    </div>
  </AudienceStage>
}
