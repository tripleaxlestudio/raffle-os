import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { DrawCommandInput } from '../../application/draw/draw-command.types.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import { queryDrawReadiness } from '../../application/draw/draw-readiness-query.ts'
import type { DrawReadinessResult } from '../../application/draw/draw-readiness.types.ts'
import { createHoldController, type HoldController } from '../../application/draw/live-start-gate-controller.ts'
import { LiveStartGateError, toLiveStartGateError } from '../../application/draw/live-start-gate-errors.ts'
import { clearPracticeResult, practiceResultFromWinners, readPracticeResultForPresentation, savePracticeResult, type PracticeResultProjection } from '../../application/draw/practice-result-storage.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Button, Card, ConfirmationDialog, Toast } from '../../shared/ui/index.ts'
import { projectLivePresentationResult, type PresentationResultProjection } from '../../application/workflow/presentation-projection.ts'
import { ProductionDrawPresentation, ProductionDrawRunHeader } from '../../ui/operator/draw/ProductionDrawPresentation.tsx'
import { PresentationError, safePresentationMessage } from '../../application/workflow/presentation-errors.ts'
import type { PresentationCheckpointRecord } from '../../domain/workflow/presentation-checkpoint.types.ts'
import { useProductionAudiencePublisher, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { presentAudienceConnection } from '../../ui/operator/draw/audience-connection-view-model.ts'
import { presentationPolicyFromSettings } from '../../application/workflow/presentation-policy.ts'

type GateState = 'loading' | 'ready' | 'holding' | 'invoking' | 'locked' | 'error'

function safeCommandError(result: Awaited<ReturnType<NonNullable<ReturnType<typeof createDrawSetupProductionServices>['command']>['execute']>>): LiveStartGateError {
  if (result.ok) return new LiveStartGateError('unexpected-failure', 'The draw entered an unexpected state.', 'retryable')
  const retryable = result.error.kind === 'persistence' || result.error.code === 'participants-load-failed'
  const code = result.error.code === 'session-not-ready' ? 'session-already-started' : result.error.code === 'session-event-mismatch' || result.error.code === 'session-category-mismatch' || result.error.code === 'session-configuration-mismatch' ? 'relationship-mismatch' : result.error.code === 'candidate-pool-failed' ? 'eligibility-failure' : result.error.code === 'persistence-failed' ? 'persistence-write-failure' : 'unexpected-failure'
  return new LiveStartGateError(code, result.error.message, retryable ? 'retryable' : 'return-to-setup')
}

export function DrawRunPage() {
  const audience = useProductionAudiencePublisher()
  const workspace = useProductionWorkspace()
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const navigate = useNavigate()
  const { drawSessionId } = useParams<{ drawSessionId: string }>()
  const sessionId = drawSessionId as DrawSessionId | undefined
  const [readiness, setReadiness] = useState<DrawReadinessResult | null>(null)
  const [state, setState] = useState<GateState>('loading')
  const [error, setError] = useState<LiveStartGateError | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [holding, setHolding] = useState(false)
  const [practiceProjection, setPracticeProjection] = useState<PracticeResultProjection | null>(null)
  const [presentationResult, setPresentationResult] = useState<PresentationResultProjection | null>(null)
  const [presentationBootstrapError, setPresentationBootstrapError] = useState<PresentationError | null>(null)
  const [checkpoint, setCheckpoint] = useState<PresentationCheckpointRecord | null>(null)
  const [displayConfigurationId, setDisplayConfigurationId] = useState<string | undefined>(undefined)
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [toast, setToast] = useState<{ readonly variant: 'success' | 'danger'; readonly title: string; readonly description: string } | null>(null)
  const [audienceStatus, setAudienceStatus] = useState(audience.status)
  const attemptRef = useRef(false)
  const resetInFlightRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const holdRef = useRef<HoldController | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    setError(null)
    setPresentationBootstrapError(null)
    try {
      if (drawSessionId === undefined || services.checkStorage === undefined || services.checkCrypto === undefined) {
        setReadiness({ state: 'failed', retryable: false, reason: 'This DrawSession URL is invalid.' })
        setState('error')
        return
      }
      await services.open()
      const next = await queryDrawReadiness(drawSessionId, { ...services, checkStorage: services.checkStorage, checkCrypto: services.checkCrypto })
      setReadiness(next)
      if (next.data !== undefined && services.displayConfigurations !== undefined) setDisplayConfigurationId((await services.displayConfigurations.findByEventId(next.data.event.id))?.id)
      if (next.data?.session.status === 'pending-confirmation') {
        const winners = await services.winners.findByDrawSessionId(sessionId!)
        if (winners.length > 0) {
          const savedCheckpoint = services.presentationCheckpoints === undefined ? null : await services.presentationCheckpoints.findByDrawSessionId(sessionId!)
          if (savedCheckpoint?.stage === 'pending-handoff' || savedCheckpoint === null) { navigate(`/draw/pending/${sessionId}`, { replace: true }); return }
          setCheckpoint(savedCheckpoint)
          setPresentationResult(projectLivePresentationResult(sessionId!, winners))
          setState('locked')
          return
        }
      }
      if (next.state === 'ready' && next.data?.session.mode === 'practice') {
        const storedPracticeResult = readPracticeResultForPresentation(sessionId as DrawSessionId)
        if (storedPracticeResult !== null && storedPracticeResult.winners.length === next.data.requestedWinnerCount) {
          setPresentationResult(storedPracticeResult)
          setPracticeProjection(storedPracticeResult)
          setState('locked')
          return
        }
      }
      setState(next.state === 'ready' ? 'ready' : 'error')
    } catch (cause: unknown) {
      if (cause instanceof PresentationError) {
        setPresentationBootstrapError(cause)
        setState('error')
        return
      }
      setError(toLiveStartGateError(cause))
      setState('error')
    }
  }, [drawSessionId, navigate, services, sessionId])

  useEffect(() => { void Promise.resolve().then(load) }, [load])
  useEffect(() => audience.subscribe(setAudienceStatus), [audience])

  const attemptStart = useCallback(async () => {
    if (attemptRef.current || sessionId === undefined || readiness?.data === undefined || services.command === undefined) return
    attemptRef.current = true
    setHolding(false)
    setState('invoking')
    setError(null)
    const data = readiness.data
    const input: DrawCommandInput = { drawSessionId: sessionId, eventId: data.event.id, configurationId: data.configuration.id, prizeCategoryId: data.category.id, mode: data.session.mode, expectedStatus: 'ready' }
    try {
      const latest = await queryDrawReadiness(sessionId, { ...services, checkStorage: services.checkStorage!, checkCrypto: services.checkCrypto! })
      if (latest.state !== 'ready' || latest.data === undefined) throw new LiveStartGateError(latest.errorCode === 'session-not-ready' ? 'session-already-started' : latest.errorCode === 'insufficient-capacity' ? 'insufficient-capacity' : 'stale-configuration', latest.reason ?? 'The persisted DrawSession changed and is no longer ready.', latest.retryable ? 'retryable' : 'return-to-setup')
      const result = await services.command.execute({ ...input, eventId: latest.data.event.id, configurationId: latest.data.configuration.id, prizeCategoryId: latest.data.category.id, mode: latest.data.session.mode })
      if (!result.ok) {
        const readBack = await services.sessions.findById(sessionId)
        const winners = await services.winners.findByDrawSessionId(sessionId)
        if (readBack?.status === 'pending-confirmation' && winners.length > 0) {
          setState('locked')
          return
        }
        throw safeCommandError(result)
      }
      if (data.session.mode === 'practice') {
        const projection = practiceResultFromWinners(sessionId, result.value.pendingWinners, result.value.auditRecord.timestamp)
        savePracticeResult(projection)
        setPracticeProjection(projection)
        setPresentationResult(projection)
        setState('locked')
        return
      }
      const officialSession = await services.sessions.findById(sessionId)
      const officialWinners = await services.winners.findByDrawSessionId(sessionId)
      if (officialSession?.status !== 'pending-confirmation' || officialWinners.length === 0) throw new LiveStartGateError('official-result-persisted-response-failed', 'The official result could not be verified after the command completed. Do not retry from this screen; reload to read the authoritative session.', 'resolve-existing-result')
      setPresentationResult(projectLivePresentationResult(sessionId!, officialWinners))
      setState('locked')
    } catch (cause: unknown) {
      setError(toLiveStartGateError(cause))
      setState('error')
    }
  }, [readiness, services, sessionId])

  useEffect(() => {
    if (state !== 'ready' || readiness?.data === undefined) return
    const controller = createHoldController(() => attemptStart())
    holdRef.current = controller
    return () => { controller.dispose(); holdRef.current = null; setHolding(false) }
  }, [attemptStart, readiness?.data, state])

  useEffect(() => {
    const cancel = () => { holdRef.current?.cancel(); setHolding(false) }
    window.addEventListener('blur', cancel)
    return () => window.removeEventListener('blur', cancel)
  }, [])

  function beginHold() { if (state === 'ready' && !attemptRef.current) { setHolding(true); holdRef.current?.begin() } }
  function cancelHold() { holdRef.current?.cancel(); setHolding(false) }
  function handleSpace(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === ' ') { event.preventDefault(); if (event.type === 'keydown') beginHold(); else cancelHold() }
  }

  const closeConfirm = useCallback(() => { setConfirmOpen(false); triggerRef.current?.focus() }, [])
  const confirmStart = useCallback(() => { setConfirmOpen(false); void attemptStart() }, [attemptStart])
  const audienceConnection = presentAudienceConnection(audienceStatus, audience.getDiagnostics())
  const audienceDisplayUrl = workspace.status === 'ready' && workspace.displayConfiguration !== null ? `/display?eventId=${encodeURIComponent(workspace.event.id)}&displayConfigurationId=${encodeURIComponent(workspace.displayConfiguration.id)}` : null
  const restoredPresentation = useMemo(() => checkpoint ?? (practiceProjection?.presentation === undefined ? undefined : { stage: practiceProjection.presentation.stage, stageStartedAt: practiceProjection.presentation.stageStartedAt, blackoutRequested: practiceProjection.presentation.blackoutRequested ?? false }), [checkpoint, practiceProjection])
  const presentationPolicy = useMemo(() => workspace.status === 'ready' ? presentationPolicyFromSettings(workspace.eventSettings.presentation.countdownDurationSeconds, workspace.eventSettings.presentation.rollingDurationSeconds) : undefined, [workspace])

  const publishPracticeStandby = useCallback((practiceSessionId: DrawSessionId) => {
    if (workspace.status !== 'ready') throw new Error('The production workspace is not ready to publish Practice standby state.')
    const display = workspace.displayConfiguration
    if (display === null || audience.publisher === null) throw new Error('The Audience Display is not configured for this Event.')
    const settings = workspace.eventSettings
    const result = audience.publish({ drawSessionId: practiceSessionId, stage: 'standby', blackoutRequested: false, mode: 'practice', eventName: settings.displayName, eventSubtitle: settings.subtitle, primaryColor: settings.primaryColor, accentColor: settings.accentColor, logo: settings.logo === undefined ? undefined : { type: settings.logo.type, blob: settings.logo.blob }, background: settings.background === undefined ? undefined : { type: settings.background.type, blob: settings.background.blob }, blackoutAppearance: display.blackoutAppearance, safeAreaMargin: display.safeAreaMargin })
    if (!result.ok) throw new Error('The Audience Display standby state could not be published safely.')
  }, [audience, workspace])

  const resetPractice = useCallback(async () => {
    if (resetInFlightRef.current || sessionId === undefined || readiness?.data?.mode !== 'practice') return
    resetInFlightRef.current = true
    setResetConfirmationOpen(false)
    setResetting(true)
    setToast(null)
    let cleared = false
    try {
      clearPracticeResult(sessionId)
      cleared = true
      publishPracticeStandby(sessionId)
      attemptRef.current = false
      setHolding(false)
      setPracticeProjection(null)
      setPresentationResult(null)
      setCheckpoint(null)
      setError(null)
      setPresentationBootstrapError(null)
      setState('ready')
      setToast({ variant: 'success', title: 'Rehearsal reset', description: 'Practice is ready to run again.' })
    } catch (cause: unknown) {
      if (cleared) {
        attemptRef.current = false
        setHolding(false)
        setPracticeProjection(null)
        setPresentationResult(null)
        setCheckpoint(null)
        setError(null)
        setPresentationBootstrapError(null)
        setState('ready')
      }
      setToast({ variant: 'danger', title: 'Rehearsal reset failed', description: cause instanceof Error ? cause.message : 'Practice rehearsal could not be reset safely.' })
    } finally {
      resetInFlightRef.current = false
      setResetting(false)
    }
  }, [publishPracticeStandby, readiness?.data?.mode, sessionId])

  if (state === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Production start gate" headingId="draw-run-title" title="Draw Start Gate" description="Validating the persisted DrawSession…" /></section>
  if (presentationBootstrapError !== null) return <section aria-labelledby="draw-run-title" className="draw-setup draw-run-production"><div className="production-draw-run-shell"><ProductionDrawRunHeader mode={readiness?.data?.mode ?? 'practice'} stage="Presentation recovery" eventName={readiness?.data?.event.name ?? 'Current event'} prizeCategory={readiness?.data?.category.name ?? 'Current category'} prizeName={readiness?.data?.category.prizeName ?? 'Current prize'} audienceStatus={{ label: audienceConnection.label, detail: audienceConnection.detail, displayUrl: audienceDisplayUrl }} /><Card className="production-recovery-card" padding="lg"><p className="operator-eyebrow">Presentation recovery</p><h2>Presentation paused safely</h2><p>{safePresentationMessage(presentationBootstrapError)}</p><p>The locked result was preserved.</p><div className="draw-action-bar__actions"><Button onClick={() => { attemptRef.current = false; void load() }}>Retry presentation</Button>{readiness?.data?.mode === 'practice' ? <Button variant="secondary" onClick={() => setResetConfirmationOpen(true)}>Reset rehearsal</Button> : null}<Button variant="secondary" onClick={() => navigate('/draw/setup')}>Back to Draw Setup</Button></div></Card></div><ConfirmationDialog open={resetConfirmationOpen} onCancel={() => setResetConfirmationOpen(false)} onConfirm={() => { void resetPractice() }} title="Reset this rehearsal?" confirmLabel="Reset rehearsal" consequence="Practice winners and presentation progress will be cleared. No official results will be affected." tone="warning" /></section>
  if (state === 'locked' && readiness?.data !== undefined && presentationResult !== null) return <section aria-labelledby="draw-run-title" className="draw-setup draw-run-production"><h1 id="draw-run-title" className="sr-only">Result Locked</h1><p className="sr-only" role="region" aria-label={`${presentationResult.winners.length} winners selected`}>{presentationResult.winners.length} winners selected</p>{practiceProjection === null ? null : <p className="sr-only">Practice projection restored for this tab; ticket reveal remains deferred.</p>}{toast === null ? null : <Toast title={toast.title} description={toast.description} onDismiss={() => setToast(null)} urgent={toast.variant === 'danger'} variant={toast.variant} />}<ProductionDrawPresentation result={presentationResult} mode={readiness.data.mode} eventId={readiness.data.event.id} displayConfigurationId={displayConfigurationId} eventName={readiness.data.event.name} prizeCategory={readiness.data.category.name} prizeName={readiness.data.category.prizeName} recap={{ winnerCount: readiness.data.configuration.requestedWinners, eligibleCount: readiness.data.authoritativeEligibleCount, winningRule: readiness.data.configuration.winningRule, countdownSeconds: workspace.status === 'ready' ? workspace.eventSettings.presentation.countdownDurationSeconds : 3, rollingSeconds: workspace.status === 'ready' ? workspace.eventSettings.presentation.rollingDurationSeconds : 8 }} checkpoints={services.presentationCheckpoints} practiceResult={practiceProjection ?? undefined} initialPresentation={restoredPresentation} presentationPolicy={presentationPolicy} audienceStatus={{ label: audienceConnection.label, detail: audienceConnection.detail, displayUrl: audienceDisplayUrl }} sharedPublisher={audience.publisher} onHandoff={() => navigate(readiness.data?.mode === 'live' ? `/draw/pending/${sessionId}` : '/draw/live')} onFailure={() => undefined} onResetPractice={readiness.data.mode === 'practice' ? () => setResetConfirmationOpen(true) : undefined} resetPending={resetting} /><ConfirmationDialog open={resetConfirmationOpen} onCancel={() => setResetConfirmationOpen(false)} onConfirm={() => { void resetPractice() }} title="Reset this rehearsal?" confirmLabel="Reset rehearsal" consequence="Practice winners and presentation progress will be cleared. No official results will be affected." tone="warning" /></section>
  if (readiness?.data === undefined) return <section aria-labelledby="draw-run-title"><PageHeader eyebrow="Production start gate" headingId="draw-run-title" title="Draw Start Gate" description="The persisted session is not ready for the next workflow." /><StatusBanner badge="Blocked" title={error?.message ?? 'Cannot open this DrawSession'} tone="warning">{readiness?.reason ?? 'Verify the persisted setup and return to Draw Setup.'}</StatusBanner><div className="draw-action-bar__actions"><Button onClick={() => { attemptRef.current = false; void load() }} disabled={!readiness?.retryable && error === null}>Retry validation</Button><Button variant="secondary" onClick={() => navigate('/draw/setup')}>Back to Draw Setup</Button></div></section>

  const data = readiness.data
  const live = data.mode === 'live'
  return <section aria-labelledby="draw-run-title" className="draw-setup draw-run-production">
    <div className="production-draw-run-shell"><ProductionDrawRunHeader mode={data.mode} stage="Ready to start" eventName={data.event.name} prizeCategory={data.category.name} prizeName={data.category.prizeName} recap={{ winnerCount: data.configuration.requestedWinners, eligibleCount: data.authoritativeEligibleCount, winningRule: data.configuration.winningRule, countdownSeconds: workspace.status === 'ready' ? workspace.eventSettings.presentation.countdownDurationSeconds : 3, rollingSeconds: workspace.status === 'ready' ? workspace.eventSettings.presentation.rollingDurationSeconds : 8 }} audienceStatus={{ label: audienceConnection.label, detail: audienceConnection.detail, displayUrl: audienceDisplayUrl }} /><div className="production-draw-run-ready-grid">
    <div className="live-ready__layout"><div className="live-ready__main"><Card padding="md"><h2>Locked persisted recap</h2><dl className="summary-list"><div className="summary-list__item"><dt>Event</dt><dd>{data.event.name}</dd></div><div className="summary-list__item"><dt>Prize category</dt><dd>{data.category.name}</dd></div><div className="summary-list__item"><dt>Prize</dt><dd>{data.category.prizeName}</dd></div><div className="summary-list__item"><dt>Winner count</dt><dd>{data.configuration.requestedWinners}</dd></div><div className="summary-list__item"><dt>Eligible participants</dt><dd>{data.authoritativeEligibleCount}</dd></div><div className="summary-list__item"><dt>Winning rule</dt><dd>{data.configuration.winningRule}</dd></div><div className="summary-list__item"><dt>Check-in</dt><dd>{data.configuration.requireCheckIn ? 'Required' : 'Not required'}</dd></div><div className="summary-list__item"><dt>Eligible group</dt><dd>{data.configuration.eligibleGroupFilter ?? 'All groups'}</dd></div><div className="summary-list__item"><dt>Persisted mode</dt><dd>{live ? 'Live — official' : 'Practice — not official'}</dd></div></dl></Card><StatusBanner badge={live ? 'Irreversible Live action' : 'Rehearsal only'} title={live ? 'This starts one official draw' : 'This result will not affect official history'} tone={live ? 'warning' : 'info'}>{live ? 'The authoritative session and eligibility will be checked again immediately before the Phase 5 command runs.' : 'Practice uses secure selection and the persisted setup, but writes only a minimal result projection to this browser tab.'}</StatusBanner></div><aside className="live-ready__aside"><Card padding="md"><div className="start-control"><span className="start-control__mode">{live ? 'Live / official' : 'Practice / rehearsal'}</span><h2>{holding ? 'Keep holding…' : 'Start draw'}</h2><p>{holding ? 'Release cancels. Hold for 1.5 seconds.' : live ? 'Hold the control or use accessible confirmation.' : 'Hold for 1.5 seconds to begin the rehearsal.'}</p><Button ref={triggerRef} className="start-control__button" disabled={state !== 'ready'} onPointerDown={beginHold} onPointerUp={cancelHold} onPointerCancel={cancelHold} onLostPointerCapture={cancelHold} onPointerLeave={cancelHold} onKeyDown={handleSpace} onKeyUp={handleSpace} aria-label={live ? 'Hold to start official Live draw' : 'Hold to start Practice draw'}>{holding ? 'Holding to start' : 'Hold to start'}</Button><Button variant="secondary" onClick={() => setConfirmOpen(true)} disabled={state !== 'ready'}>Use accessible start confirmation</Button><Link to="/draw/setup">Back to Draw Setup</Link></div></Card></aside></div>
    <ConfirmationDialog open={confirmOpen} onCancel={closeConfirm} onConfirm={confirmStart} title={live ? 'Confirm official Live start' : 'Confirm Practice start'} confirmLabel={live ? 'Confirm and start Live' : 'Confirm and start Practice'} consequence={live ? 'This invokes the secure Phase 5 command and creates the official persisted result. It cannot be undone from this screen.' : 'This runs secure selection for rehearsal only. It does not create WinnerRecords or change official history.'} />
    {toast === null ? null : <Toast title={toast.title} description={toast.description} onDismiss={() => setToast(null)} urgent={toast.variant === 'danger'} variant={toast.variant} />}
    <ConfirmationDialog open={resetConfirmationOpen} onCancel={() => setResetConfirmationOpen(false)} onConfirm={() => { void resetPractice() }} title="Reset this rehearsal?" confirmLabel="Reset rehearsal" consequence="Practice winners and presentation progress will be cleared. No official results will be affected." tone="warning" />
    </div></div>
  </section>
}
