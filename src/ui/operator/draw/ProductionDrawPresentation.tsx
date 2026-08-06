import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DrawSessionId } from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { PresentationStage } from '../../../domain/workflow/presentation-workflow.types.ts'
import type { PresentationCheckpointRecord } from '../../../domain/workflow/presentation-checkpoint.types.ts'
import { checkpointFromState } from '../../../domain/workflow/presentation-checkpoint.types.ts'
import { savePracticeBlackout, savePracticePresentationStage, type PracticeResultProjection } from '../../../application/draw/practice-result-storage.ts'
import { PresentationController, type PresentationClock, type PresentationControllerState } from '../../../application/workflow/presentation-controller.ts'
import { PRESENTATION_POLICY } from '../../../application/workflow/presentation-policy.ts'
import { PresentationError, safePresentationMessage } from '../../../application/workflow/presentation-errors.ts'
import type { PresentationResultProjection } from '../../../application/workflow/presentation-projection.ts'
import { createOperatorPublisher, type OperatorPublisher } from '../../../application/display-transport/operator-publisher.ts'
import { createBroadcastChannelTransport } from '../../../application/display-transport/transport.ts'
import type { ProtocolScope } from '../../../application/display-transport/protocol.ts'
import { deriveProductionDisplayScope } from '../../../application/display/display-configuration-service.ts'
import { Button, Card } from '../../../shared/ui/index.ts'

let publisherLifecycleEpoch = 0

interface ProductionDrawPresentationProps {
  readonly result: PresentationResultProjection
  readonly mode: 'live' | 'practice'
  readonly eventName: string
  readonly eventId?: string
  readonly displayConfigurationId?: string
  readonly prizeCategory: string
  readonly prizeName: string
  readonly checkpoints?: { findByDrawSessionId(id: DrawSessionId): Promise<PresentationCheckpointRecord | null>; upsert(checkpoint: PresentationCheckpointRecord): Promise<void> }
  readonly practiceResult?: PracticeResultProjection
  readonly onFailure: (error: PresentationError) => void
  readonly initialPresentation?: { readonly stage: PresentationStage; readonly stageStartedAt: IsoTimestamp; readonly blackoutRequested: boolean }
  readonly onHandoff?: () => void
  readonly sharedPublisher?: OperatorPublisher | null
}

function browserClock(): PresentationClock {
  return { now: () => new Date().toISOString() as IsoTimestamp, setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs), clearTimeout: (handle) => window.clearTimeout(handle as number), prefersReducedMotion: () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false }
}

