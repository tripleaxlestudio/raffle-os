import { useUiClass } from '../../shared/ui/ui-theme.ts'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { DrawCommandInput } from '../../application/draw/draw-command.types.ts'
import type { CommandId, DrawSessionId, WinnerRecordId } from '../../domain/shared/identifiers.ts'
import { queryDrawReadiness } from '../../application/draw/draw-readiness-query.ts'
import type { DrawReadinessResult } from '../../application/draw/draw-readiness.types.ts'
import { createHoldController, type HoldController } from '../../application/draw/live-start-gate-controller.ts'
import { LiveStartGateError, toLiveStartGateError } from '../../application/draw/live-start-gate-errors.ts'
import { clearPracticeResult, practiceResultFromWinners, readPracticeResultForPresentation, savePracticeResult, type PracticeResultProjection } from '../../application/draw/practice-result-storage.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import { Button, ButtonLink, Card, ConfirmationDialog, Icon, Toast } from '../../shared/ui/index.ts'
import { projectLiveDrawRun, projectLivePresentationResult, type PresentationResultProjection } from '../../application/workflow/presentation-projection.ts'
import { PresentationSupport, ProductionDrawPresentation, ProductionDrawRunHeader } from '../../ui/operator/draw/ProductionDrawPresentation.tsx'
import { PresentationRecoveryDialog } from '../../ui/operator/draw/PresentationRecoveryDialog.tsx'
import { PresentationError } from '../../application/workflow/presentation-errors.ts'
import type { PresentationCheckpointRecord } from '../../domain/workflow/presentation-checkpoint.types.ts'
import { useIntentionalRedrawTransition, useProductionAudiencePublisher, useProductionWorkspace } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { signalProductionWorkspaceChanged } from '../../app/workspace/ProductionWorkspaceContext.tsx'
import { presentAudienceConnection } from '../../ui/operator/draw/audience-connection-view-model.ts'
import { presentationPolicyFromSettings } from '../../application/workflow/presentation-policy.ts'
import { resolveDrawPresentationConfiguration, type DrawPresentationConfiguration } from '../../domain/draws/draw-presentation.types.ts'
import { createDrawRunPreflight, type DrawRunPreflight } from '../../application/draw/draw-run-preflight.ts'
import { calculateReplacementCapacity } from '../../application/pending-decisions/capacity-query.ts'
import { evaluateLiveSessionRecovery } from '../../application/workflow/live-session-recovery.ts'
import type { RedrawRequest } from '../../domain/winners/redraw-request.types.ts'
import { resolveDisplayAppearance } from '../../domain/display/display-configuration.types.ts'

type GateState = 'loading' | 'ready' | 'holding' | 'invoking' | 'locked' | 'error'

type CheckpointRecoveryError = 'corrupt' | 'unsupported' | 'stale'

function checkpointRecoveryError(cause: unknown): CheckpointRecoveryError | undefined {
  if (!(cause instanceof Error)) return undefined
  const code = 'code' in cause && typeof cause.code === 'string' ? cause.code : ''
  if (code === 'unsupported-checkpoint-version' || cause.name === 'UnsupportedCheckpointVersionError') return 'unsupported'
  if (code === 'stale-checkpoint' || cause.name === 'StaleCheckpointError') return 'stale'
  if (code === 'invalid-checkpoint' || code === 'checkpoint-read-failed' || cause.name === 'InvalidCheckpointError' || cause.name === 'CheckpointReadError') return 'corrupt'
  return undefined
}

function safeCommandError(result: Awaited<ReturnType<NonNullable<ReturnType<typeof createDrawSetupProductionServices>['command']>['execute']>>): LiveStartGateError {
  if (result.ok) return new LiveStartGateError('unexpected-failure', 'The draw entered an unexpected state.', 'retryable')
  const retryable = result.error.kind === 'persistence' || result.error.code === 'participants-load-failed'
  const code = result.error.code === 'session-not-ready' ? 'session-already-started' : result.error.code === 'session-event-mismatch' || result.error.code === 'session-category-mismatch' || result.error.code === 'session-configuration-mismatch' ? 'relationship-mismatch' : result.error.code === 'candidate-pool-failed' ? 'eligibility-failure' : result.error.code === 'persistence-failed' ? 'persistence-write-failure' : 'unexpected-failure'
  return new LiveStartGateError(code, result.error.message, retryable ? 'retryable' : 'return-to-setup')
}

function projectRedrawRequest(request: RedrawRequest): PresentationResultProjection | null {
  if (request.selections === undefined || request.selections.length !== request.replacementCount) return null
  return {
    drawSessionId: request.drawSessionId,
    winners: [...request.selections]
      .sort((left, right) => left.selectionOrder - right.selectionOrder)
      .map((selection) => ({ winnerId: selection.winnerRecordId, sequence: selection.selectionOrder, ticketNumber: selection.ticketNumber })),
  }
}

