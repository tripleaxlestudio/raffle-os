import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createAudienceController, type AudienceController, type AudienceRenderedState } from '../../application/display-transport/audience-controller.ts'
import { createFullscreenController, type FullscreenState } from '../../application/display-transport/fullscreen-controller.ts'
import { createAudienceTransport, type Transport } from '../../application/display-transport/transport.ts'
import type { ProtocolScope } from '../../application/display-transport/protocol.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import { parseEventId, parseDisplayConfigurationId } from '../../domain/shared/identifiers.ts'
import { deriveProductionDisplayScope } from '../../application/display/display-configuration-service.ts'
import { AudiencePresentation, AudienceUnavailablePresentation } from '../../ui/audience/AudiencePresentation.tsx'
import { RuntimeDiagnosticsPanel } from '../../application/display-transport/RuntimeDiagnostics.tsx'
import { appendRuntimeTrace } from '../../application/display-transport/runtime-trace.ts'

type AudienceDisplayPageProps = Readonly<{ transport?: Transport; scope?: ProtocolScope; expectedSession?: DrawSessionId; controller?: AudienceController }>

function AudienceDevelopmentDiagnostics({ controller, renderedState, enabled }: { readonly controller: ReturnType<typeof createAudienceController>; readonly renderedState: string; readonly enabled: boolean }) {
  const diagnostics = controller.getDiagnostics()
  if (!enabled) return null
  return <RuntimeDiagnosticsPanel side="Audience" title="Audience runtime diagnostics" renderedState={renderedState} summary={<dl>
    <div><dt>Resolved Event ID</dt><dd>{diagnostics.resolvedEventId}</dd></div>
    <div><dt>DisplayConfiguration ID</dt><dd>{diagnostics.displayConfigurationId}</dd></div>
    <div><dt>Channel name</dt><dd>{diagnostics.channelName}</dd></div>
    <div><dt>Scope</dt><dd>{diagnostics.scope.eventId} / {diagnostics.scope.displayId}</dd></div>
    <div><dt>Last message</dt><dd>{diagnostics.lastMessageType}</dd></div>
    <div><dt>Envelope epoch / sequence</dt><dd>{diagnostics.lastEnvelopeEpoch ?? '—'} / {diagnostics.lastEnvelopeSequence ?? '—'}</dd></div>
    <div><dt>Public state</dt><dd>{diagnostics.publicState ?? '—'}</dd></div>
    <div><dt>Validation</dt><dd>{diagnostics.validationResult}</dd></div>
    <div><dt>Rejection reason</dt><dd>{diagnostics.rejectionReason ?? '—'}</dd></div>
    <div><dt>Controller before / after</dt><dd>{diagnostics.stateBeforeReceipt ?? '—'} / {diagnostics.stateAfterReceipt ?? '—'}</dd></div>
    <div><dt>Rendered presentation</dt><dd>{renderedState}</dd></div>
    <div><dt>Transport status</dt><dd>{controller.getConnectionState()}</dd></div>
    <div><dt>Accepted public state</dt><dd>{diagnostics.publicState ?? '—'}</dd></div>
    <div><dt>Selected rendered state</dt><dd>{diagnostics.selectedRenderedState}</dd></div>
    <div><dt>Last snapshot-applied acknowledgement</dt><dd>{diagnostics.lastSnapshotApplied === undefined ? '—' : `${diagnostics.lastSnapshotApplied.publicState} @ ${diagnostics.lastSnapshotApplied.epoch}/${diagnostics.lastSnapshotApplied.sequence}`}</dd></div>
    <div><dt>Controller instance</dt><dd>{diagnostics.controllerInstanceId}</dd></div>
    <div><dt>Accepted publisher runtime</dt><dd>{diagnostics.acceptedPublisherInstanceId ?? '—'}</dd></div>
    <div><dt>Accepted epoch / presentation sequence</dt><dd>{diagnostics.acceptedEpoch ?? '—'} / {diagnostics.acceptedSequence ?? '—'}</dd></div>
    <div><dt>Last publisher activity</dt><dd>{diagnostics.lastPublisherActivity ?? '-'}</dd></div>
    <div><dt>Latest heartbeat</dt><dd>{diagnostics.latestHeartbeatReceived ?? '-'}</dd></div>
    <div><dt>Watchdog armed at</dt><dd>{diagnostics.watchdogArmedAt ?? '-'}</dd></div>
    <div><dt>Watchdog expiry</dt><dd>{diagnostics.watchdogExpiry ?? '-'}</dd></div>
    <div><dt>Most recent timeout</dt><dd>{diagnostics.mostRecentTimeoutCallback ?? '-'}</dd></div>
    <div><dt>Disconnected reason</dt><dd>{diagnostics.disconnectedReason ?? '-'}</dd></div>
    <div><dt>Acknowledgement pending</dt><dd>{diagnostics.acknowledgementPending === undefined ? 'no' : `${diagnostics.acknowledgementPending.publicState} @ ${diagnostics.acknowledgementPending.epoch}/${diagnostics.acknowledgementPending.sequence}`}</dd></div>
    <div><dt>Acknowledgement suppression</dt><dd>{diagnostics.acknowledgementSuppressionReason ?? '—'}</dd></div>
    <div><dt>Invariant failure</dt><dd>{diagnostics.invariantFailure ?? '—'}</dd></div>
    <div><dt>Heartbeat interval</dt><dd>{diagnostics.heartbeatIntervalMs} ms</dd></div>
    <div><dt>Active heartbeat timers</dt><dd>{diagnostics.activeHeartbeatTimerCount}</dd></div>
    <div><dt>Heartbeat sent / received</dt><dd>{diagnostics.heartbeatSentCount} / {diagnostics.heartbeatReceivedCount}</dd></div>
    <div><dt>Hello count</dt><dd>{diagnostics.helloCount}</dd></div>
    <div><dt>Restore-request count</dt><dd>{diagnostics.restoreRequestCount}</dd></div>
    <div><dt>Listener attached</dt><dd>{diagnostics.listenerAttached ? 'yes' : 'no'}</dd></div>
    <div><dt>Channel open</dt><dd>{diagnostics.channelOpen ? 'yes' : 'no'}</dd></div>
    <div><dt>Listener attached at</dt><dd>{diagnostics.listenerAttachedAt ?? '—'}</dd></div>
    <div><dt>Hello sent at</dt><dd>{diagnostics.helloSentAt ?? '—'}</dd></div>
    <div><dt>Restore requests sent</dt><dd>{diagnostics.restoreRequestTimestamps.length}</dd></div>
    <div><dt>First snapshot applied</dt><dd>{diagnostics.firstSnapshotApplied === undefined ? '—' : `${diagnostics.firstSnapshotApplied.publicState} @ ${diagnostics.firstSnapshotApplied.epoch}/${diagnostics.firstSnapshotApplied.sequence}`}</dd></div>
    <div><dt>Acknowledgement sent at</dt><dd>{diagnostics.acknowledgementSentAt ?? '—'}</dd></div>
    <div><dt>Transport cleanup</dt><dd>{diagnostics.transportCleanupReason ?? '—'}</dd></div>
  </dl>} />
}

