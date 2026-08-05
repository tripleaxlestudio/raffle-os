import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DrawSessionId } from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { PresentationStage } from '../../../domain/workflow/presentation-workflow.types.ts'
import { checkpointFromState } from '../../../domain/workflow/presentation-checkpoint.types.ts'
import { savePracticePresentationStage, type PracticeResultProjection } from '../../../application/draw/practice-result-storage.ts'
import { PresentationController, type PresentationClock, type PresentationControllerState } from '../../../application/workflow/presentation-controller.ts'
import { PRESENTATION_POLICY } from '../../../application/workflow/presentation-policy.ts'
import { PresentationError, safePresentationMessage } from '../../../application/workflow/presentation-errors.ts'
import type { PresentationResultProjection } from '../../../application/workflow/presentation-projection.ts'
import { Button, Card } from '../../../shared/ui/index.ts'

interface ProductionDrawPresentationProps {
  readonly result: PresentationResultProjection
  readonly mode: 'live' | 'practice'
  readonly eventName: string
  readonly prizeCategory: string
  readonly prizeName: string
  readonly checkpoints?: { findByDrawSessionId(id: DrawSessionId): Promise<{ readonly blackoutRequested: boolean } | null>; upsert(checkpoint: ReturnType<typeof checkpointFromState>): Promise<void> }
  readonly practiceResult?: PracticeResultProjection
  readonly onFailure: (error: PresentationError) => void
}

function browserClock(): PresentationClock {
  return {
    now: () => new Date().toISOString() as IsoTimestamp,
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
    prefersReducedMotion: () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  }
}

export function ProductionDrawPresentation({ result, mode, eventName, prizeCategory, prizeName, checkpoints, practiceResult, onFailure }: ProductionDrawPresentationProps) {
  const [controllerState, setControllerState] = useState<PresentationControllerState>({ stage: 'result-locked', countdownLabel: null, error: null })
  const controller = useMemo(() => new PresentationController({
      result,
      mode,
      clock: browserClock(),
      persistStage: async (stage: PresentationStage, stageStartedAt: IsoTimestamp) => {
        if (mode === 'practice') {
          if (practiceResult === undefined) throw new PresentationError('practice-projection-invalid', 'Practice result projection is unavailable.', false, true)
          try { savePracticePresentationStage(practiceResult, stage, stageStartedAt) } catch (cause: unknown) { throw new PresentationError('session-storage-write-failure', 'Practice presentation state could not be saved in this tab.', true, true, cause) }
          return
        }
        if (checkpoints === undefined) throw new PresentationError('checkpoint-write-failure', 'Official result is locked, but presentation could not start.', true, true)
        try {
          const prior = await checkpoints.findByDrawSessionId(result.drawSessionId)
          await checkpoints.upsert(checkpointFromState({ drawSessionId: result.drawSessionId, stage, stageStartedAt, blackoutRequested: prior?.blackoutRequested ?? false }, browserClock().now()))
        } catch (cause: unknown) { throw new PresentationError('checkpoint-write-failure', 'Official result is locked, but presentation could not start.', true, true, cause) }
      },
      onState: setControllerState,
      policy: PRESENTATION_POLICY,
    }), [mode, checkpoints, practiceResult, result])

  useEffect(() => {
    void controller.start()
    return () => controller.dispose()
  }, [controller])

  useEffect(() => { if (controllerState.error !== null) onFailure(controllerState.error) }, [controllerState.error, onFailure])

  const stage = controllerState.stage
  if (stage === 'failed') return <Card className="presentation-failure" padding="lg"><p className="operator-eyebrow">Safe presentation state</p><h2>{safePresentationMessage(controllerState.error)}</h2><p>The locked result was preserved. Retry presentation from this same result or return to Draw Setup.</p><Button onClick={() => { void controller.retry() }}>Retry presentation</Button></Card>
  if (stage === 'result-locked') return <Card padding="lg"><p>Preparing locked result presentation…</p></Card>
  if (stage === 'countdown') return <PresentationFrame mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Get ready" announcement={`Countdown ${controllerState.countdownLabel ?? 3}`}><div className="production-countdown" aria-hidden="true">{controllerState.countdownLabel}</div><Button onClick={() => { void controller?.skip() }}>Skip animation</Button></PresentationFrame>
  if (stage === 'rolling') return <PresentationFrame mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Selecting winners" announcement="Selecting winners"><div className="production-rolling" aria-hidden="true"><span>• • • • •</span><span>SELECTING</span><span>— — — — —</span></div><Button onClick={() => { void controller?.skip() }}>Skip animation</Button></PresentationFrame>
  return <PresentationFrame mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Winner reveal" announcement="Winner reveal"><ol className={`production-winner-list production-winner-list--${result.winners.length}`} aria-label={`${result.winners.length} ${mode === 'live' ? 'official' : 'Practice'} winners`}>{result.winners.map((winner) => <li key={winner.winnerId}><span>#{winner.sequence}</span><strong>{winner.ticketNumber}</strong></li>)}</ol><p className="presentation-completion">Presentation complete. Pending handoff will be available in the next workflow.</p></PresentationFrame>
}

function PresentationFrame({ children, mode, eventName, prizeCategory, prizeName, heading, announcement }: { children: ReactNode; mode: 'live' | 'practice'; eventName: string; prizeCategory: string; prizeName: string; heading: string; announcement: string }) {
  return <section className="production-presentation" aria-labelledby="presentation-heading"><header><p className="operator-eyebrow">{mode === 'live' ? 'Live · official result locked' : 'Practice · rehearsal only'}</p><h1 id="presentation-heading">{heading}</h1><p>{eventName} · {prizeCategory} · {prizeName}</p></header><p className="sr-only" role="status" aria-live="polite">{announcement}</p><div className="production-presentation__content">{children}</div></section>
}