export function ProductionDrawPresentation({ result, mode, eventName, eventId = 'production-event', displayConfigurationId = eventId, prizeCategory, prizeName, checkpoints, practiceResult, onFailure, initialPresentation, onHandoff, sharedPublisher }: ProductionDrawPresentationProps) {
  const [controllerState, setControllerState] = useState<PresentationControllerState>({ stage: 'result-locked', countdownLabel: null, error: null })
  const [blackoutRequested, setBlackoutRequested] = useState(initialPresentation?.blackoutRequested ?? false)
  const scope: ProtocolScope = useMemo(() => deriveProductionDisplayScope(eventId, displayConfigurationId), [displayConfigurationId, eventId])
  const localPublisher = useMemo(() => createOperatorPublisher({ transport: createBroadcastChannelTransport('raffle-os-display', scope), transportFactory: () => createBroadcastChannelTransport('raffle-os-display', scope), scope, senderId: `operator:${eventId}:${result.drawSessionId}`, expectedSession: result.drawSessionId, epoch: ++publisherLifecycleEpoch, clock: { now: () => new Date().toISOString() as IsoTimestamp } }), [eventId, result.drawSessionId, scope])
  const publisher = sharedPublisher ?? localPublisher
  const sourceForState = useCallback((next: PresentationControllerState) => next.stage === 'failed' || next.stage === 'result-locked'
    ? { drawSessionId: result.drawSessionId, stage: 'ready' as const, blackoutRequested: next.blackoutRequested ?? false, mode, result }
    : { drawSessionId: result.drawSessionId, stage: next.stage, stageStartedAt: next.stageStartedAt, blackoutRequested: next.blackoutRequested ?? false, mode, result }, [mode, result])
  const controller = useMemo(() => new PresentationController({
    result, mode, clock: browserClock(),
    persistStage: async (stage, stageStartedAt) => {
      if (mode === 'practice') {
        if (practiceResult === undefined) throw new PresentationError('practice-projection-invalid', 'Practice result projection is unavailable.', false, true)
        try { savePracticePresentationStage(practiceResult, stage, stageStartedAt) } catch (cause: unknown) { throw new PresentationError('session-storage-write-failure', 'Practice presentation state could not be saved in this tab.', true, true, cause) }
        return
      }
      if (checkpoints === undefined) throw new PresentationError('checkpoint-write-failure', 'Official result is locked, but presentation could not start.', true, true)
      try {
        const prior = await checkpoints.findByDrawSessionId(result.drawSessionId)
        await checkpoints.upsert(checkpointFromState({ drawSessionId: result.drawSessionId, stage, stageStartedAt, blackoutRequested: prior?.blackoutRequested ?? false }, browserClock().now()))
      } catch (cause: unknown) { throw new PresentationError(stage === 'pending-handoff' ? 'pending-handoff-write-failure' : 'checkpoint-write-failure', stage === 'pending-handoff' ? 'Pending handoff could not be saved. Retry the handoff; the official result is preserved.' : 'Official result is locked, but presentation could not start.', true, true, cause) }
    },
    persistBlackout: async (requested) => {
      if (mode === 'practice') {
        if (practiceResult === undefined) throw new PresentationError('practice-projection-invalid', 'Practice result projection is unavailable.', false, true)
        savePracticeBlackout(practiceResult, requested)
      } else {
        if (checkpoints === undefined) throw new PresentationError('blackout-update-failure', 'Blackout intent could not be saved. The result and stage were preserved.', true, true)
        const current = await checkpoints.findByDrawSessionId(result.drawSessionId)
        if (current === null) throw new PresentationError('blackout-update-failure', 'Blackout intent could not be saved because the checkpoint is unavailable.', true, true)
        await checkpoints.upsert({ ...current, blackoutRequested: requested, persistedAt: browserClock().now() })
      }
      setBlackoutRequested(requested)
    },
    onState: (next) => { setControllerState(next); if (next.blackoutRequested !== undefined) setBlackoutRequested(next.blackoutRequested); if (next.stage !== 'failed' && next.stage !== 'result-locked') void publisher.publish(sourceForState(next)) }, policy: PRESENTATION_POLICY,
  }), [checkpoints, mode, practiceResult, publisher, result, sourceForState])

  useEffect(() => {
    if (sharedPublisher !== undefined) return
    publisher.start({ drawSessionId: result.drawSessionId, stage: 'ready', blackoutRequested: initialPresentation?.blackoutRequested ?? false, mode, result })
    return () => publisher.close()
  }, [initialPresentation?.blackoutRequested, mode, publisher, result, sharedPublisher])

  useEffect(() => {
    void (initialPresentation === undefined ? controller.start() : controller.resume(initialPresentation.stage, initialPresentation.stageStartedAt, initialPresentation.blackoutRequested))
    return () => controller.dispose()
  }, [controller, initialPresentation])
  useEffect(() => { if (mode === 'live' && controllerState.stage === 'pending-handoff') onHandoff?.() }, [controllerState.stage, mode, onHandoff])
  useEffect(() => { if (controllerState.error !== null) onFailure(controllerState.error) }, [controllerState.error, onFailure])

  const blackoutControl = <div className="presentation-blackout-control"><p>Audience publication is active for this Event display.</p><Button variant="secondary" onClick={() => { void controller.setBlackout(!blackoutRequested) }}>{blackoutRequested ? 'End blackout' : 'Blackout Audience display'}</Button></div>
  const stage = controllerState.stage
  if (stage === 'failed') return <Card className="presentation-failure" padding="lg"><p className="operator-eyebrow">Safe presentation state</p><h2>{safePresentationMessage(controllerState.error)}</h2><p>The locked result was preserved. Retry presentation from this same result or return to Draw Setup.</p><Button onClick={() => { void controller.retry() }}>Retry presentation</Button></Card>
  if (stage === 'result-locked') return <Card padding="lg"><p>Preparing locked result presentation…</p></Card>
  if (stage === 'countdown') return <PresentationFrame blackoutRequested={blackoutRequested} blackoutControl={blackoutControl} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Get ready" announcement={`Countdown ${controllerState.countdownLabel ?? 3}`}><div className="production-countdown" aria-hidden="true">{controllerState.countdownLabel}</div><Button onClick={() => { void controller.skip() }}>Skip animation</Button></PresentationFrame>
  if (stage === 'rolling') return <PresentationFrame blackoutRequested={blackoutRequested} blackoutControl={blackoutControl} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Selecting winners" announcement="Selecting winners"><div className="production-rolling" aria-hidden="true"><span>• • • • •</span><span>SELECTING</span><span>— — — — —</span></div><Button onClick={() => { void controller.skip() }}>Skip animation</Button></PresentationFrame>
  if (stage === 'pending-handoff') return <Card padding="lg"><p className="operator-eyebrow">Practice · rehearsal only</p><h2>Practice presentation complete</h2><p>The Practice result remains available only in this browser tab. No official record was created.</p><ol>{result.winners.map((winner) => <li key={winner.winnerId}><code>{winner.ticketNumber}</code></li>)}</ol></Card>
  return <PresentationFrame blackoutRequested={blackoutRequested} blackoutControl={blackoutControl} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Winner reveal" announcement="Winner reveal"><ol className={`production-winner-list production-winner-list--${result.winners.length}`} aria-label={`${result.winners.length} ${mode === 'live' ? 'official' : 'Practice'} winners`}>{result.winners.map((winner) => <li key={winner.winnerId}><span>#{winner.sequence}</span><strong>{winner.ticketNumber}</strong></li>)}</ol><p className="presentation-completion">{mode === 'live' ? 'Presentation complete. Continue safely to Pending Results when ready.' : 'Practice presentation complete. Return to the DrawSession queue; no official result was created.'}</p><Button onClick={() => { void controller.handoff() }}>{mode === 'live' ? 'Continue safely to Pending' : 'Return to Draw Sessions'}</Button></PresentationFrame>
}

function PresentationFrame({ children, blackoutControl, blackoutRequested, mode, eventName, prizeCategory, prizeName, heading, announcement }: { children: ReactNode; blackoutControl: ReactNode; blackoutRequested: boolean; mode: 'live' | 'practice'; eventName: string; prizeCategory: string; prizeName: string; heading: string; announcement: string }) {
  return <section className={`production-presentation${blackoutRequested ? ' production-presentation--blackout' : ''}`} aria-labelledby="presentation-heading"><header><p className="operator-eyebrow">{mode === 'live' ? 'Live · official result locked' : 'Practice · rehearsal only'}</p><h1 id="presentation-heading">{heading}</h1><p>{eventName} · {prizeCategory} · {prizeName}</p>{blackoutControl}</header><p className="sr-only" role="status" aria-live="polite">{announcement}</p><div className="production-presentation__content">{children}</div></section>
}
