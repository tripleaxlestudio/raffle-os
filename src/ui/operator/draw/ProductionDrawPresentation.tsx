import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DrawSessionId } from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { PresentationStage } from '../../../domain/workflow/presentation-workflow.types.ts'
import { DEFAULT_DRAW_PRESENTATION_CONFIGURATION, type DrawPresentationConfiguration } from '../../../domain/draws/draw-presentation.types.ts'
import type { PresentationCheckpointRecord } from '../../../domain/workflow/presentation-checkpoint.types.ts'
import { checkpointFromState } from '../../../domain/workflow/presentation-checkpoint.types.ts'
import { savePracticeBlackout, savePracticePresentationStage, type PracticeResultProjection } from '../../../application/draw/practice-result-storage.ts'
import { PresentationController, type PresentationClock, type PresentationControllerState } from '../../../application/workflow/presentation-controller.ts'
import { PRESENTATION_POLICY, type PresentationPolicy } from '../../../application/workflow/presentation-policy.ts'
import { PresentationError } from '../../../application/workflow/presentation-errors.ts'
import type { PresentationResultProjection } from '../../../application/workflow/presentation-projection.ts'
import { createOperatorPublisher, createPublisherRuntimeIdentity, type OperatorPublisher } from '../../../application/display-transport/operator-publisher.ts'
import { createBroadcastChannelTransport } from '../../../application/display-transport/transport.ts'
import type { ProtocolScope } from '../../../application/display-transport/protocol.ts'
import { deriveProductionDisplayScope } from '../../../application/display/display-configuration-service.ts'
import { Badge, Button, ButtonLink, Card } from '../../../shared/ui/index.ts'
import { PresentationRecoveryDialog } from './PresentationRecoveryDialog.tsx'
import { DRAW_ROLL_SPEED_PRESETS } from './draw-presentation-presets.ts'

export interface ProductionDrawRecap {
  readonly winnerCount: number
  readonly eligibleCount: number
  readonly winningRule: string
  readonly countdownSeconds: number
  readonly rollingSeconds: number
  readonly presentationConfiguration?: DrawPresentationConfiguration
}

function presentationSummary(configuration: DrawPresentationConfiguration): string {
  if (configuration.presentationMode === 'instant-reveal') return 'Instant Reveal'
  const speed = DRAW_ROLL_SPEED_PRESETS.find((preset) => preset.value === configuration.rollSpeedPerSecond)?.label ?? `${configuration.rollSpeedPerSecond}/sec`
  const stop = configuration.rollStopMode === 'manual' ? 'Manual Stop' : `Timed · ${configuration.rollDurationSeconds} sec`
  const reveal = configuration.revealMode === 'sequential' ? 'Sequential' : 'Together'
  return `Random Number Roll · ${stop} · ${speed} · ${reveal}`
}

