import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import { DEFAULT_EVENT_SETTINGS, type EventSettings } from '../../domain/settings/event-settings.types.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'
import { createOperatorPublisher, createPublisherRuntimeIdentity, type OperatorPublisher, type PublisherResult, type PublisherStatus } from '../../application/display-transport/operator-publisher.ts'
import { createBroadcastChannelTransport } from '../../application/display-transport/transport.ts'
import type { PresentationProjectionSource, PublicDisplaySnapshot } from '../../application/display-transport/public-projection.ts'
import { parseDrawSessionId } from '../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import { setDisplayConnectionStatus, syncAudiencePresenceConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { deriveProductionSetupReadiness, getInitialProductionSetupAdmission, type ProductionSetupReadiness } from './production-setup-readiness.ts'

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
      readonly currentMode: AppMode | null
      readonly displayConfiguration: DisplayConfiguration | null
      readonly eventSettings: EventSettings
      readonly setupReadiness: ProductionSetupReadiness
      readonly setupAdmittedThrough: number
      readonly admitSetupStage: (index: number) => void
    }

const WorkspaceContext = createContext<ProductionWorkspaceState | undefined>(undefined)
type AudiencePublisherContextValue = {
  readonly publisher: OperatorPublisher | null
  readonly status: PublisherStatus
  readonly publish: (source: PresentationProjectionSource) => PublisherResult
  readonly subscribe: (listener: (status: PublisherStatus) => void) => () => void
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
  const setupAdmissionRef = useRef<{ readonly eventId: string; readonly admittedThrough: number } | null>(null)
  const publisherRef = useRef<OperatorPublisher | null>(null)
  const publisherScopeRef = useRef<string | undefined>(undefined)
  const publisherStatusCleanupRef = useRef<(() => void) | null>(null)
  const [publisher, setPublisher] = useState<OperatorPublisher | null>(null)
  const [publisherStatus, setPublisherStatus] = useState<PublisherStatus>({ kind: 'waiting-for-display' })

  const refresh = useCallback(() => {
    let active = true
    void (async () => {
      setState({ status: 'loading' })
      try {
        await services.open()
        const activeEventId = await services.preferences.get('activeEventId')
        if (activeEventId === null) {
          setupAdmissionRef.current = null
          if (active) setState({ status: 'empty', reason: 'no-active-event' })
          return
        }
        const event = await services.events.findById(activeEventId)
        if (event === null) {
          setupAdmissionRef.current = null
          if (active) setState({ status: 'invalid-reference', eventId: activeEventId })
          return
        }
        const [participantCount, participants, categories, sessions, configurations, currentMode, displayConfiguration, eventSettings] = await Promise.all([
          services.participants.countByEventId(event.id),
          services.participants.findByEventId(event.id, { limit: 100_000, offset: 0 }),
          services.categories.findByEventId(event.id),
          services.sessions.findByEventId(event.id),
          services.configurations.findByEventId(event.id),
          services.preferences.get('lastOperatorMode'),
          services.displayConfigurations?.findByEventId(event.id) ?? Promise.resolve(null),
          services.eventSettings.findByEventId(event.id),
        ])
        const unresolvedSession = sessions
          .filter((session) => session.mode === 'live' && (session.status === 'drawing' || session.status === 'pending-confirmation'))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
        if (active) {
          const setupReadiness = deriveProductionSetupReadiness({ hasCurrentEvent: true, categories, participants, displayConfiguration, configurations, sessions })
          const admission = setupAdmissionRef.current?.eventId === event.id
            ? setupAdmissionRef.current
            : { eventId: event.id, admittedThrough: getInitialProductionSetupAdmission(setupReadiness) }
          setupAdmissionRef.current = admission
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
            currentMode,
            displayConfiguration,
            eventSettings: eventSettings ?? { eventId: event.id, ...DEFAULT_EVENT_SETTINGS, displayName: event.name, updatedAt: new Date().toISOString() },
            setupReadiness,
            setupAdmittedThrough: admission.admittedThrough,
            admitSetupStage: (index) => {
              if (index < 0 || index >= 5 || setupAdmissionRef.current?.eventId !== event.id) return
              const admittedThrough = Math.max(setupAdmissionRef.current?.admittedThrough ?? 0, index)
              setupAdmissionRef.current = { eventId: event.id, admittedThrough }
              setState((current) => current.status === 'ready' && current.event.id === event.id ? { ...current, setupAdmittedThrough: admittedThrough } : current)
            },
          })
        }
      } catch (cause: unknown) {
        if (active) setState({ status: 'error', message: cause instanceof Error ? cause.message : 'Authoritative workspace data could not be read safely.' })
      }
    })()
    return () => { active = false }
  }, [services])

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
      transport: createBroadcastChannelTransport('raffle-os-display', scope),
      transportFactory: () => createBroadcastChannelTransport('raffle-os-display', scope),
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
    publisher.start({
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
    })
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
    subscribe: (listener) => publisherRef.current?.subscribe(listener) ?? (() => undefined),
    getSnapshot: () => publisherRef.current?.getSnapshot(),
    getDiagnostics: () => publisherRef.current?.getDiagnostics(),
  }), [publisher, publisherStatus])

  return <WorkspaceContext.Provider value={state}><AudiencePublisherContext.Provider value={audiencePublisher}>{children}</AudiencePublisherContext.Provider></WorkspaceContext.Provider>
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