export function DrawRunPage() {
  const uiClass = useUiClass()
  const audience = useProductionAudiencePublisher()
  const workspace = useProductionWorkspace()
  const authoritativeAudienceSnapshot = useSyncExternalStore(audience.subscribeSnapshot, audience.getSnapshot, audience.getSnapshot)
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const navigate = useNavigate()
  const { drawSessionId } = useParams<{ drawSessionId: string }>()
  const sessionId = drawSessionId as DrawSessionId | undefined
  const redrawTransition = useIntentionalRedrawTransition()
  const intentionalHandoff = redrawTransition.handoff?.drawSessionId === sessionId ? redrawTransition.handoff : null
  const [readiness, setReadiness] = useState<DrawReadinessResult | null>(() => intentionalHandoff?.readiness ?? null)
  const [preflight, setPreflight] = useState<DrawRunPreflight | null>(null)
  const [state, setState] = useState<GateState>(() => intentionalHandoff === null ? 'loading' : 'ready')
  const [error, setError] = useState<LiveStartGateError | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [holding, setHolding] = useState(false)
  const [practiceProjection, setPracticeProjection] = useState<PracticeResultProjection | null>(null)
  const [presentationResult, setPresentationResult] = useState<PresentationResultProjection | null>(null)
  const [activeRedrawPresentationResult, setActiveRedrawPresentationResult] = useState<PresentationResultProjection | null>(null)
  const [redrawRequest, setRedrawRequest] = useState<RedrawRequest | null>(() => intentionalHandoff?.request ?? null)
  const [redrawLineage, setRedrawLineage] = useState<ReturnType<typeof projectLiveDrawRun>['lineage'] | undefined>(undefined)
  const [presentationBootstrapError, setPresentationBootstrapError] = useState<PresentationError | null>(null)
  const [pendingReviewAvailable, setPendingReviewAvailable] = useState(false)
  const [runtimeEligibleCount, setRuntimeEligibleCount] = useState<number | null>(() => intentionalHandoff?.readiness.data?.authoritativeEligibleCount ?? null)
  const [checkpoint, setCheckpoint] = useState<PresentationCheckpointRecord | null>(null)
  const [displayConfigurationId, setDisplayConfigurationId] = useState<string | undefined>(() => intentionalHandoff?.displayConfigurationId)
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [toast, setToast] = useState<{ readonly variant: 'success' | 'danger'; readonly title: string; readonly description: string } | null>(null)
  const [audienceStatus, setAudienceStatus] = useState(audience.status)
  const audienceRef = useRef(audience)
  const attemptedStartKeyRef = useRef<string | null>(null)
  const resetInFlightRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const holdRef = useRef<HoldController | null>(null)
  const bootstrapGenerationRef = useRef(0)

  const refreshPendingReviewAvailability = useCallback(async () => {
    if (sessionId === undefined) {
      setPendingReviewAvailable(false)
      return
    }
    try {
      const authoritativeSession = await services.sessions.findById(sessionId)
      if (authoritativeSession?.mode !== 'live' || authoritativeSession.status !== 'pending-confirmation') {
        setPendingReviewAvailable(false)
        return
      }
      const winners = await services.winners.findByDrawSessionId(sessionId)
      setPendingReviewAvailable(winners.some((winner) => winner.status === 'pending'))
    } catch {
      setPendingReviewAvailable(false)
    }
  }, [services, sessionId])

  const reviewPendingResults = useCallback(() => {
    if (sessionId !== undefined) navigate(`/draw/pending/${sessionId}`)
  }, [navigate, sessionId])

  const quickRedrawWinner = useCallback(async (requestedWinnerIds: readonly WinnerRecordId[]) => {
    if (sessionId === undefined || presentationResult === null || readiness?.data?.mode !== 'live' || requestedWinnerIds.length === 0 || services.pendingDecisions === undefined) throw new Error('The locked Live winner is not available for a quick redraw.')
    const authoritativeSession = await services.sessions.findById(sessionId)
    const winners = await services.winners.findByDrawSessionId(sessionId)
    const projectionWinnerIds = new Set(presentationResult.winners.map((winner) => winner.winnerId))
    const targets = requestedWinnerIds.map((winnerId) => winners.find((winner) => winner.id === winnerId)).filter((winner): winner is (typeof winners)[number] => winner !== undefined && projectionWinnerIds.has(winner.id) && winner.status === 'pending')
    if (authoritativeSession?.status !== 'pending-confirmation' || targets.length !== requestedWinnerIds.length) throw new Error('One or more selected winners are no longer pending. Review the current result before changing it.')
    const command = { actor: 'local-operator' as const, commandId: crypto.randomUUID() as CommandId, drawSessionId: sessionId, mode: 'live' as const, operation: 'redraw-pending-winners' as const, reason: 'absent' as const, targets: targets.map((target) => ({ winnerId: target.id, expectedStatus: 'pending' as const })) }
    const outcome = await services.pendingDecisions.redraw.redraw(command)
    if ('error' in outcome) throw new Error(outcome.error.message)
    signalProductionWorkspaceChanged()
    const request = await services.redrawRequests?.findActiveByDrawSessionId(sessionId)
    if (request === undefined || request === null) throw new Error('Permintaan undi ulang tersimpan tetapi tidak dapat dibaca kembali.')
    setRedrawRequest(request)
    setPresentationResult(null)
    setActiveRedrawPresentationResult(null)
    setCheckpoint(null)
    setPendingReviewAvailable(false)
    setState('ready')
  }, [presentationResult, readiness?.data?.mode, services, sessionId])

  const handlePresentationFailure = useCallback(() => {
    void refreshPendingReviewAvailability()
  }, [refreshPendingReviewAvailability])

  const load = useCallback(async () => {
    const generation = ++bootstrapGenerationRef.current
    const isCurrent = () => bootstrapGenerationRef.current === generation
    if (intentionalHandoff === null) {
      setState('loading')
      setError(null)
      setPresentationBootstrapError(null)
      setPendingReviewAvailable(false)
      setRedrawLineage(undefined)
      setActiveRedrawPresentationResult(null)
      setRedrawRequest(null)
    }
    try {
      if (drawSessionId === undefined || services.checkStorage === undefined || services.checkCrypto === undefined) {
        setReadiness({ state: 'failed', retryable: false, reason: 'This DrawSession URL is invalid.' })
        setState('error')
        return
      }
      await services.open()
      const next = await queryDrawReadiness(drawSessionId, { ...services, checkStorage: services.checkStorage, checkCrypto: services.checkCrypto })
      if (!isCurrent()) return
      setReadiness(next)
      setRuntimeEligibleCount(next.data?.authoritativeEligibleCount ?? null)
      const displayConfiguration = next.data === undefined ? null : services.displayConfigurations === undefined ? undefined : await services.displayConfigurations.findByEventId(next.data.event.id)
      if (!isCurrent()) return
      setDisplayConfigurationId(displayConfiguration?.id)
      const currentAudience = audienceRef.current
      const audienceConnectionLabel = presentAudienceConnection(currentAudience.status, currentAudience.getDiagnostics()).label
      const nextAudienceState = displayConfiguration === null ? 'setup-required' : audienceConnectionLabel === 'Terhubung' ? 'connected' : audienceConnectionLabel === 'Tidak tersedia' || audienceConnectionLabel === 'Publikasi gagal' ? 'unavailable' : 'waiting'
      const nextPreflight = createDrawRunPreflight(next, displayConfiguration, nextAudienceState)
      setPreflight(nextPreflight)
      let activeRedrawRequest = next.data === undefined ? null : await services.redrawRequests?.findActiveByDrawSessionId(next.data.session.id) ?? null
      if (!isCurrent()) return
      if (activeRedrawRequest !== null) {
        if (next.data?.mode !== 'live' || next.data.session.status !== 'pending-confirmation') throw new PresentationError('invalid-stage-transition', 'Permintaan undi ulang tidak lagi terhubung ke hasil Live yang tertunda.', false, true)
        setRuntimeEligibleCount(calculateReplacementCapacity({ candidatePoolSnapshot: next.data.session.candidatePoolSnapshot, drawSessionId: next.data.session.id, requestedReplacementCount: activeRedrawRequest.replacementCount, targetWinnerIds: activeRedrawRequest.targets.map((target) => target.winnerId), winners: await services.winners.findByDrawSessionId(next.data.session.id) }).eligibleCandidateCount)
        if (!isCurrent()) return
        if (activeRedrawRequest.status === 'running') {
          const projection = projectRedrawRequest(activeRedrawRequest)
          if (projection === null) throw new PresentationError('practice-projection-invalid', 'Pilihan aman undi ulang tidak lengkap dan tidak dapat dipresentasikan.', false, true)
          const savedCheckpoint = services.presentationCheckpoints === undefined ? null : await services.presentationCheckpoints.findByDrawSessionId(next.data.session.id)
          if (!isCurrent()) return
          if ((savedCheckpoint?.stage === 'reveal' || savedCheckpoint?.stage === 'pending-handoff') && services.pendingDecisions !== undefined) {
            activeRedrawRequest = await services.pendingDecisions.redraw.complete(activeRedrawRequest.id)
            signalProductionWorkspaceChanged()
          }
          setRedrawRequest(activeRedrawRequest)
          setCheckpoint(savedCheckpoint)
          setPresentationResult(projection)
          setActiveRedrawPresentationResult(projection)
          setState('locked')
        } else {
          setRedrawRequest(activeRedrawRequest)
          setCheckpoint(null)
          setPresentationResult(null)
          setState('ready')
        }
        return
      }
      if (next.data?.mode === 'live' && (next.data.session.status === 'drawing' || next.data.session.status === 'pending-confirmation')) {
        const winners = await services.winners.findByDrawSessionId(sessionId!)
        const redraws = services.redraws === undefined ? [] : await services.redraws.findByDrawSessionId(sessionId!)
        let savedCheckpoint: PresentationCheckpointRecord | null = null
        let checkpointError: CheckpointRecoveryError | undefined
        if (services.presentationCheckpoints !== undefined) {
          try {
            savedCheckpoint = await services.presentationCheckpoints.findByDrawSessionId(sessionId!)
          } catch (cause: unknown) {
            checkpointError = checkpointRecoveryError(cause)
            if (checkpointError === undefined) throw cause
          }
        }
        const recovery = evaluateLiveSessionRecovery({ session: next.data.session, winners, redraws, checkpoint: savedCheckpoint, checkpointError })
        if (recovery.status === 'acknowledgement-required') {
          navigate(recovery.recommendedRoute, { replace: true })
          return
        }
        if (recovery.status === 'recovered-pending' || recovery.status === 'terminal-read-only') {
          const requiresPendingHandoff = checkpointError !== undefined || savedCheckpoint === null || savedCheckpoint.stage === 'pending-handoff'
          if (recovery.status === 'terminal-read-only' || requiresPendingHandoff) {
            navigate(recovery.recommendedRoute, { replace: true })
            return
          }
          setCheckpoint(savedCheckpoint)
          const projection = projectLiveDrawRun(sessionId!, recovery.winners, recovery.redraws)
          setPresentationResult(projection.result)
          setRedrawLineage(projection.lineage)
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
      setState(nextPreflight.canStart ? 'ready' : 'error')
    } catch (cause: unknown) {
      if (cause instanceof PresentationError) {
        setPresentationBootstrapError(cause)
        void refreshPendingReviewAvailability()
        setState('error')
        return
      }
      setError(toLiveStartGateError(cause))
      setState('error')
    }
  }, [drawSessionId, intentionalHandoff, navigate, refreshPendingReviewAvailability, services, sessionId])

  useEffect(() => {
    void Promise.resolve().then(load)
    return () => { bootstrapGenerationRef.current += 1 }
  }, [load])
  useEffect(() => { audienceRef.current = audience }, [audience])
  useEffect(() => audience.subscribe(setAudienceStatus), [audience])

  useEffect(() => {
    if ((readiness?.state !== 'ready' && redrawRequest === null) || readiness?.data === undefined || workspace.status !== 'ready' || workspace.displayConfiguration === null || audience.publisher === null) return
    const settings = workspace.eventSettings
    const data = readiness.data
    audience.publisher.publish({
      drawSessionId: data.session.id,
      stage: 'ready',
      blackoutRequested: false,
      mode: data.mode,
      eventName: settings.displayName,
      eventSubtitle: settings.subtitle,
      primaryColor: settings.primaryColor,
      accentColor: settings.accentColor,
      appearance: resolveDisplayAppearance(workspace.displayConfiguration, settings),
      logo: settings.logo === undefined ? undefined : { type: settings.logo.type, blob: settings.logo.blob },
      background: settings.background === undefined ? undefined : { type: settings.background.type, blob: settings.background.blob },
      blackoutAppearance: workspace.displayConfiguration.blackoutAppearance,
      safeAreaMargin: workspace.displayConfiguration.safeAreaMargin,
      prizeCategory: data.category.name,
      prizeName: data.category.prizeName,
      prizeImageAssetId: data.category.prizeImageAssetId,
      winnerCount: redrawRequest?.replacementCount ?? data.requestedWinnerCount,
    })
  }, [audience.publisher, readiness, redrawRequest, workspace])

  const startAttemptKey = redrawRequest === null ? `draw:${sessionId ?? 'invalid'}` : `redraw:${redrawRequest.id}`

  const attemptStart = useCallback(async () => {
    if (attemptedStartKeyRef.current === startAttemptKey || sessionId === undefined || readiness?.data === undefined) return
    attemptedStartKeyRef.current = startAttemptKey
    setHolding(false)
    setState('invoking')
    setError(null)
    const data = readiness.data
    try {
      if (redrawRequest !== null) {
        if (services.pendingDecisions === undefined) throw new LiveStartGateError('persistence-write-failure', 'Layanan undi ulang tidak tersedia.', 'retryable')
        const running = await services.pendingDecisions.redraw.start(redrawRequest.id)
        const projection = projectRedrawRequest(running)
        if (projection === null) throw new LiveStartGateError('official-result-persisted-response-failed', 'Pilihan aman undi ulang tersimpan tetapi tidak dapat dibaca kembali. Muat ulang layar ini; jangan memulai permintaan baru.', 'resolve-existing-result')
        setRedrawRequest(running)
        setCheckpoint(null)
        setPresentationResult(projection)
        setActiveRedrawPresentationResult(projection)
        setState('locked')
        return
      }
      if (services.command === undefined) throw new LiveStartGateError('unexpected-failure', 'Layanan Undian tidak tersedia.', 'retryable')
      if (preflight?.canStart !== true) throw new LiveStartGateError('stale-configuration', preflight?.blocker?.detail ?? 'Resolve the Draw Run preflight before starting.', 'return-to-setup')
      const input: DrawCommandInput = { drawSessionId: sessionId, eventId: data.event.id, configurationId: data.configuration.id, prizeCategoryId: data.category.id, mode: data.session.mode, expectedStatus: 'ready' }
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
      const initialReplacementCapacity = calculateReplacementCapacity({ candidatePoolSnapshot: officialSession.candidatePoolSnapshot, drawSessionId: sessionId, requestedReplacementCount: officialWinners.length, targetWinnerIds: officialWinners.map((winner) => winner.id), winners: officialWinners })
      setRuntimeEligibleCount(initialReplacementCapacity.eligibleCandidateCount)
      setPresentationResult(projectLivePresentationResult(sessionId!, officialWinners))
      setRedrawLineage(undefined)
      setState('locked')
    } catch (cause: unknown) {
      setError(toLiveStartGateError(cause))
      setState('error')
    }
  }, [preflight, readiness, redrawRequest, services, sessionId, startAttemptKey])

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

  function beginHold() { if (state === 'ready' && attemptedStartKeyRef.current !== startAttemptKey) { setHolding(true); holdRef.current?.begin() } }
  function cancelHold() { holdRef.current?.cancel(); setHolding(false) }
  function handleSpace(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === ' ') { event.preventDefault(); if (event.type === 'keydown') beginHold(); else cancelHold() }
  }

  const closeConfirm = useCallback(() => { setConfirmOpen(false); triggerRef.current?.focus() }, [])
  const confirmStart = useCallback(() => { setConfirmOpen(false); void attemptStart() }, [attemptStart])
  const audienceConnection = presentAudienceConnection(audienceStatus, audience.getDiagnostics())
  const audienceDisplayUrl = workspace.status === 'ready' && workspace.displayConfiguration !== null ? `/display?eventId=${encodeURIComponent(workspace.event.id)}&displayConfigurationId=${encodeURIComponent(workspace.displayConfiguration.id)}` : null
  const restoredPresentation = useMemo(() => checkpoint ?? (practiceProjection?.presentation === undefined ? undefined : { stage: practiceProjection.presentation.stage, stageStartedAt: practiceProjection.presentation.stageStartedAt, blackoutRequested: practiceProjection.presentation.blackoutRequested ?? false }), [checkpoint, practiceProjection])
  const presentationPolicy = useMemo(() => {
    if (workspace.status !== 'ready') return undefined
    const configuration = readiness?.data === undefined ? undefined : resolveDrawPresentationConfiguration(readiness.data.session.configurationSnapshot?.presentation ?? readiness.data.configuration.presentation)
    return { ...presentationPolicyFromSettings(workspace.eventSettings.presentation.countdownDurationSeconds, workspace.eventSettings.presentation.rollingDurationSeconds), presentationConfiguration: configuration }
  }, [readiness, workspace])
  const activePresentationCheckpoints = useMemo(() => {
    const base = services.presentationCheckpoints
    const requestId = redrawRequest?.id
    if (base === undefined || requestId === undefined || services.pendingDecisions === undefined) return base
    return {
      findByDrawSessionId: (id: DrawSessionId) => base.findByDrawSessionId(id),
      upsert: async (nextCheckpoint: PresentationCheckpointRecord) => {
        await base.upsert(nextCheckpoint)
        if (nextCheckpoint.stage === 'reveal') {
          const completed = await services.pendingDecisions!.redraw.complete(requestId)
          setRedrawRequest(completed)
          signalProductionWorkspaceChanged()
        }
      },
    }
  }, [redrawRequest?.id, services])

  const publishPracticeStandby = useCallback((practiceSessionId: DrawSessionId) => {
    if (workspace.status !== 'ready') throw new Error('The production workspace is not ready to publish Practice standby state.')
    const display = workspace.displayConfiguration
    if (display === null || audience.publisher === null) throw new Error('The Audience Display is not configured for this Event.')
    const settings = workspace.eventSettings
    const result = audience.publish({ drawSessionId: practiceSessionId, stage: 'standby', blackoutRequested: false, mode: 'practice', eventName: settings.displayName, eventSubtitle: settings.subtitle, primaryColor: settings.primaryColor, accentColor: settings.accentColor, appearance: resolveDisplayAppearance(display, settings), logo: settings.logo === undefined ? undefined : { type: settings.logo.type, blob: settings.logo.blob }, background: settings.background === undefined ? undefined : { type: settings.background.type, blob: settings.background.blob }, blackoutAppearance: display.blackoutAppearance, safeAreaMargin: display.safeAreaMargin })
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
      attemptedStartKeyRef.current = null
      setHolding(false)
      setPracticeProjection(null)
      setPresentationResult(null)
      setCheckpoint(null)
      setError(null)
      setPresentationBootstrapError(null)
      setState('ready')
      setToast({ variant: 'success', title: 'Simulasi direset', description: 'Latihan siap dijalankan kembali.' })
    } catch (cause: unknown) {
      if (cleared) {
        attemptedStartKeyRef.current = null
        setHolding(false)
        setPracticeProjection(null)
        setPresentationResult(null)
        setCheckpoint(null)
        setError(null)
        setPresentationBootstrapError(null)
        setState('ready')
      }
      setToast({ variant: 'danger', title: 'Simulasi direset failed', description: cause instanceof Error ? cause.message : 'Simulasi Latihan tidak dapat direset dengan aman.' })
    } finally {
      resetInFlightRef.current = false
      setResetting(false)
    }
  }, [publishPracticeStandby, readiness?.data?.mode, sessionId])

  if (state === 'loading') return <section aria-busy="true"><PageHeader eyebrow="Gerbang mulai produksi" headingId="draw-run-title" title="Gerbang Mulai Undian" description="Validating the persisted DrawSession…" /></section>
  if (presentationBootstrapError !== null) return <section aria-labelledby="draw-run-title" className={uiClass("draw-setup draw-run-production")}><div className={uiClass("production-draw-run-shell")}><ProductionDrawRunHeader backTo="/draw/live" mode={readiness?.data?.mode ?? 'practice'} stage="Pemulihan presentasi" eventName={readiness?.data?.event.name ?? 'Acara saat ini'} prizeCategory={readiness?.data?.category.name ?? 'Kategori saat ini'} prizeName={readiness?.data?.category.prizeName ?? 'Hadiah saat ini'} audienceStatus={{ label: audienceConnection.label, detail: audienceConnection.detail, displayUrl: audienceDisplayUrl }} /><div className={uiClass("production-recovery-background")}><Card padding="lg"><p className={uiClass("operator-eyebrow")}>Ruang kerja Pelaksanaan Undian</p><h2>Hasil pemenang terkunci</h2><p>Hasil tetap terkunci selama pemulihan presentasi tertunda.</p></Card></div></div><PresentationRecoveryDialog onBackToSetup={() => navigate('/draw/setup')} onReviewPendingResults={reviewPendingResults} reviewPendingResultsAvailable={pendingReviewAvailable} /></section>
  if (state === 'error' && error !== null && readiness?.data !== undefined) return <section aria-labelledby="draw-run-title"><PageHeader eyebrow="Gerbang mulai produksi" headingId="draw-run-title" title="Gerbang Mulai Undian" description="Undian tidak dapat dimulai dengan aman." /><StatusBanner badge="Gagal memulai" title={error.message} tone="warning">Tidak ada hasil pemenang yang disimpan. Periksa pengaturan tersimpan dan coba lagi setelah masalah diselesaikan.</StatusBanner><div className={uiClass("draw-action-bar__actions")}><Button icon={<Icon name="RefreshCw" />} onClick={() => { attemptedStartKeyRef.current = null; void load() }} disabled={error.recovery === 'return-to-setup'}>Ulangi validasi</Button><Button icon={<Icon name="ArrowLeft" />} variant="secondary" onClick={() => navigate('/draw/setup')}>Kembali ke Pengaturan Undian</Button></div></section>
  if (state === 'locked' && readiness?.data !== undefined && presentationResult !== null) {
    const lockedPresentationConfiguration = resolveDrawPresentationConfiguration(readiness.data.session.configurationSnapshot?.presentation ?? readiness.data.configuration.presentation)
    const activePresentationConfiguration: DrawPresentationConfiguration = redrawRequest === null
      ? lockedPresentationConfiguration
      : { ...lockedPresentationConfiguration, presentationMode: 'random-number-roll', rollStopMode: 'manual' }
    return <section aria-labelledby="draw-run-title" className={uiClass("draw-setup draw-run-production")}><h1 id="draw-run-title" className="sr-only">{redrawRequest === null ? 'Hasil Terkunci' : 'Undi Ulang'}</h1><p className="sr-only" role="region" aria-label={`${presentationResult.winners.length} pemenang dipilih`}>{presentationResult.winners.length} winners selected</p>{practiceProjection === null ? null : <p className="sr-only">Proyeksi Latihan dipulihkan untuk tab ini; pengungkapan tiket tetap ditunda.</p>}{toast === null ? null : <Toast title={toast.title} description={toast.description} onDismiss={() => setToast(null)} urgent={toast.variant === 'danger'} variant={toast.variant} />}<ProductionDrawPresentation backTo={redrawRequest === null ? "/draw/live" : undefined} redrawContext={redrawRequest === null ? undefined : { replacementCount: redrawRequest.replacementCount }} onRecoveryBack={() => navigate('/draw/setup')} onReviewPendingResults={reviewPendingResults} onQuickRedraw={redrawRequest === null ? quickRedrawWinner : undefined} redrawLineage={redrawLineage} result={presentationResult} activeResult={activeRedrawPresentationResult ?? undefined} mode={readiness.data.mode} eventId={readiness.data.event.id} displayConfigurationId={displayConfigurationId} eventName={readiness.data.event.name} prizeCategory={readiness.data.category.name} prizeName={readiness.data.category.prizeName} recap={{ winnerCount: redrawRequest?.replacementCount ?? readiness.data.configuration.requestedWinners, eligibleCount: runtimeEligibleCount ?? readiness.data.authoritativeEligibleCount, winningRule: readiness.data.configuration.winningRule, countdownSeconds: workspace.status === 'ready' ? workspace.eventSettings.presentation.countdownDurationSeconds : 3, rollingSeconds: activePresentationConfiguration.rollDurationSeconds, presentationConfiguration: activePresentationConfiguration }} checkpoints={activePresentationCheckpoints} practiceResult={practiceProjection ?? undefined} initialPresentation={restoredPresentation} presentationConfiguration={activePresentationConfiguration} presentationPolicy={presentationPolicy} audienceStatus={{ label: audienceConnection.label, detail: audienceConnection.detail, displayUrl: audienceDisplayUrl }} sharedPublisher={audience.publisher} onHandoff={() => navigate(readiness.data?.mode === 'live' ? `/draw/pending/${sessionId}` : '/draw/live')} onFailure={handlePresentationFailure} onResetPractice={readiness.data.mode === 'practice' ? () => setResetConfirmationOpen(true) : undefined} resetPending={resetting} reviewPendingResultsAvailable={pendingReviewAvailable} /><ConfirmationDialog open={resetConfirmationOpen} onCancel={() => setResetConfirmationOpen(false)} onConfirm={() => { void resetPractice() }} title="Reset simulasi ini?" confirmLabel="Reset simulasi" consequence="Pemenang Latihan dan progres presentasi akan dihapus. Hasil resmi tidak akan terpengaruh." tone="warning" /></section>
  }
  if (readiness?.data === undefined) return <section aria-labelledby="draw-run-title"><PageHeader eyebrow="Gerbang mulai produksi" headingId="draw-run-title" title="Gerbang Mulai Undian" description="Sesi tersimpan belum siap untuk alur berikutnya." /><StatusBanner badge="Diblokir" title={error?.message ?? 'Tidak dapat membuka Sesi Undian ini'} tone="warning">{readiness?.reason ?? 'Periksa pengaturan tersimpan dan kembali ke Pengaturan Undian.'}</StatusBanner><div className={uiClass("draw-action-bar__actions")}><Button icon={<Icon name="RefreshCw" />} onClick={() => { attemptedStartKeyRef.current = null; void load() }} disabled={!readiness?.retryable && error === null}>Ulangi validasi</Button><Button icon={<Icon name="ArrowLeft" />} variant="secondary" onClick={() => navigate('/draw/setup')}>Kembali ke Pengaturan Undian</Button></div></section>

  const data = readiness.data
  const live = data.mode === 'live'
  const redrawMode = redrawRequest !== null
  const presentedWinnerCount = redrawRequest?.replacementCount ?? data.configuration.requestedWinners
  const storedPresentationConfiguration = resolveDrawPresentationConfiguration(data.session.configurationSnapshot?.presentation ?? data.configuration.presentation)
  const presentationConfiguration: DrawPresentationConfiguration = redrawMode
    ? { ...storedPresentationConfiguration, presentationMode: 'random-number-roll', rollStopMode: 'manual' }
    : storedPresentationConfiguration
  if (!redrawMode && preflight !== null && preflight.state === 'blocked') return <section aria-labelledby="draw-run-title" className={uiClass("draw-setup draw-run-production")}><div className={uiClass("production-draw-run-shell")}><ProductionDrawRunHeader backTo="/draw/live" mode={data.mode} stage="Pemeriksaan awal diperlukan" eventName={data.event.name} prizeCategory={data.category.name} prizeName={data.category.prizeName} recap={{ winnerCount: data.configuration.requestedWinners, eligibleCount: data.authoritativeEligibleCount, winningRule: data.configuration.winningRule, countdownSeconds: workspace.status === 'ready' ? workspace.eventSettings.presentation.countdownDurationSeconds : 3, rollingSeconds: presentationConfiguration.rollDurationSeconds, presentationConfiguration }} audienceStatus={{ label: audienceConnection.label, detail: audienceConnection.detail, displayUrl: audienceDisplayUrl }} /><Card padding="md"><div className={uiClass("draw-run-preflight-heading")}><div><p className={uiClass("operator-eyebrow")}>Kesiapan produksi</p><h2>Selesaikan sebelum memulai</h2></div><span className={uiClass("draw-run-preflight-state")}>BELUM SIAP</span></div><div className={uiClass("draw-run-preflight-list")}>{preflight.checks.map((check) => <div className={uiClass(`draw-run-preflight-item draw-run-preflight-item--${check.state}`)} key={check.key}><div><strong>{check.label}</strong><span>{check.detail}</span></div><strong>{check.value}</strong>{check.recoveryPath === undefined ? null : <Link to={check.recoveryPath}>Buka Pengaturan Tampilan</Link>}</div>)}</div><div className={uiClass("draw-action-bar__actions")}><Button icon={<Icon name="RefreshCw" />} onClick={() => { attemptedStartKeyRef.current = null; void load() }}>Periksa ulang kesiapan</Button><Button icon={<Icon name="ArrowLeft" />} variant="secondary" onClick={() => navigate('/draw/setup')}>Kembali ke Pengaturan Undian</Button></div></Card></div></section>
  return <section aria-labelledby="draw-run-title" className={uiClass("draw-setup draw-run-production")}>
    <div className={uiClass("production-draw-run-shell")}><ProductionDrawRunHeader backTo={redrawMode ? undefined : "/draw/live"} mode={data.mode} stage={redrawMode ? 'Undi Ulang siap dijalankan' : 'Siap memulai'} eventName={data.event.name} prizeCategory={data.category.name} prizeName={data.category.prizeName} recap={{ winnerCount: presentedWinnerCount, eligibleCount: runtimeEligibleCount ?? data.authoritativeEligibleCount, winningRule: data.configuration.winningRule, countdownSeconds: workspace.status === 'ready' ? workspace.eventSettings.presentation.countdownDurationSeconds : 3, rollingSeconds: presentationConfiguration.rollDurationSeconds, presentationConfiguration }} audienceStatus={{ label: audienceConnection.label, detail: audienceConnection.detail, displayUrl: audienceDisplayUrl }} /><div className={uiClass("production-presentation-grid production-draw-run-ready-grid")}><div className={uiClass("production-presentation__content production-draw-run-ready-stage")}><Card padding="lg"><div className={uiClass("start-control")}>{live ? null : <div className={uiClass("start-control__notice")}><Icon name="CircleAlert" /><strong>MODE LATIHAN</strong><span>Hasil tidak akan memengaruhi riwayat resmi.</span></div>}{redrawMode ? <div className={uiClass("start-control__notice")}><Icon name="RotateCcw" /><strong>UNDI ULANG</strong><span>Mengganti {presentedWinnerCount} pemenang · {data.category.prizeName} · {data.category.name}</span></div> : null}<h2>{holding ? 'Tetap tahan…' : redrawMode ? 'Mulai Undi Ulang' : 'Mulai undian'}</h2><p>{holding ? 'Lepaskan untuk membatalkan. Tahan selama 1,5 detik.' : redrawMode ? 'Pemilihan aman dilakukan saat mulai. Stop hanya mengontrol waktu pengungkapan.' : live ? 'Tahan kontrol atau gunakan konfirmasi aksesibel.' : 'Tahan selama 1,5 detik untuk memulai simulasi.'}</p><Button icon={<Icon name="Play" />} ref={triggerRef} className={uiClass("start-control__button")} disabled={state !== 'ready'} onPointerDown={beginHold} onPointerUp={cancelHold} onPointerCancel={cancelHold} onLostPointerCapture={cancelHold} onPointerLeave={cancelHold} onKeyDown={handleSpace} onKeyUp={handleSpace} aria-label={redrawMode ? 'Tahan untuk memulai Undi Ulang resmi' : live ? 'Tahan untuk memulai Undian resmi' : 'Tahan untuk memulai Undian Latihan'}>{holding ? 'Menahan untuk memulai' : redrawMode ? 'Tahan untuk mulai Undi Ulang' : 'Tahan untuk memulai'}</Button><Button icon={<Icon name="CircleCheck" />} variant="secondary" onClick={() => setConfirmOpen(true)} disabled={state !== 'ready'}>{redrawMode ? 'Gunakan konfirmasi mulai Undi Ulang' : 'Gunakan konfirmasi mulai aksesibel'}</Button>{redrawMode ? null : <ButtonLink icon={<Icon name="ArrowLeft" />} to="/draw/setup" variant="quiet">Kembali ke Pengaturan Undian</ButtonLink>}</div></Card>{live ? <StatusBanner badge="Tindakan Live tidak dapat dibatalkan" icon={<Icon name="ShieldAlert" />} title={redrawMode ? `${presentedWinnerCount} pemenang dibatalkan dan menunggu pengganti` : 'Ini memulai satu undian resmi'} tone="warning">{redrawMode ? 'Pengganti belum dibuat. Mulai rolling lalu tekan Stop manual untuk mengungkap dan menyimpan hasil pengganti.' : 'Sesi otoritatif dan kelayakan akan diperiksa kembali tepat sebelum dimulai.'}</StatusBanner> : null}<Card padding="md"><details className={uiClass("locked-draw-details")}><summary><span><strong>{redrawMode ? 'Detail Undi Ulang' : 'Detail undian terkunci'}</strong><small>{data.category.name} · {data.category.prizeName} · {presentedWinnerCount} {redrawMode ? 'pengganti' : 'pemenang'} · {live ? 'Live' : 'Latihan'}</small></span><span aria-hidden="true">Lihat detail <Icon name="ChevronDown" /></span></summary><dl className={uiClass("summary-list")}><div className={uiClass("summary-list__item")}><dt>Acara</dt><dd>{data.event.name}</dd></div><div className={uiClass("summary-list__item")}><dt>Kategori hadiah</dt><dd>{data.category.name}</dd></div><div className={uiClass("summary-list__item")}><dt>Hadiah</dt><dd>{data.category.prizeName}</dd></div><div className={uiClass("summary-list__item")}><dt>{redrawMode ? 'Jumlah pengganti' : 'Jumlah pemenang'}</dt><dd>{presentedWinnerCount}</dd></div><div className={uiClass("summary-list__item")}><dt>Peserta memenuhi syarat</dt><dd>{runtimeEligibleCount ?? data.authoritativeEligibleCount}</dd></div><div className={uiClass("summary-list__item")}><dt>Aturan kemenangan</dt><dd>{data.configuration.winningRule}</dd></div><div className={uiClass("summary-list__item")}><dt>Check-in</dt><dd>{data.configuration.requireCheckIn ? 'Wajib' : 'Tidak wajib'}</dd></div><div className={uiClass("summary-list__item")}><dt>Grup yang memenuhi syarat</dt><dd>{data.configuration.eligibleGroupFilter ?? 'Semua grup'}</dd></div><div className={uiClass("summary-list__item")}><dt>Mode tersimpan</dt><dd>{live ? 'Live — resmi' : 'Latihan — tidak resmi'}</dd></div></dl></details></Card></div><PresentationSupport recap={{ winnerCount: presentedWinnerCount, eligibleCount: runtimeEligibleCount ?? data.authoritativeEligibleCount, winningRule: data.configuration.winningRule, countdownSeconds: workspace.status === 'ready' ? workspace.eventSettings.presentation.countdownDurationSeconds : 3, rollingSeconds: presentationConfiguration.rollDurationSeconds, presentationConfiguration }} previewStage="ready" audienceStatus={{ label: audienceConnection.label, detail: audienceConnection.detail, displayUrl: audienceDisplayUrl }} eventName={data.event.name} prizeCategory={data.category.name} prizeName={data.category.prizeName} blackoutRequested={false} publicSnapshot={authoritativeAudienceSnapshot} /></div>
    <ConfirmationDialog headerIcon={<Icon name="ShieldAlert" />} headerIconTone="warning" cancelIcon={<Icon name="CircleX" />} confirmIcon={<Icon name="CircleCheck" />} open={confirmOpen} onCancel={closeConfirm} onConfirm={confirmStart} title={redrawMode ? 'Konfirmasi mulai Undi Ulang' : live ? 'Konfirmasi mulai Live resmi' : 'Konfirmasi mulai Latihan'} confirmLabel={redrawMode ? 'Mulai Undi Ulang' : live ? 'Konfirmasi dan mulai Live' : 'Konfirmasi dan mulai Latihan'} consequence={redrawMode ? `Sistem akan memilih ${presentedWinnerCount} pengganti secara aman dan menguncinya untuk presentasi. Tombol Stop hanya mengatur waktu pengungkapan.` : live ? 'Ini menjalankan perintah aman Fase 5 dan membuat hasil resmi tersimpan. Tindakan ini tidak dapat dibatalkan dari layar ini.' : 'Ini menjalankan pemilihan aman hanya untuk simulasi. Tindakan ini tidak membuat WinnerRecord atau mengubah riwayat resmi.'} />
    {toast === null ? null : <Toast title={toast.title} description={toast.description} onDismiss={() => setToast(null)} urgent={toast.variant === 'danger'} variant={toast.variant} />}
    <ConfirmationDialog headerIcon={<Icon name="RefreshCw" />} headerIconTone="warning" open={resetConfirmationOpen} onCancel={() => setResetConfirmationOpen(false)} onConfirm={() => { void resetPractice() }} title="Reset simulasi ini?" confirmLabel="Reset simulasi" consequence="Pemenang Latihan dan progres presentasi akan dihapus. Hasil resmi tidak akan terpengaruh." tone="warning" />
     </div>
  </section>
}

export function DrawRunRoute() {
  const { drawSessionId } = useParams<{ drawSessionId: string }>()
  return <DrawRunPage key={drawSessionId} />
}
