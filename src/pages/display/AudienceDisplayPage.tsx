import { useEffect, useMemo, useSyncExternalStore, type CSSProperties } from 'react'
import { createAudienceController } from '../../application/display-transport/audience-controller.ts'
import { createFullscreenController, type FullscreenState } from '../../application/display-transport/fullscreen-controller.ts'
import type { PublicDisplaySnapshot } from '../../application/display-transport/public-projection.ts'
import { createAudienceTransport, type Transport } from '../../application/display-transport/transport.ts'
import type { ProtocolScope } from '../../application/display-transport/protocol.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import { parseEventId, parseDisplayConfigurationId } from '../../domain/shared/identifiers.ts'
import { deriveProductionDisplayScope } from '../../application/display/display-configuration-service.ts'
import { BlackoutStage, CountdownStage, DisconnectedStage, RollingStage, StandbyStage, WinnerStage } from '../../ui/audience/index.ts'
import type { PublicAudienceScenario } from '../../ui/audience/audience-view.types.ts'
import { RuntimeDiagnosticsPanel } from '../../application/display-transport/RuntimeDiagnostics.tsx'
import { appendRuntimeTrace } from '../../application/display-transport/runtime-trace.ts'

const publicContext = { eventName: 'Raffle OS Audience', eventSubtitle: 'Public event presentation', prizeCategory: 'Current draw', prizeLabel: 'Winner announcement' } as const

type AudienceDisplayPageProps = Readonly<{ transport?: Transport; scope?: ProtocolScope; expectedSession?: DrawSessionId }>

function snapshotScenario(snapshot: PublicDisplaySnapshot): PublicAudienceScenario {
  const statuses = snapshot.winnerStatuses ?? []
  const hasTickets = (snapshot.ticketNumbers?.length ?? 0) > 0
  const committedState = snapshot.stage === 'pending-handoff' && !hasTickets
    ? 'standby' as const
    : snapshot.stage === 'pending-handoff' && hasTickets && statuses.length > 0 && statuses.every((status) => status === 'confirmed')
      ? 'confirmed' as const
      : snapshot.stage
  return {
    ...publicContext,
    ...(snapshot.eventName === undefined ? {} : { eventName: snapshot.eventName }),
    ...(snapshot.eventSubtitle === undefined ? {} : { eventSubtitle: snapshot.eventSubtitle }),
    ...(snapshot.logo === undefined ? {} : { logo: snapshot.logo.blob }),
    ...(snapshot.primaryColor === undefined ? {} : { primaryColor: snapshot.primaryColor }),
    ...(snapshot.accentColor === undefined ? {} : { accentColor: snapshot.accentColor }),
    state: committedState,
    message: committedState === 'standby' ? (snapshot.displayTest === false ? 'Waiting for the next presentation' : snapshot.stage === 'pending-handoff' ? 'No active winners' : 'Draw will begin shortly') : committedState === 'countdown' ? 'Get ready' : committedState === 'rolling' ? 'Drawing in progress' : undefined,
    countdownValue: snapshot.stage === 'countdown' ? '—' : undefined,
    ticketNumbers: snapshot.ticketNumbers,
    statusMessage: committedState === 'confirmed' ? 'Confirmed result' : snapshot.stage === 'pending-handoff' ? (snapshot.winnerStatuses === undefined ? 'Public result' : 'Results under verification') : snapshot.stage === 'reveal' ? 'Results under verification' : undefined,
    displayTest: snapshot.displayTest,
  }
}

function safeStatusScenario(state: 'connecting' | 'disconnected-safe'): PublicAudienceScenario {
  return { ...publicContext, state, message: state === 'connecting' ? 'Connecting to the operator' : 'Display connection interrupted', instruction: state === 'connecting' ? 'Waiting for a public presentation snapshot.' : 'Please wait for the operator.' }
}