function FullscreenControls({ controller, state }: { readonly controller: ReturnType<typeof createFullscreenController>; readonly state: FullscreenState }) {
  if (!controller.isSupported()) return null
  const active = state === 'fullscreen' || state === 'entering' || state === 'exiting'
  return <div className="audience-fullscreen-controls" aria-label="Public display controls">
    <button type="button" onClick={() => { void (state === 'fullscreen' ? controller.exit() : controller.enter()) }} disabled={state === 'entering' || state === 'exiting'}>
      {state === 'fullscreen' ? 'Exit fullscreen' : 'Enter fullscreen'}
    </button>
    <span role="status">{state === 'denied' ? 'Fullscreen was not allowed; windowed display remains available.' : state === 'failed' ? 'Fullscreen is unavailable; windowed display remains available.' : active ? (state === 'fullscreen' ? 'Fullscreen active' : 'Updating display mode') : 'Windowed display'}</span>
  </div>
}

export function AudienceDisplayPage({ transport: suppliedTransport, scope: suppliedScope, expectedSession, controller: suppliedController }: AudienceDisplayPageProps) {
  // Keep the production URL context stable for the lifetime of this route. The
  // previous implementation recreated these parse results on every render;
  // that recreated the channel and Audience controller immediately
  // after the first snapshot notification, losing the applied snapshot.
  const search = typeof window === 'undefined' ? '' : window.location.search
  const query = useMemo(() => new URLSearchParams(search), [search])
  const audienceDiagnosticsDebugEnabled = import.meta.env.DEV && query.get('debug') === 'audience-transport'
  const eventIdParam = query.get('eventId')
  const displayIdParam = query.get('displayConfigurationId')
  const eventId = useMemo(() => parseEventId(eventIdParam), [eventIdParam])
  const displayId = useMemo(() => parseDisplayConfigurationId(displayIdParam), [displayIdParam])
  const scope = useMemo(() => suppliedScope ?? (eventId.ok && displayId.ok ? deriveProductionDisplayScope(eventId.value, displayId.value) : undefined), [displayId, eventId, suppliedScope])
  const hookScope = useMemo(() => scope ?? { eventId: 'invalid-event-context', displayId: 'invalid-display-context' }, [scope])
  const transport = useMemo(() => suppliedTransport ?? createAudienceTransport('raffle-os-display', hookScope), [hookScope, suppliedTransport])
  const transportFactory = useMemo(() => suppliedTransport === undefined ? () => createAudienceTransport('raffle-os-display', hookScope) : undefined, [hookScope, suppliedTransport])
  const controller = useMemo(() => suppliedController ?? createAudienceController({ transport, transportFactory, scope: hookScope, expectedSession, autoStartHandshake: suppliedController === undefined ? false : undefined }), [expectedSession, hookScope, suppliedController, transport, transportFactory])
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  const fullscreen = useMemo(() => createFullscreenController({ target: typeof document === 'undefined' ? undefined : document.documentElement }), [])
  const fullscreenState = useSyncExternalStore(fullscreen.subscribe, fullscreen.getState, fullscreen.getState)
  const controllerLifecycleGeneration = useRef(0)
  useEffect(() => {
    const diagnostics = controller.getDiagnostics()
    appendRuntimeTrace({ side: 'Audience', publisherControllerInstanceId: diagnostics.scope.displayId, scope: diagnostics.scope, route: () => `${window.location.pathname}${window.location.search}` }, { messageType: 'rendered-state', direction: 'local', renderedState: state.kind, publicState: state.kind === 'snapshot' ? state.snapshot.displayTest === true ? 'display-test' : state.snapshot.stage === 'standby' ? 'standby' : 'draw' : 'unknown', controllerStateAfter: state.kind })
  }, [controller, state])
  const selectedRenderedState: AudienceRenderedState = state.kind !== 'snapshot'
    ? state.kind === 'unavailable' ? 'unavailable' : state.kind
    : state.snapshot.blackoutRequested ? 'blackout' : state.snapshot.displayTest === true ? 'display-test' : state.snapshot.stage === 'standby' ? 'standby' : 'draw'
  useEffect(() => {
    if (state.kind !== 'snapshot') return
    const diagnostics = controller.getDiagnostics()
    if (diagnostics.acceptedEpoch === undefined || diagnostics.acceptedSequence === undefined || diagnostics.publicState === undefined) return
    controller.commitRenderedState({ epoch: diagnostics.acceptedEpoch, sequence: diagnostics.acceptedSequence, publicState: diagnostics.publicState, selectedRenderedState })
  }, [controller, selectedRenderedState, state])
  useEffect(() => {
    const generation = controllerLifecycleGeneration.current + 1
    controllerLifecycleGeneration.current = generation
    controller.startHandshake()
    return () => { queueMicrotask(() => { if (controllerLifecycleGeneration.current === generation) controller.close() }) }
  }, [controller])
  useEffect(() => () => fullscreen.close(), [fullscreen])

  if (scope === undefined && suppliedTransport === undefined) return <><AudienceUnavailablePresentation state="connecting" /><p role="status">This Audience Display link is missing valid production context. Open it from Settings.</p></>
  if (scope === undefined) return <><AudienceUnavailablePresentation state="disconnected-safe" /><p role="status">Audience Display context is unavailable.</p></>

  const controls = <FullscreenControls controller={fullscreen} state={fullscreenState} />
  if (state.kind === 'connecting' || state.kind === 'disconnected-safe' || state.kind === 'unavailable') return <><AudienceUnavailablePresentation state={state.kind === 'connecting' ? 'connecting' : 'disconnected-safe'} />{controls}<AudienceDevelopmentDiagnostics controller={controller} renderedState={state.kind} enabled={audienceDiagnosticsDebugEnabled} /></>
  return <><AudiencePresentation snapshot={state.snapshot} />{controls}<AudienceDevelopmentDiagnostics controller={controller} renderedState={selectedRenderedState} enabled={audienceDiagnosticsDebugEnabled} /></>
}
