import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import { resolveDisplayAppearance, type DisplayAppearanceConfiguration } from '../../domain/display/display-configuration.types.ts'
import { DEFAULT_EVENT_SETTINGS, type EventSettings } from '../../domain/settings/event-settings.types.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { createOperatorPublisher, createPublisherRuntimeIdentity, type OperatorPublisher, type PublisherResult, type PublisherStatus } from '../../application/display-transport/operator-publisher.ts'
import { createProductionDisplayTransport } from '../../infrastructure/display/production-display-transport.ts'
import type { PresentationProjectionSource, PublicDisplaySnapshot } from '../../application/display-transport/public-projection.ts'
import { parseDrawSessionId } from '../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import { setDisplayConnectionStatus, syncAudiencePresenceConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { deriveProductionSetupReadiness, type ProductionSetupReadiness } from './production-setup-readiness.ts'
import { evaluateStartupRecovery, type StartupRecoveryResult } from '../../application/workflow/startup-recovery-arbiter.ts'
import { projectAudienceRecoverySource } from '../../application/display-transport/audience-recovery.ts'
import type { DrawReadinessResult } from '../../application/draw/draw-readiness.types.ts'
import type { RedrawRequest } from '../../domain/winners/redraw-request.types.ts'
import { evaluateUpdateSafety, registerUpdateSafetyAuthority } from '../../application/update/update-safety.ts'

export interface IntentionalRedrawHandoff {
  readonly drawSessionId: RedrawRequest['drawSessionId']
  readonly request: RedrawRequest
  readonly readiness: DrawReadinessResult
  readonly displayConfigurationId?: string
}

type RedrawTransitionContextValue = {
  readonly handoff: IntentionalRedrawHandoff | null
  readonly prepare: (handoff: IntentionalRedrawHandoff) => void
  readonly clear: () => void
}

export type ProductionWorkspaceState =
  | { readonly status: 'loading' }
  | { readonly status: 'empty'; readonly reason: 'no-active-event' }
  | { readonly status: 'invalid-reference'; readonly eventId: string }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready'
      readonly event: Event
      readonly participantCount: number
      readonly checkedInParticipantCount: number
      readonly prizeCategoryCount: number
      readonly liveSessionCount: number
      readonly sessionCounts: Readonly<Record<DrawSession['status'], number>>
      readonly unresolvedSession: DrawSession | null
      readonly startupRecovery: StartupRecoveryResult
      readonly audienceRecoverySource: PresentationProjectionSource | null
      readonly currentMode: AppMode | null
      readonly displayConfiguration: DisplayConfiguration | null
      readonly eventSettings: EventSettings
      readonly setupReadiness: ProductionSetupReadiness
      readonly setupJourneyReachedStep: number
      readonly advanceSetupJourney: (reachedStep: number) => void
    }

const WorkspaceContext = createContext<ProductionWorkspaceState | undefined>(undefined)
const RedrawTransitionContext = createContext<RedrawTransitionContextValue | undefined>(undefined)
type AudiencePublisherContextValue = {
  readonly publisher: OperatorPublisher | null
  readonly status: PublisherStatus
  readonly publish: (source: PresentationProjectionSource) => PublisherResult
  readonly publishAppearance: (appearance: DisplayAppearanceConfiguration) => PublisherResult
  readonly subscribe: (listener: (status: PublisherStatus) => void) => () => void
  readonly subscribeSnapshot: (listener: () => void) => () => void
  readonly getSnapshot: () => PublicDisplaySnapshot | undefined
  readonly getDiagnostics: () => ReturnType<OperatorPublisher['getDiagnostics']> | undefined
}
const AudiencePublisherContext = createContext<AudiencePublisherContextValue | undefined>(undefined)
const WORKSPACE_CHANGED = 'raffle-os:workspace-changed'

// eslint-disable-next-line react-refresh/only-export-components
export function signalProductionWorkspaceChanged(): void {
  window.dispatchEvent(new Event(WORKSPACE_CHANGED))
}