export function ProductionDrawRunHeader({ mode, stage, eventName, prizeCategory, prizeName, recap, audienceStatus, backTo }: { readonly mode: 'live' | 'practice'; readonly stage: string; readonly eventName: string; readonly prizeCategory: string; readonly prizeName: string; readonly recap?: ProductionDrawRecap; readonly audienceStatus?: { readonly label: string; readonly detail: string; readonly displayUrl: string | null }; readonly backTo?: string }) {
  return <header className="production-draw-run-header"><div className="production-draw-run-header__identity"><div className="production-draw-run-header__title"><Badge variant={mode === 'practice' ? 'warning' : 'danger'}>{mode === 'practice' ? 'PRACTICE' : 'LIVE'}</Badge><div><p className="operator-eyebrow">{mode === 'practice' ? 'Rehearsal only' : 'Official result locked'}</p><h1 id="presentation-heading">{stage}</h1><p>{eventName} · {prizeCategory} · {prizeName}</p>{recap?.presentationConfiguration === undefined ? null : <p data-testid="presentation-summary" className="production-presentation-summary">{presentationSummary(recap.presentationConfiguration)}</p>}</div></div><dl className="production-draw-run-header__metrics"><div><dt>Winners</dt><dd>{recap?.winnerCount ?? '—'}</dd></div><div><dt>Eligible</dt><dd>{recap?.eligibleCount ?? '—'}</dd></div><div><dt>Presentation timing</dt><dd>{recap === undefined ? <span>—</span> : <><span className="production-draw-run-header__timing-item"><span>Countdown</span><strong>{recap.countdownSeconds}s</strong></span><span className="production-draw-run-header__timing-separator" aria-hidden="true">·</span><span className="production-draw-run-header__timing-item"><span>Rolling</span><strong>{recap.rollingSeconds}s</strong></span></>}</dd></div></dl></div><div className="production-draw-run-header__audience"><div className="production-draw-run-header__audience-status"><strong className="production-draw-run-header__audience-heading">Audience Display</strong><div className="production-draw-run-header__audience-state"><Badge variant={audienceStatus?.label === 'Connected' ? 'success' : audienceStatus?.label === 'Waiting' ? 'warning' : 'danger'}>{audienceStatus?.label ?? 'Unavailable'}</Badge></div><small>{audienceStatus?.detail ?? 'No production publisher status.'}</small></div><div className="production-draw-run-header__actions">{backTo === undefined ? null : <ButtonLink to={backTo} variant="secondary" className="production-draw-run-header__back">Back to Live Draw</ButtonLink>}{audienceStatus?.displayUrl === null || audienceStatus === undefined ? null : <ButtonLink to={audienceStatus.displayUrl} target="_blank" rel="noreferrer" variant="secondary" className="production-draw-run-header__audience-action">Open Audience Display</ButtonLink>}</div></div></header>
}

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
  readonly onResetPractice?: () => void
  readonly resetPending?: boolean
  readonly presentationPolicy?: PresentationPolicy
  readonly presentationConfiguration?: DrawPresentationConfiguration
  readonly audienceStatus?: { readonly label: string; readonly detail: string; readonly displayUrl: string | null }
  readonly recap?: ProductionDrawRecap
  readonly backTo?: string
  readonly onRecoveryBack?: () => void
}

function browserClock(): PresentationClock {
  return { now: () => new Date().toISOString() as IsoTimestamp, setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs), clearTimeout: (handle) => window.clearTimeout(handle as number), prefersReducedMotion: () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false }
}

