import { useEffect, useMemo, useState } from 'react'
import type { PublicAudienceScenario } from './audience-view.types.ts'
import { AudienceStage } from './AudienceStage.tsx'
import { DisplayStateLabel } from './DisplayStateLabel.tsx'
import { EventBrand } from './EventBrand.tsx'
import { rollingFrameIndex, syntheticRollingNumber } from './rolling-number.ts'

export function RollingStage({ scenario }: { readonly scenario: PublicAudienceScenario }) {
  const speed = scenario.rollSpeedPerSecond ?? 12
  const startedAt = scenario.rollingStartedAt
  const slotCount = Math.min(100, Math.max(1, scenario.rollingSlotCount ?? scenario.ticketNumbers?.length ?? 1))
  const seed = scenario.presentationSeed ?? 'raffle-os-audience'
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (scenario.prototypeStatic) return
    let handle: number | undefined
    const tick = () => {
      const next = rollingFrameIndex(startedAt, globalThis['Date']['now'](), speed)
      setFrame((previous) => previous === next ? previous : next)
      handle = globalThis['setTimeout'](tick, Math.max(16, Math.floor(1000 / speed)))
    }
    handle = globalThis['setTimeout'](() => {
      setFrame(rollingFrameIndex(startedAt, globalThis['Date']['now'](), speed))
      if (!reducedMotion) tick()
    }, 0)
    return () => { if (handle !== undefined) globalThis['clearTimeout'](handle) }
  }, [reducedMotion, scenario.prototypeStatic, speed, startedAt])

  const values = useMemo(() => scenario.prototypeStatic && scenario.ticketNumbers !== undefined
    ? [...scenario.ticketNumbers]
    : Array.from({ length: slotCount }, (_, slot) => syntheticRollingNumber(seed, slot, frame)), [frame, seed, slotCount, scenario.prototypeStatic, scenario.ticketNumbers])
  return <AudienceStage className="rolling-stage" state={scenario.state}>
    <EventBrand compact eventName={scenario.eventName} eventSubtitle={scenario.eventSubtitle} />
    <div className="rolling-stage__content">
      <p className="audience-eyebrow">{scenario.prizeCategory} · {scenario.prizeLabel}</p>
      <h1>{scenario.message ?? 'Drawing in progress'}</h1>
      <ul aria-label={scenario.prototypeStatic ? 'Presentational ticket stream' : 'Synthetic rolling ticket numbers'} className="rolling-ticket-stream" data-prototype-static={scenario.prototypeStatic ? 'true' : undefined} data-rolling-frame={frame} data-slot-count={slotCount}>
        {values.map((value, index) => <li className="rolling-ticket" key={index}><span>{value}</span></li>)}
      </ul>
    </div>
    <DisplayStateLabel>Rolling</DisplayStateLabel>
  </AudienceStage>
}