export function ProductionWorkspaceProvider({ children }: { readonly children: ReactNode }) {
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const [state, setState] = useState<ProductionWorkspaceState>({ status: 'loading' })
  const setupJourneyRef = useRef<{ readonly eventId: string; readonly reachedStep: number } | null>(null)
  const publisherRef = useRef<OperatorPublisher | null>(null)
  const publisherScopeRef = useRef<string | undefined>(undefined)
  const publisherStatusCleanupRef = useRef<(() => void) | null>(null)
  const [publisher, setPublisher] = useState<OperatorPublisher | null>(null)
  const [publisherStatus, setPublisherStatus] = useState<PublisherStatus>({ kind: 'waiting-for-display' })
  const [redrawHandoff, setRedrawHandoff] = useState<IntentionalRedrawHandoff | null>(null)

  const refresh = useCallback(() => {
    let active = true
    void (async () => {
      setState({ status: 'loading' })
      try {
        const storageReadiness = services.checkStorage === undefined ? null : await services.checkStorage()
        if (storageReadiness !== null && !storageReadiness.ok) {
          if (active) setState({ status: 'error', message: storageReadiness.reason })
          return
        }
        if (services.checkStorage === undefined) await services.open()
        const activeEventId = await services.preferences.get('activeEventId')
        if (activeEventId === null) {
          setupJourneyRef.current = null
          if (active) setState({ status: 'empty', reason: 'no-active-event' })
          return
        }
        const event = await services.events.findById(activeEventId)
        if (event === null) {
          setupJourneyRef.current = null
          if (active) setState({ status: 'invalid-reference', eventId: activeEventId })
          return
        }
        const [participantCount, participants, categories, sessions, configurations, currentMode, setupJourneyReachedStepByEvent, displayConfiguration, eventSettings, winners] = await Promise.all([
          services.participants.countByEventId(event.id),
          services.participants.findByEventId(event.id, { limit: 100_000, offset: 0 }),
          services.categories.findByEventId(event.id),
          services.sessions.findByEventId(event.id),
          services.configurations.findByEventId(event.id),
          services.preferences.get('lastOperatorMode'),
          services.preferences.get('setupJourneyReachedStepByEvent'),
          services.displayConfigurations?.findByEventId(event.id) ?? Promise.resolve(null),
          services.eventSettings.findByEventId(event.id),
          services.winners.findByEventId(event.id),
        ])
        const unresolvedSession = sessions
          .filter((session) => session.mode === 'live' && (session.status === 'drawing' || session.status === 'pending-confirmation'))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
        const unresolvedSessions = sessions.filter((session) => session.mode === 'live' && (session.status === 'drawing' || session.status === 'pending-confirmation'))
        const recoveryRecords = await Promise.all(unresolvedSessions.map(async (session) => {
          const [redraws, receipts, checkpoint, activeRedrawRequest] = await Promise.all([
            services.redraws?.findByDrawSessionId(session.id) ?? Promise.resolve([]),
            services.pendingDecisions?.receipts.findBySession(session.id) ?? Promise.resolve([]),
            services.presentationCheckpoints?.findByDrawSessionId(session.id) ?? Promise.resolve(null),
            services.redrawRequests?.findActiveByDrawSessionId(session.id) ?? Promise.resolve(null),
          ])
          return { redraws, receipts, checkpoint, activeRedrawRequest }
        }))
        const startupRecovery = evaluateStartupRecovery({
          activeEvent: event,
          sessions,
          winners,
          redraws: recoveryRecords.flatMap((record) => record.redraws),
          receipts: recoveryRecords.flatMap((record) => record.receipts),
          redrawRequests: recoveryRecords.flatMap((record) => record.activeRedrawRequest === null ? [] : [record.activeRedrawRequest]),
          checkpoint: recoveryRecords.find((record) => record.checkpoint !== null)?.checkpoint ?? null,
        })
        if (startupRecovery.kind === 'storage-failure') {
          if (active) setState({ status: 'error', message: startupRecovery.error })
          return
        }
        if (active) {
          const audienceRecoverySource = displayConfiguration === null
            ? null
            : projectAudienceRecoverySource({
                recovery: startupRecovery,
                eventSettings: eventSettings ?? { eventId: event.id, ...DEFAULT_EVENT_SETTINGS, displayName: event.name, updatedAt: new Date().toISOString() },
                displayConfiguration,
              })
          const setupReadiness = deriveProductionSetupReadiness({ hasCurrentEvent: true, categories, participants, displayConfiguration, configurations, sessions })
          const persistedReachedStep = setupJourneyReachedStepByEvent?.[event.id]
          const initialReachedStep = persistedReachedStep ?? (setupReadiness.drawSetup ? 5 : 1)
          const journey = setupJourneyRef.current?.eventId === event.id
            ? setupJourneyRef.current
            : { eventId: event.id, reachedStep: Math.max(1, Math.min(5, initialReachedStep)) }
          setupJourneyRef.current = journey
          const sessionCounts = sessions.reduce((counts, session) => ({ ...counts, [session.status]: counts[session.status] + 1 }), { draft: 0, ready: 0, drawing: 0, 'pending-confirmation': 0, completed: 0, cancelled: 0 } as Record<DrawSession['status'], number>)
          setState({
            status: 'ready',
            event,
            participantCount,
            checkedInParticipantCount: participants.filter((participant) => participant.isCheckedIn).length,
            prizeCategoryCount: categories.length,
            liveSessionCount: sessions.filter((session) => session.mode === 'live').length,
            sessionCounts,
            unresolvedSession,
            startupRecovery,
            audienceRecoverySource,
            currentMode,
            displayConfiguration,
            eventSettings: eventSettings ?? { eventId: event.id, ...DEFAULT_EVENT_SETTINGS, displayName: event.name, updatedAt: new Date().toISOString() },
            setupReadiness,
            setupJourneyReachedStep: journey.reachedStep,
            advanceSetupJourney: (reachedStep) => {
              if (reachedStep < 1 || reachedStep > 5 || setupJourneyRef.current?.eventId !== event.id) return
              const nextReachedStep = Math.max(setupJourneyRef.current?.reachedStep ?? 1, reachedStep)
              setupJourneyRef.current = { eventId: event.id, reachedStep: nextReachedStep }
              void services.preferences.set('setupJourneyReachedStepByEvent', { ...(setupJourneyReachedStepByEvent ?? {}), [event.id]: nextReachedStep }, new Date().toISOString() as IsoTimestamp)
              setState((current) => current.status === 'ready' && current.event.id === event.id ? { ...current, setupJourneyReachedStep: nextReachedStep } : current)
            },
          })
        }
      } catch (cause: unknown) {
        if (active) setState({ status: 'error', message: cause instanceof Error ? cause.message : 'Authoritative workspace data could not be read safely.' })
      }
    })()
    return () => { active = false }
  }, [services])

  const readUpdateSafety = useCallback(async () => {
    const storage = services.checkStorage === undefined ? null : await services.checkStorage()
    if (storage !== null && !storage.ok) return evaluateUpdateSafety({ workspaceReadable: false, liveSessionStatuses: [], recovery: 'unresolved', receiptAmbiguous: true, activeRedrawRecovery: true, presentationStages: [], audience: 'ambiguous' })
    if (services.checkStorage === undefined) await services.open()
    const activeEventId = await services.preferences.get('activeEventId')
    if (activeEventId === null) return evaluateUpdateSafety({ workspaceReadable: true, liveSessionStatuses: [], recovery: 'normal', receiptAmbiguous: false, activeRedrawRecovery: false, presentationStages: [], audience: 'disconnected' })
    const event = await services.events.findById(activeEventId)
    if (event === null) return evaluateUpdateSafety({ workspaceReadable: false, liveSessionStatuses: [], recovery: 'unresolved', receiptAmbiguous: true, activeRedrawRecovery: true, presentationStages: [], audience: 'ambiguous' })
    const [sessions, winners, displayConfiguration] = await Promise.all([
      services.sessions.findByEventId(event.id),
      services.winners.findByEventId(event.id),
      services.displayConfigurations?.findByEventId(event.id) ?? Promise.resolve(null),
    ])
    const liveSessions = sessions.filter((session) => session.mode === 'live')
    const records = await Promise.all(liveSessions.map(async (session) => {
      const [redraws, receipts, checkpoint, activeRedrawRequest] = await Promise.all([
        services.redraws?.findByDrawSessionId(session.id) ?? Promise.resolve([]),
        services.pendingDecisions?.receipts.findBySession(session.id) ?? Promise.resolve([]),
        services.presentationCheckpoints?.findByDrawSessionId(session.id) ?? Promise.resolve(null),
        services.redrawRequests?.findActiveByDrawSessionId(session.id) ?? Promise.resolve(null),
      ])
      return { session, redraws, receipts, checkpoint, activeRedrawRequest }
    }))
    const recovery = evaluateStartupRecovery({
      activeEvent: event,
      sessions,
      winners,
      redraws: records.flatMap((record) => record.redraws),
      receipts: records.flatMap((record) => record.receipts),
      redrawRequests: records.flatMap((record) => record.activeRedrawRequest === null ? [] : [record.activeRedrawRequest]),
      checkpoint: records.find((record) => record.checkpoint !== null)?.checkpoint ?? null,
    })
    const audience = displayConfiguration === null
      ? 'disconnected' as const
      : publisherRef.current === null || publisherScopeRef.current !== `${event.id}:${displayConfiguration.id}`
        ? 'ambiguous' as const
        : publisherRef.current.getDiagnostics().activeAudienceSubscriberCount > 0 ? 'connected' as const : 'disconnected' as const
    return evaluateUpdateSafety({
      workspaceReadable: true,
      liveSessionStatuses: liveSessions.map((session) => session.status),
      recovery: recovery.kind === 'conflicting-sessions' ? 'conflicting-sessions' : recovery.kind === 'recover-session' ? 'unresolved' : 'normal',
      receiptAmbiguous: records.some((record) => record.receipts.some((receipt) => receipt.status === 'started' || receipt.status === 'unknown')),
      activeRedrawRecovery: records.some((record) => record.activeRedrawRequest !== null),
      presentationStages: records.flatMap((record) => record.checkpoint === null ? [] : [record.checkpoint.stage]),
      audience,
    })
  }, [services])

  useEffect(() => registerUpdateSafetyAuthority(readUpdateSafety), [readUpdateSafety])

  useEffect(() => {
    void refresh()
    const listener = () => { void refresh() }
    window.addEventListener(WORKSPACE_CHANGED, listener)
    return () => window.removeEventListener(WORKSPACE_CHANGED, listener)
  }, [refresh])

  useEffect(() => {
    if (state.status !== 'ready' || state.displayConfiguration === null) return
    const scopeKey = `${state.event.id}:${state.displayConfiguration.id}`
    if (publisherScopeRef.current === scopeKey && publisherRef.current !== null) return
    if (publisherScopeRef.current !== undefined) setDisplayConnectionStatus(publisherScopeRef.current, 'waiting')
    publisherStatusCleanupRef.current?.()
    publisherRef.current?.close()
    publisherStatusCleanupRef.current = null
    const parsed = parseDrawSessionId(state.event.id)
    if (!parsed.ok) return
    const scope = { eventId: state.event.id, displayId: state.displayConfiguration.id }
    const runtime = createPublisherRuntimeIdentity()
    const publisher = createOperatorPublisher({
      transport: createProductionDisplayTransport('operator', scope),
      transportFactory: () => createProductionDisplayTransport('operator', scope),
      scope,
      senderId: runtime.publisherInstanceId,
      epoch: runtime.epoch,
      clock: { now: () => new Date().toISOString() as IsoTimestamp },
    })
    publisherRef.current = publisher
    publisherScopeRef.current = scopeKey
    setDisplayConnectionStatus(scopeKey, 'waiting')
    const unsubscribe = publisher.subscribe((status) => {
      setPublisherStatus(status)
      if (status.kind === 'audience-presence') syncAudiencePresenceConnectionStatus(scopeKey, status.status)
    })
    publisherStatusCleanupRef.current = unsubscribe
    const initial = state.eventSettings
    const standbySource: PresentationProjectionSource = {
      drawSessionId: parsed.value,
      stage: 'standby',
      blackoutRequested: false,
      displayTest: false,
      eventName: initial.displayName,
      eventSubtitle: initial.subtitle,
      primaryColor: initial.primaryColor,
      accentColor: initial.accentColor,
      logo: initial.logo === undefined ? undefined : { type: initial.logo.type, blob: initial.logo.blob },
      background: initial.background === undefined ? undefined : { type: initial.background.type, blob: initial.background.blob },
      blackoutAppearance: state.displayConfiguration?.blackoutAppearance,
      safeAreaMargin: state.displayConfiguration?.safeAreaMargin,
      appearance: resolveDisplayAppearance(state.displayConfiguration, initial),
    }
    publisher.start(state.audienceRecoverySource ?? standbySource)
    queueMicrotask(() => { if (publisherRef.current === publisher) setPublisher(publisher) })
  }, [state])

  useEffect(() => () => {
    if (publisherScopeRef.current !== undefined) setDisplayConnectionStatus(publisherScopeRef.current, 'waiting')
    publisherStatusCleanupRef.current?.()
    publisherRef.current?.close()
    publisherRef.current = null
    setPublisher(null)
    publisherScopeRef.current = undefined
  }, [])

  const audiencePublisher = useMemo<AudiencePublisherContextValue>(() => ({
    publisher,
    status: publisherStatus,
    publish: (source) => publisherRef.current === null ? { ok: false, error: { kind: 'transport-closed' } } : publisherRef.current.publish(source),
    publishAppearance: (appearance) => publisherRef.current === null ? { ok: false, error: { kind: 'transport-closed' } } : publisherRef.current.publishAppearance(appearance),
    subscribe: (listener) => publisherRef.current?.subscribe(listener) ?? (() => undefined),
    subscribeSnapshot: (listener) => publisherRef.current?.subscribeSnapshot(listener) ?? (() => undefined),
    getSnapshot: () => publisherRef.current?.getSnapshot(),
    getDiagnostics: () => publisherRef.current?.getDiagnostics(),
  }), [publisher, publisherStatus])

  const redrawTransition = useMemo<RedrawTransitionContextValue>(() => ({
    handoff: redrawHandoff,
    prepare: setRedrawHandoff,
    clear: () => setRedrawHandoff(null),
  }), [redrawHandoff])

  return <WorkspaceContext.Provider value={state}><AudiencePublisherContext.Provider value={audiencePublisher}><RedrawTransitionContext.Provider value={redrawTransition}>{children}</RedrawTransitionContext.Provider></AudiencePublisherContext.Provider></WorkspaceContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProductionWorkspace(): ProductionWorkspaceState {
  const state = useContext(WorkspaceContext)
  if (state === undefined) throw new Error('useProductionWorkspace must be used inside ProductionWorkspaceProvider.')
  return state
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProductionAudiencePublisher(): AudiencePublisherContextValue {
  const value = useContext(AudiencePublisherContext)
  if (value === undefined) throw new Error('useProductionAudiencePublisher must be used inside ProductionWorkspaceProvider.')
  return value
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIntentionalRedrawTransition(): RedrawTransitionContextValue {
  const value = useContext(RedrawTransitionContext)
  if (value === undefined) throw new Error('useIntentionalRedrawTransition must be used inside ProductionWorkspaceProvider.')
  return value
}