export function ProductionDrawPresentation({ result, mode, eventName, eventId = 'production-event', displayConfigurationId = eventId, prizeCategory, prizeName, checkpoints, practiceResult, onFailure, initialPresentation, onHandoff, sharedPublisher, onResetPractice, resetPending = false, presentationPolicy = PRESENTATION_POLICY, presentationConfiguration, audienceStatus, recap, backTo, onRecoveryBack }: ProductionDrawPresentationProps) {
  const activePresentationConfiguration = presentationConfiguration ?? presentationPolicy.presentationConfiguration ?? DEFAULT_DRAW_PRESENTATION_CONFIGURATION
  const runtimePresentationConfiguration = presentationConfiguration ?? presentationPolicy.presentationConfiguration
  const runtimeRecap = recap === undefined ? undefined : { ...recap, presentationConfiguration: recap.presentationConfiguration ?? activePresentationConfiguration }
  const [controllerState, setControllerState] = useState<PresentationControllerState>({ stage: 'result-locked', countdownLabel: null, error: null, presentationConfiguration: activePresentationConfiguration })
  const [blackoutRequested, setBlackoutRequested] = useState(initialPresentation?.blackoutRequested ?? false)
  const scope: ProtocolScope = useMemo(() => deriveProductionDisplayScope(eventId, displayConfigurationId), [displayConfigurationId, eventId])
  const localPublisher = useMemo(() => { const runtime = createPublisherRuntimeIdentity(); return createOperatorPublisher({ transport: createBroadcastChannelTransport('raffle-os-display', scope), transportFactory: () => createBroadcastChannelTransport('raffle-os-display', scope), scope, senderId: runtime.publisherInstanceId, expectedSession: result.drawSessionId, epoch: runtime.epoch, clock: { now: () => new Date().toISOString() as IsoTimestamp } }) }, [result.drawSessionId, scope])
  const publisher = sharedPublisher ?? localPublisher
  const sourceForState = useCallback((next: PresentationControllerState) => next.stage === 'failed' || next.stage === 'result-locked'
    ? { drawSessionId: result.drawSessionId, stage: 'ready' as const, blackoutRequested: next.blackoutRequested ?? false, mode, prizeCategory, prizeName, result }
    : { drawSessionId: result.drawSessionId, stage: next.stage, stageStartedAt: next.stageStartedAt, countdownValue: next.stage === 'countdown' ? next.countdownLabel ?? 3 : undefined, blackoutRequested: next.blackoutRequested ?? false, mode, prizeCategory, prizeName, result, ...(next.stage === 'rolling' && runtimePresentationConfiguration?.presentationMode === 'random-number-roll' ? { presentationConfiguration: { ...runtimePresentationConfiguration, winnerCount: result.winners.length }, presentationSeed: result.drawSessionId } : {}), ...(next.stage === 'reveal' || next.stage === 'pending-handoff' ? runtimePresentationConfiguration === undefined ? {} : { presentationConfiguration: { presentationMode: runtimePresentationConfiguration.presentationMode, winnerCount: result.winners.length, rollSpeedPerSecond: runtimePresentationConfiguration.rollSpeedPerSecond, rollStopMode: runtimePresentationConfiguration.rollStopMode, rollDurationSeconds: runtimePresentationConfiguration.rollDurationSeconds, revealMode: runtimePresentationConfiguration.revealMode }, presentationSeed: result.drawSessionId } : {}) }, [mode, prizeCategory, prizeName, result, runtimePresentationConfiguration])
  const controller = useMemo(() => new PresentationController({
    result, mode, presentationConfiguration: runtimePresentationConfiguration, clock: browserClock(),
    persistStage: async (stage, stageStartedAt) => {
      if (mode === 'practice') {
        if (practiceResult === undefined) throw new PresentationError('practice-projection-invalid', 'Practice result projection is unavailable.', false, true)
        try { savePracticePresentationStage(practiceResult, stage, stageStartedAt) } catch (cause: unknown) { throw new PresentationError('session-storage-write-failure', 'Practice presentation state could not be saved in this tab.', true, true, cause) }
        return
      }
      if (checkpoints === undefined) throw new PresentationError('checkpoint-write-failure', 'Official result is locked, but presentation could not start.', true, true)
      try { const prior = await checkpoints.findByDrawSessionId(result.drawSessionId); await checkpoints.upsert(checkpointFromState({ drawSessionId: result.drawSessionId, stage, stageStartedAt, blackoutRequested: prior?.blackoutRequested ?? false }, browserClock().now())) } catch (cause: unknown) { throw new PresentationError(stage === 'pending-handoff' ? 'pending-handoff-write-failure' : 'checkpoint-write-failure', stage === 'pending-handoff' ? 'Pending handoff could not be saved. Retry the handoff; the official result is preserved.' : 'Official result is locked, but presentation could not start.', true, true, cause) }
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
    onState: (next) => { setControllerState(next); if (next.blackoutRequested !== undefined) setBlackoutRequested(next.blackoutRequested); if (next.stage !== 'failed' && next.stage !== 'result-locked') void publisher.publish(sourceForState(next)) }, policy: presentationPolicy,
  }), [checkpoints, mode, practiceResult, presentationPolicy, publisher, result, runtimePresentationConfiguration, sourceForState])

  useEffect(() => {
    if (sharedPublisher !== undefined) return
    publisher.start({ drawSessionId: result.drawSessionId, stage: 'ready', blackoutRequested: initialPresentation?.blackoutRequested ?? false, mode, prizeCategory, prizeName, result })
    return () => publisher.close()
  }, [initialPresentation?.blackoutRequested, mode, prizeCategory, prizeName, publisher, result, sharedPublisher])
  useEffect(() => { void (initialPresentation === undefined ? controller.start() : controller.resume(initialPresentation.stage, initialPresentation.stageStartedAt, initialPresentation.blackoutRequested)); return () => controller.dispose() }, [controller, initialPresentation])
  useEffect(() => { if (resetPending) controller.dispose() }, [controller, resetPending])
  useEffect(() => { if (mode === 'live' && controllerState.stage === 'pending-handoff') onHandoff?.() }, [controllerState.stage, mode, onHandoff])
  useEffect(() => { if (controllerState.error !== null) onFailure(controllerState.error) }, [controllerState.error, onFailure])

  const blackoutControl = blackoutRequested ? <div className="presentation-blackout-control"><p>Audience publication is currently blacked out.</p><Button variant="secondary" onClick={() => { void controller.setBlackout(false) }}>End blackout</Button></div> : null
  const resetControl = mode === 'practice' && onResetPractice !== undefined && (controllerState.stage === 'reveal' || controllerState.stage === 'pending-handoff' || controllerState.stage === 'failed' || controllerState.stage === 'result-locked') ? <Button variant="primary" disabled={resetPending} onClick={onResetPractice}>{resetPending ? 'Resetting rehearsal…' : 'Reset rehearsal'}</Button> : null
  const stage = controllerState.stage
  const manualRolling = controllerState.presentationConfiguration.presentationMode === 'random-number-roll' && controllerState.presentationConfiguration.rollStopMode === 'manual'
  if (stage === 'rolling' && manualRolling) return <PresentationFrame backTo={backTo} result={result} recap={runtimeRecap} previewStage="rolling" audienceStatus={audienceStatus} blackoutRequested={blackoutRequested} blackoutControl={blackoutControl} operatorControl={<Button variant="danger" size="lg" className="production-manual-stop" onClick={() => { void controller.stopRollingAndReveal() }}>STOP &amp; REVEAL</Button>} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Rolling - winner locked" announcement="Rolling is active. The winner is already locked. Waiting for Stop and Reveal."><div className="production-rolling" aria-label="Rolling is active; winner locked"><span>• • • • •</span><span>ROLLING</span><span>- - - - -</span></div><p className="presentation-progress">Waiting for Stop &amp; Reveal</p></PresentationFrame>
  if (stage === 'failed') return <><PresentationFrame backTo={backTo} result={result} recap={runtimeRecap} previewStage="reveal" audienceStatus={audienceStatus} blackoutRequested={blackoutRequested} blackoutControl={null} operatorControl={null} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Presentation recovery" announcement="Presentation recovery required"><div className="production-recovery-background"><Card padding="lg"><p className="operator-eyebrow">Draw Run workspace</p><h2>Locked winner result</h2><ol className={`production-winner-list production-winner-list--${result.winners.length}`} aria-label={`${result.winners.length} locked winners`}>{result.winners.map((winner) => <li key={winner.winnerId}><span>#{winner.sequence}</span><strong>{winner.ticketNumber}</strong></li>)}</ol></Card></div></PresentationFrame><PresentationRecoveryDialog onBackToSetup={onRecoveryBack ?? (() => undefined)} onRetry={() => { void controller.retry() }} /></>
  if (stage === 'result-locked') return <Card padding="lg"><p>Preparing locked result presentation…</p></Card>
  if (stage === 'countdown') return <PresentationFrame backTo={backTo} result={result} recap={recap} previewStage="countdown" audienceStatus={audienceStatus} blackoutRequested={blackoutRequested} blackoutControl={blackoutControl} operatorControl={resetControl} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Get ready" announcement={`Countdown ${controllerState.countdownLabel ?? 3}`}><div className="production-countdown" aria-label={`Countdown ${controllerState.countdownLabel ?? 3}`}>{controllerState.countdownLabel}</div><p className="presentation-progress">{recap?.countdownSeconds ?? Math.round(presentationPolicy.countdownDurationMs / 1000)}s countdown</p><Button onClick={() => { void controller.skip() }}>Skip animation</Button></PresentationFrame>
  if (stage === 'rolling') return <PresentationFrame backTo={backTo} result={result} recap={recap} previewStage="rolling" audienceStatus={audienceStatus} blackoutRequested={blackoutRequested} blackoutControl={blackoutControl} operatorControl={manualRolling ? <Button variant="primary" onClick={() => { void controller.stopRollingAndReveal() }}>Stop &amp; Reveal</Button> : resetControl} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading={manualRolling ? 'Rolling — winner locked' : 'Rolling'} announcement={manualRolling ? 'Rolling is active. The winner is already locked. Waiting for Stop and Reveal.' : 'Rolling presentation active'}><div className="production-rolling" aria-label={manualRolling ? 'Rolling is active; winner locked' : 'Rolling presentation active'}><span>• • • • •</span><span>ROLLING</span><span>— — — — —</span></div><p className="presentation-progress">{manualRolling ? 'Waiting for Stop & Reveal' : `${recap?.rollingSeconds ?? Math.round(presentationPolicy.rollingDurationMs / 1000)}s rolling presentation`}</p>{manualRolling ? null : <Button onClick={() => { void controller.skip() }}>Skip animation</Button>}</PresentationFrame>
  if (stage === 'pending-handoff') return <section className="production-presentation production-draw-run-shell" aria-labelledby="presentation-heading"><ProductionDrawRunHeader backTo={backTo} mode={mode} stage="Practice presentation complete" eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} recap={recap} audienceStatus={audienceStatus} /><div className="production-presentation-grid"><Card className="practice-complete-panel" padding="lg"><p className="operator-eyebrow">Practice complete</p><Badge variant="success">Rehearsal complete</Badge><h2>Rehearsal complete</h2><p>The Practice presentation is complete. Reset the rehearsal to run it again, or return to the DrawSession queue.</p><ol>{result.winners.map((winner) => <li key={winner.winnerId}><span>#{winner.sequence}</span><code>{winner.ticketNumber}</code></li>)}</ol><div className="practice-complete-panel__actions">{resetControl}<Button variant="quiet" onClick={() => { void controller.handoff() }}>Return to Draw Sessions</Button></div></Card><PresentationSupport recap={recap} previewStage="pending-handoff" audienceStatus={audienceStatus} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} result={result} blackoutRequested={blackoutRequested} /></div></section>
  return <PresentationFrame backTo={backTo} result={result} recap={recap} previewStage="reveal" audienceStatus={audienceStatus} blackoutRequested={blackoutRequested} blackoutControl={blackoutControl} operatorControl={blackoutRequested ? resetControl : null} mode={mode} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} heading="Winner reveal" announcement="Winner reveal"><ol className={`production-winner-list production-winner-list--${result.winners.length}`} aria-label={`${result.winners.length} ${mode === 'live' ? 'official' : 'Practice'} winners`}>{result.winners.map((winner) => <li key={winner.winnerId}><span>#{winner.sequence}</span><strong>{winner.ticketNumber}</strong></li>)}</ol><p className="presentation-completion">{mode === 'live' ? 'Presentation complete. Continue safely to Pending Results when ready.' : 'Practice presentation complete. Reset the rehearsal to run it again, or return to the DrawSession queue.'}</p><div className="presentation-action-row">{mode === 'practice' ? resetControl : null}<Button onClick={() => { void controller.handoff() }}>{mode === 'live' ? 'Continue safely to Pending' : 'Return to Draw Sessions'}</Button></div></PresentationFrame>
}

function PresentationFrame({ children, result, blackoutControl, operatorControl, blackoutRequested, mode, eventName, prizeCategory, prizeName, heading, announcement, audienceStatus, recap, previewStage, backTo }: { children: ReactNode; result: PresentationResultProjection; blackoutControl: ReactNode; operatorControl: ReactNode; blackoutRequested: boolean; mode: 'live' | 'practice'; eventName: string; prizeCategory: string; prizeName: string; heading: string; announcement: string; audienceStatus?: { readonly label: string; readonly detail: string; readonly displayUrl: string | null }; recap?: ProductionDrawRecap; previewStage: 'countdown' | 'rolling' | 'reveal'; backTo?: string }) {
  return <section className={`production-presentation production-draw-run-shell${blackoutRequested ? ' production-presentation--blackout' : ''}`} aria-labelledby="presentation-heading"><ProductionDrawRunHeader backTo={backTo} mode={mode} stage={heading} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} recap={recap} audienceStatus={audienceStatus} /><div className="presentation-header-actions">{blackoutControl}{operatorControl}</div><p className="sr-only" role="status" aria-live="polite">{announcement}</p><div className="production-presentation-grid"><div className="production-presentation__content">{children}</div><PresentationSupport recap={recap} previewStage={previewStage} audienceStatus={audienceStatus} eventName={eventName} prizeCategory={prizeCategory} prizeName={prizeName} result={result} blackoutRequested={blackoutRequested} /></div></section>
}

function PresentationSupport({ recap, previewStage, audienceStatus, eventName, prizeCategory, prizeName, result, blackoutRequested }: { readonly recap?: ProductionDrawRecap; readonly previewStage: 'countdown' | 'rolling' | 'reveal' | 'pending-handoff'; readonly audienceStatus?: { readonly label: string; readonly detail: string; readonly displayUrl: string | null }; readonly eventName: string; readonly prizeCategory: string; readonly prizeName: string; readonly result?: PresentationResultProjection; readonly blackoutRequested: boolean }) {
  return <aside className="production-presentation-support"><Card padding="md"><div className="production-support-section"><div className="production-support-section__heading"><span>Audience preview</span><Badge variant={blackoutRequested ? 'danger' : previewStage === 'reveal' || previewStage === 'pending-handoff' ? 'success' : 'info'}>{blackoutRequested ? 'Blackout' : previewStage === 'pending-handoff' ? 'Completed' : previewStage}</Badge></div><div className="production-preview" data-testid="production-preview" data-public-stage={blackoutRequested ? 'blackout' : previewStage}><strong>{eventName}</strong><span>{prizeCategory} · {prizeName}</span>{blackoutRequested ? <div className="production-preview__blackout">Audience is blacked out</div> : previewStage === 'countdown' ? <div className="production-preview__countdown">Countdown</div> : previewStage === 'rolling' ? <div className="production-preview__rolling">Selecting winners</div> : <div className="production-preview__tickets">{result?.winners.map((winner) => <code key={winner.winnerId}>{winner.ticketNumber}</code>)}</div>}</div></div><div className="production-support-section"><div className="production-support-section__heading"><span>Runtime status</span></div><small className="production-support-section__detail">Audience acknowledgement: {audienceStatus?.detail ?? 'No publisher status.'}</small><dl className="production-recap"><div><dt>Winner count</dt><dd>{recap?.winnerCount ?? result?.winners.length ?? '—'}</dd></div><div><dt>Eligible pool</dt><dd>{recap?.eligibleCount ?? '—'}</dd></div><div><dt>Winning rule</dt><dd>{recap?.winningRule ?? '—'}</dd></div><div><dt>Presentation</dt><dd>{recap === undefined ? '—' : `${recap.countdownSeconds}s countdown · ${recap.rollingSeconds}s rolling`}</dd></div></dl></div></Card></aside>
}