function AudienceDevelopmentDiagnostics({ controller, renderedState }: { readonly controller: ReturnType<typeof createAudienceController>; readonly renderedState: string }) {
  const diagnostics = controller.getDiagnostics()
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

export function AudienceDisplayPage({ transport: suppliedTransport, scope: suppliedScope, expectedSession }: AudienceDisplayPageProps) {
  // Keep the production URL context stable for the lifetime of this route. The
  // previous implementation recreated these parse results on every render;
  // that recreated the channel and Audience controller immediately
  // after the first snapshot notification, losing the applied snapshot.
  const search = typeof window === 'undefined' ? '' : window.location.search
  const query = useMemo(() => new URLSearchParams(search), [search])
  const eventIdParam = query.get('eventId')
  const displayIdParam = query.get('displayConfigurationId')
  const eventId = useMemo(() => parseEventId(eventIdParam), [eventIdParam])
  const displayId = useMemo(() => parseDisplayConfigurationId(displayIdParam), [displayIdParam])
  const scope = useMemo(() => suppliedScope ?? (eventId.ok && displayId.ok ? deriveProductionDisplayScope(eventId.value, displayId.value) : undefined), [displayId, eventId, suppliedScope])
  const hookScope = useMemo(() => scope ?? { eventId: 'invalid-event-context', displayId: 'invalid-display-context' }, [scope])
  const transport = useMemo(() => suppliedTransport ?? createAudienceTransport('raffle-os-display', hookScope), [hookScope, suppliedTransport])
  const transportFactory = useMemo(() => suppliedTransport === undefined ? () => createAudienceTransport('raffle-os-display', hookScope) : undefined, [hookScope, suppliedTransport])
  const controller = useMemo(() => createAudienceController({ transport, transportFactory, scope: hookScope, expectedSession }), [expectedSession, hookScope, transport, transportFactory])
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  const fullscreen = useMemo(() => createFullscreenController({ target: typeof document === 'undefined' ? undefined : document.documentElement }), [])
  const fullscreenState = useSyncExternalStore(fullscreen.subscribe, fullscreen.getState, fullscreen.getState)
  useEffect(() => {
    const diagnostics = controller.getDiagnostics()
    appendRuntimeTrace({ side: 'Audience', publisherControllerInstanceId: diagnostics.scope.displayId, scope: diagnostics.scope, route: () => `${window.location.pathname}${window.location.search}` }, { messageType: 'rendered-state', direction: 'local', renderedState: state.kind, publicState: state.kind === 'snapshot' ? state.snapshot.displayTest === true ? 'display-test' : state.snapshot.stage === 'standby' ? 'standby' : 'draw' : 'unknown', controllerStateAfter: state.kind })
  }, [controller, state])
  useEffect(() => () => controller.close(), [controller])
  useEffect(() => () => fullscreen.close(), [fullscreen])

  if (scope === undefined && suppliedTransport === undefined) return <><DisconnectedStage scenario={safeStatusScenario('connecting')} /><p role="status">This Audience Display link is missing valid production context. Open it from Settings.</p></>
  if (scope === undefined) return <><DisconnectedStage scenario={safeStatusScenario('disconnected-safe')} /><p role="status">Audience Display context is unavailable.</p></>

  const controls = <FullscreenControls controller={fullscreen} state={fullscreenState} />
  if (state.kind === 'connecting' || state.kind === 'disconnected-safe' || state.kind === 'unavailable') return <><DisconnectedStage scenario={safeStatusScenario(state.kind === 'connecting' ? 'connecting' : 'disconnected-safe')} />{controls}<AudienceDevelopmentDiagnostics controller={controller} renderedState={state.kind} /></>
  const audienceStyle = { '--audience-safe-inline': `${state.snapshot.safeAreaMargin ?? 0}px`, '--audience-safe-block': `${state.snapshot.safeAreaMargin ?? 0}px`, '--accent': state.snapshot.primaryColor ?? undefined, '--accent-hover': state.snapshot.accentColor ?? undefined, ...(state.snapshot.background === undefined ? {} : { '--audience-background-image': `url(${URL.createObjectURL(state.snapshot.background.blob)})` }) } as CSSProperties
  if (state.snapshot.blackoutRequested) return <div style={audienceStyle}><BlackoutStage appearance={state.snapshot.blackoutAppearance} />{controls}</div>
  const scenario = snapshotScenario(state.snapshot)
  const rendered = (() => {
  switch (scenario.state) {
    case 'standby': return <StandbyStage scenario={scenario} />
    case 'countdown': return <CountdownStage scenario={scenario} />
    case 'rolling': return <RollingStage scenario={scenario} />
    case 'reveal':
    case 'pending-handoff': return <WinnerStage scenario={scenario} />
    case 'confirmed': return <WinnerStage scenario={scenario} />
  }
  })()
  return <div style={audienceStyle}>{rendered}{controls}<AudienceDevelopmentDiagnostics controller={controller} renderedState={scenario.state} /></div>
}
