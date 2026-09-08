import { acceptSequence, createProtocolEnvelope, validateEnvelopeContext, type ProtocolEnvelope, type ProtocolScope, type SequenceTracker } from './protocol.ts'
import { parsePublicDisplaySnapshot, serializePublicDisplaySnapshot, type PublicDisplaySnapshot } from './public-projection.ts'
import type { Transport } from './transport.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import { appendRuntimeTrace } from './runtime-trace.ts'

export type AudienceControllerState =
  | { readonly kind: 'connecting' }
  | { readonly kind: 'unavailable'; readonly connection: 'unavailable' }
  | { readonly kind: 'disconnected-safe'; readonly connection: AudienceConnectionState }
  | { readonly kind: 'snapshot'; readonly connection: AudienceConnectionState; readonly snapshot: PublicDisplaySnapshot }

export type AudienceRenderedState = 'connecting' | 'reconnecting' | 'disconnected-safe' | 'unavailable' | 'blackout' | 'display-test' | 'standby' | 'draw'

export type AudienceRenderCommit = Readonly<{
  readonly epoch: number
  readonly sequence: number
  readonly publicState: 'display-test' | 'standby' | 'draw'
  readonly selectedRenderedState: AudienceRenderedState
}>

export type AudienceConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected-safe'
  | 'unavailable'
  | 'reconnect-pending'
  | 'restore-pending'
  | 'failed-safe'

export type AudienceController = {
  readonly getState: () => AudienceControllerState
  readonly getDiagnostics: () => AudienceRuntimeDiagnostics
  readonly getConnectionState: () => AudienceConnectionState
  readonly subscribe: (listener: () => void) => () => void
  readonly close: () => void
  readonly commitRenderedState: (commit: AudienceRenderCommit) => void
  readonly startHandshake: () => void
}

export type AudienceRuntimeDiagnostics = {
  readonly resolvedEventId: string
  readonly displayConfigurationId: string
  readonly channelName: string
  readonly scope: ProtocolScope
  readonly lastMessageType: string
  readonly lastEnvelopeEpoch: number | undefined
  readonly lastEnvelopeSequence: number | undefined
  readonly publicState: 'display-test' | 'standby' | 'draw' | undefined
  readonly validationResult: 'not-run' | 'accepted' | 'rejected'
  readonly rejectionReason: string | undefined
  readonly stateBeforeReceipt: AudienceControllerState['kind'] | undefined
  readonly stateAfterReceipt: AudienceControllerState['kind'] | undefined
  readonly lastSnapshotApplied: { readonly epoch: number; readonly sequence: number; readonly publicState: 'display-test' | 'standby' | 'draw' } | undefined
  readonly controllerInstanceId: string
  readonly acceptedPublisherInstanceId: string | undefined
  readonly acceptedEpoch: number | undefined
  readonly acceptedSequence: number | undefined
  readonly lastPublisherActivity: string | undefined
  readonly latestHeartbeatReceived: string | undefined
  readonly watchdogArmedAt: string | undefined
  readonly watchdogExpiry: string | undefined
  readonly mostRecentTimeoutCallback: string | undefined
  readonly disconnectedReason: string | undefined
  readonly selectedRenderedState: AudienceRenderedState
  readonly acknowledgementPending: { readonly epoch: number; readonly sequence: number; readonly publicState: 'display-test' | 'standby' | 'draw' } | undefined
  readonly acknowledgementSuppressionReason: string | undefined
  readonly invariantFailure: string | undefined
  readonly heartbeatIntervalMs: number
  readonly activeHeartbeatTimerCount: number
  readonly heartbeatSentCount: number
  readonly heartbeatReceivedCount: number
  readonly helloCount: number
  readonly restoreRequestCount: number
  readonly listenerAttached: boolean
  readonly channelOpen: boolean
  readonly listenerAttachedAt: string | undefined
  readonly helloSentAt: string | undefined
  readonly restoreRequestTimestamps: readonly string[]
  readonly firstSnapshotApplied: { readonly epoch: number; readonly sequence: number; readonly publicState: 'display-test' | 'standby' | 'draw' } | undefined
  readonly acknowledgementSentAt: string | undefined
  readonly transportCleanupReason: string | undefined
  readonly activePresenceHeartbeatTimerCount: number
}

type AudienceControllerOptions = {
  readonly transport: Transport
  readonly transportFactory?: () => Transport
  readonly scope: ProtocolScope
  readonly expectedSession?: DrawSessionId
  readonly sourceId?: string
  readonly now?: () => string
  readonly reconnectDelayMs?: number
  readonly scheduleReconnect?: (callback: () => void, delayMs: number) => unknown
  readonly cancelReconnect?: (handle: unknown) => void
  readonly livenessTimeoutMs?: number
  readonly scheduleWatchdog?: (callback: () => void, delayMs: number) => unknown
  readonly cancelWatchdog?: (handle: unknown) => void
  readonly route?: () => string
  readonly autoStartHandshake?: boolean
  readonly restoreRetryMs?: number
  readonly scheduleRestoreRetry?: (callback: () => void, delayMs: number) => unknown
  readonly cancelRestoreRetry?: (handle: unknown) => void
  readonly presenceHeartbeatIntervalMs?: number
  readonly schedulePresenceHeartbeat?: (callback: () => void, delayMs: number) => unknown
  readonly cancelPresenceHeartbeat?: (handle: unknown) => void
}

export const AUDIENCE_LIVENESS_TIMEOUT_MS = 5000
export const AUDIENCE_PRESENCE_HEARTBEAT_INTERVAL_MS = 1000

export function createAudienceController(options: AudienceControllerOptions): AudienceController {
  let currentTransport = options.transport
  let connection: AudienceConnectionState = currentTransport.capability.transport === 'available' ? 'connecting' : 'unavailable'
  let state: AudienceControllerState = currentTransport.capability.transport === 'available' ? { kind: 'connecting' } : { kind: 'unavailable', connection: 'unavailable' }
  let acceptedSession = options.expectedSession
  let acceptedOrdering: SequenceTracker | undefined
  let acceptedOperator: string | undefined
  const retiredOperators = new Set<string>()
  const sourceId = options.sourceId ?? `${options.scope.displayId}:${globalThis.crypto.randomUUID()}`
  const acceptedMessageIds = new Set<string>()
  let restoreRequested = false
  let nextOutboundSequence = 1
  let reconnectHandle: unknown = null
  let restoreRetryHandle: unknown = null
  let restoreRetryGeneration = 0
  let presenceHeartbeatHandle: unknown = null
  let watchdogHandle: unknown = null
  let watchdogGeneration = 0
  let closed = false
  let retainedSnapshot: PublicDisplaySnapshot | undefined
  let retainedSnapshotSerialized: string | undefined
  let unsubscribe: () => void = () => undefined
  let unsubscribeClose: () => void = () => undefined
  const traceBase = { side: 'Audience' as const, publisherControllerInstanceId: sourceId, scope: options.scope, channelName: `raffle-os-display:${options.scope.eventId}:${options.scope.displayId}`, route: options.route }
  const trace = (patch: Parameters<typeof appendRuntimeTrace>[1]) => appendRuntimeTrace(traceBase, patch)
  trace({ messageType: 'listener-created', direction: 'local' })
  trace({ messageType: 'channel-opened', direction: 'local', validationResult: currentTransport.capability.transport === 'available' ? 'accepted' : 'rejected' })
  let diagnostics: AudienceRuntimeDiagnostics = {
    resolvedEventId: options.scope.eventId,
    displayConfigurationId: options.scope.displayId,
    channelName: `raffle-os-display:${options.scope.eventId}:${options.scope.displayId}`,
    scope: options.scope,
    lastMessageType: 'none',
    lastEnvelopeEpoch: undefined,
    lastEnvelopeSequence: undefined,
    publicState: undefined,
    validationResult: 'not-run',
    rejectionReason: undefined,
    stateBeforeReceipt: undefined,
    stateAfterReceipt: undefined,
    lastSnapshotApplied: undefined,
    controllerInstanceId: sourceId,
    acceptedPublisherInstanceId: undefined,
    acceptedEpoch: undefined,
    acceptedSequence: undefined,
    lastPublisherActivity: undefined,
    latestHeartbeatReceived: undefined,
    watchdogArmedAt: undefined,
    watchdogExpiry: undefined,
    mostRecentTimeoutCallback: undefined,
    disconnectedReason: undefined,
    selectedRenderedState: connection === 'connecting' ? 'connecting' : 'unavailable',
    acknowledgementPending: undefined,
    acknowledgementSuppressionReason: undefined,
    invariantFailure: undefined,
    heartbeatIntervalMs: 0,
    activeHeartbeatTimerCount: 0,
    heartbeatSentCount: 0,
    heartbeatReceivedCount: 0,
    helloCount: 0,
    restoreRequestCount: 0,
    listenerAttached: false,
    channelOpen: currentTransport.capability.transport === 'available',
    listenerAttachedAt: undefined,
    helloSentAt: undefined,
    restoreRequestTimestamps: [],
    firstSnapshotApplied: undefined,
    acknowledgementSentAt: undefined,
    transportCleanupReason: undefined,
    activePresenceHeartbeatTimerCount: 0,
  }
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => { try { listener() } catch { /* one display cannot break another */ } })
  const now = () => options.now?.() ?? new Date().toISOString()
  const schedule = options.scheduleReconnect ?? ((callback, delay) => globalThis.setTimeout(callback, delay))
  const cancel = options.cancelReconnect ?? ((handle) => globalThis.clearTimeout(handle as number))
  const scheduleWatchdog = options.scheduleWatchdog ?? ((callback, delay) => globalThis.setTimeout(callback, delay))
  const cancelWatchdog = options.cancelWatchdog ?? ((handle) => globalThis.clearTimeout(handle as number))
  const scheduleRestoreRetry = options.scheduleRestoreRetry ?? ((callback, delay) => globalThis.setTimeout(callback, delay))
  const cancelRestoreRetry = options.cancelRestoreRetry ?? ((handle) => globalThis.clearTimeout(handle as number))
  const schedulePresenceHeartbeat = options.schedulePresenceHeartbeat ?? ((callback, delay) => globalThis.setInterval(callback, delay))
  const cancelPresenceHeartbeat = options.cancelPresenceHeartbeat ?? ((handle) => globalThis.clearInterval(handle as number))

  const clearRestoreRetry = (): void => {
    restoreRetryGeneration += 1
    if (restoreRetryHandle !== null) { cancelRestoreRetry(restoreRetryHandle); restoreRetryHandle = null }
  }

  const clearWatchdog = (): void => {
    watchdogGeneration += 1
    if (watchdogHandle !== null) {
      cancelWatchdog(watchdogHandle)
      watchdogHandle = null
    }
  }

  const armWatchdog = (): void => {
    clearWatchdog()
    if (closed || currentTransport.capability.transport !== 'available') return
    const generation = watchdogGeneration
    const timeoutMs = options.livenessTimeoutMs ?? AUDIENCE_LIVENESS_TIMEOUT_MS
    const armedAt = now()
    diagnostics = { ...diagnostics, watchdogArmedAt: armedAt, watchdogExpiry: new Date(Date.now() + timeoutMs).toISOString(), disconnectedReason: undefined }
    watchdogHandle = scheduleWatchdog(() => {
      if (closed || generation !== watchdogGeneration) return
      watchdogHandle = null
      diagnostics = { ...diagnostics, mostRecentTimeoutCallback: now(), disconnectedReason: 'publisher-liveness-expired' }
      enterDisconnected()
    }, timeoutMs)
  }

  const recordPublisherActivity = (heartbeat: boolean): void => {
    diagnostics = { ...diagnostics, lastPublisherActivity: now(), ...(heartbeat ? { latestHeartbeatReceived: now(), heartbeatReceivedCount: diagnostics.heartbeatReceivedCount + 1 } : {}) }
    connection = 'connected'
    if (retainedSnapshot !== undefined && state.kind === 'disconnected-safe') {
      state = { kind: 'snapshot', connection, snapshot: retainedSnapshot }
      diagnostics = { ...diagnostics, stateAfterReceipt: state.kind, disconnectedReason: undefined }
      notify()
    }
    armWatchdog()
  }

  const send = (message: ProtocolEnvelope['message'], sequence: number, epoch = acceptedOrdering?.epoch ?? 1): void => {
    if (closed || currentTransport.capability.transport !== 'available') return
    const result = currentTransport.publish(createProtocolEnvelope({
      sender: { kind: 'display', id: sourceId },
      scope: options.scope,
      ...(acceptedSession === undefined ? {} : { drawSessionId: acceptedSession }),
      epoch,
      sequence,
      emittedAt: now(),
      message,
    }))
    const publicState = message.type === 'display-snapshot-applied' ? message.publicState : 'unknown'
    if (message.type === 'display-ready') diagnostics = { ...diagnostics, helloCount: diagnostics.helloCount + 1, helloSentAt: now() }
    if (message.type === 'display-restore-request') diagnostics = { ...diagnostics, restoreRequestCount: diagnostics.restoreRequestCount + 1 }
    if (message.type === 'display-heartbeat') diagnostics = { ...diagnostics, heartbeatSentCount: diagnostics.heartbeatSentCount + 1 }
    trace({ epoch, sequence, direction: 'sent', messageType: message.type === 'display-ready' ? 'hello' : message.type === 'display-restore-request' ? 'restore-request' : message.type === 'display-snapshot-applied' ? 'acknowledgement' : message.type, publicState, validationResult: result.ok ? 'accepted' : 'rejected', orderingResult: 'accepted', acknowledgementStatus: message.type === 'display-snapshot-applied' ? 'sent' : 'not-applicable' })
  }
  const sendReady = () => send({ type: 'display-ready', capability: { broadcastChannel: currentTransport.capability.broadcastChannel, fullscreen: currentTransport.capability.fullscreen } }, 0)
  const sendPresenceHeartbeat = () => send({ type: 'display-heartbeat' }, nextOutboundSequence++)
  const startPresenceHeartbeat = (): void => {
    if (presenceHeartbeatHandle !== null || closed || currentTransport.capability.transport !== 'available') return
    presenceHeartbeatHandle = schedulePresenceHeartbeat(sendPresenceHeartbeat, options.presenceHeartbeatIntervalMs ?? AUDIENCE_PRESENCE_HEARTBEAT_INTERVAL_MS)
    diagnostics = { ...diagnostics, activePresenceHeartbeatTimerCount: 1 }
  }
  const sendApplied = (envelope: ProtocolEnvelope, snapshot: PublicDisplaySnapshot) => {
    const publicState = snapshot.displayTest === true ? 'display-test' : snapshot.stage === 'standby' ? 'standby' : 'draw'
    diagnostics = { ...diagnostics, lastSnapshotApplied: { epoch: envelope.epoch, sequence: envelope.sequence, publicState } }
    diagnostics = { ...diagnostics, acknowledgementSentAt: now() }
    send({ type: 'display-snapshot-applied', appliedEpoch: envelope.epoch, appliedSequence: envelope.sequence, publicState }, nextOutboundSequence++)
  }
  let pendingAcknowledgement: { readonly envelope: ProtocolEnvelope; readonly snapshot: PublicDisplaySnapshot; readonly publicState: 'display-test' | 'standby' | 'draw' } | undefined
  const commitRenderedState = (commit: AudienceRenderCommit): void => {
    diagnostics = { ...diagnostics, selectedRenderedState: commit.selectedRenderedState, acknowledgementSuppressionReason: undefined }
    const pending = pendingAcknowledgement
    if (pending === undefined) return
    if (pending.envelope.epoch !== commit.epoch || pending.envelope.sequence !== commit.sequence || pending.publicState !== commit.publicState) {
      diagnostics = { ...diagnostics, acknowledgementSuppressionReason: 'render-commit-does-not-match-pending-snapshot' }
      return
    }
    if (commit.selectedRenderedState !== commit.publicState) {
      const reason = `rendered-state-mismatch:${commit.selectedRenderedState}!=${commit.publicState}`
      diagnostics = { ...diagnostics, acknowledgementSuppressionReason: reason, invariantFailure: reason, acknowledgementPending: { epoch: pending.envelope.epoch, sequence: pending.envelope.sequence, publicState: pending.publicState } }
      trace({ messageType: 'acknowledgement-suppressed', direction: 'local', publicState: pending.publicState, epoch: pending.envelope.epoch, sequence: pending.envelope.sequence, renderedState: commit.selectedRenderedState, acknowledgementStatus: 'suppressed', rejectionReason: reason })
      return
    }
    pendingAcknowledgement = undefined
    diagnostics = { ...diagnostics, acknowledgementPending: undefined, acknowledgementSuppressionReason: undefined, invariantFailure: undefined, selectedRenderedState: commit.selectedRenderedState }
    sendApplied(pending.envelope, pending.snapshot)
    notify()
  }
  const requestRestore = () => {
    if (restoreRequested) return
    restoreRequested = true
    connection = 'restore-pending'
    if (state.kind === 'snapshot') state = { ...state, connection }
    notify()
    const requestedAt = now()
    diagnostics = { ...diagnostics, restoreRequestTimestamps: [...diagnostics.restoreRequestTimestamps, requestedAt] }
    send({ type: 'display-restore-request', ...(acceptedOrdering === undefined ? {} : { requestedEpoch: acceptedOrdering.epoch, requestedSequence: acceptedOrdering.sequence }) }, nextOutboundSequence++)
  }
  const scheduleRestore = (): void => {
    clearRestoreRetry()
    if (closed || retainedSnapshot !== undefined) return
    const generation = restoreRetryGeneration
    restoreRetryHandle = scheduleRestoreRetry(() => {
      if (closed || generation !== restoreRetryGeneration || retainedSnapshot !== undefined) return
      restoreRetryHandle = null
      restoreRequested = false
      requestRestore()
      scheduleRestore()
    }, options.restoreRetryMs ?? 1000)
  }
  const startHandshake = (): void => {
    if (closed || currentTransport.capability.transport !== 'available' || diagnostics.listenerAttached) return
    attach()
    diagnostics = { ...diagnostics, listenerAttached: true, listenerAttachedAt: now(), channelOpen: true }
    armWatchdog()
    startPresenceHeartbeat()
    sendReady()
    requestRestore()
    if (retainedSnapshot === undefined) scheduleRestore()
  }

  const onEnvelope = (envelope: ProtocolEnvelope): void => {
    trace({ epoch: envelope.epoch, sequence: envelope.sequence, direction: 'received', messageType: envelope.message.type, publicState: envelope.message.type === 'display-state' ? envelope.message.displayTest === true ? 'display-test' : envelope.message.stage === 'standby' ? 'standby' : 'draw' : 'unknown', controllerStateBefore: state.kind })
    diagnostics = { ...diagnostics, lastMessageType: envelope.message.type, lastEnvelopeEpoch: envelope.epoch, lastEnvelopeSequence: envelope.sequence, stateBeforeReceipt: state.kind, rejectionReason: undefined }
    if (closed || envelope.sender.kind !== 'operator') return
    const contextError = validateEnvelopeContext(envelope, options.scope)
    if (contextError !== undefined) { trace({ validationResult: 'rejected', rejectionReason: contextError.kind }); diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: contextError.kind }; return }
    const sender = `${envelope.sender.kind}:${envelope.sender.id}`
    if (retiredOperators.has(sender)) { trace({ validationResult: 'rejected', rejectionReason: 'retired-publisher' }); diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: 'retired-publisher' }; return }
    if (acceptedOperator !== undefined && sender !== acceptedOperator) {
      if (envelope.message.type !== 'display-state') { trace({ validationResult: 'rejected', rejectionReason: 'operator-mismatch' }); diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: 'operator-mismatch' }; return }
      retiredOperators.add(acceptedOperator)
      acceptedOperator = undefined
      acceptedOrdering = undefined
      acceptedMessageIds.clear()
      acceptedSession = options.expectedSession
      restoreRequested = false
    }
    if (envelope.message.type === 'display-heartbeat') {
      acceptedOperator = sender
      diagnostics = { ...diagnostics, validationResult: 'accepted', rejectionReason: undefined, acceptedPublisherInstanceId: envelope.sender.id, acceptedEpoch: acceptedOrdering?.epoch, acceptedSequence: acceptedOrdering?.sequence }
      recordPublisherActivity(true)
      trace({ validationResult: 'accepted', orderingResult: 'accepted', controllerStateAfter: state.kind, messageType: 'heartbeat' })
      if (state.kind === 'disconnected-safe') requestRestore()
      return
    }
    if (envelope.message.type !== 'display-state') return
    const isSafeNonDrawState = envelope.message.displayTest === true || envelope.message.stage === 'standby'
    if (!isSafeNonDrawState && options.expectedSession !== undefined && envelope.drawSessionId !== options.expectedSession) { trace({ validationResult: 'rejected', rejectionReason: 'session-mismatch' }); diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: 'session-mismatch' }; return }
    if (acceptedMessageIds.has(envelope.messageId)) { trace({ validationResult: 'rejected', orderingResult: 'rejected', rejectionReason: 'duplicate-message' }); diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: 'duplicate-message' }; return }
    const message = envelope.message
    const isRestore = message.restore === true
    const orderingError = isRestore ? undefined : acceptSequence(acceptedOrdering, envelope)
    if (orderingError !== undefined) {
      if (orderingError.kind === 'sequence-gap' || orderingError.kind === 'sequence-out-of-order') requestRestore()
      trace({ validationResult: 'rejected', orderingResult: 'rejected', rejectionReason: orderingError.kind })
      diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: orderingError.kind }
      return
    }
    try {
      const snapshot = parsePublicDisplaySnapshot({
        drawSessionId: message.drawSessionId,
        stage: message.stage,
        ...(message.stageStartedAt === undefined ? {} : { stageStartedAt: message.stageStartedAt }),
        ...(message.revealStartedAt === undefined ? {} : { revealStartedAt: message.revealStartedAt }),
        ...(message.countdownValue === undefined ? {} : { countdownValue: message.countdownValue }),
        blackoutRequested: message.blackoutRequested ?? false,
        ...(message.displayTest === undefined ? {} : { displayTest: message.displayTest }),
        ...(message.eventName === undefined ? {} : { eventName: message.eventName }),
        ...(message.prizeCategory === undefined ? {} : { prizeCategory: message.prizeCategory }), ...(message.prizeName === undefined ? {} : { prizeName: message.prizeName }), ...(message.prizeImageAssetId === undefined ? {} : { prizeImageAssetId: message.prizeImageAssetId }), ...(message.winnerCount === undefined ? {} : { winnerCount: message.winnerCount }),
        ...(message.eventSubtitle === undefined ? {} : { eventSubtitle: message.eventSubtitle }), ...(message.primaryColor === undefined ? {} : { primaryColor: message.primaryColor }), ...(message.accentColor === undefined ? {} : { accentColor: message.accentColor }), ...(message.appearance === undefined ? {} : { appearance: message.appearance }), ...(message.logo === undefined ? {} : { logo: message.logo }), ...(message.background === undefined ? {} : { background: message.background }), ...(message.blackoutAppearance === undefined ? {} : { blackoutAppearance: message.blackoutAppearance }), ...(message.safeAreaMargin === undefined ? {} : { safeAreaMargin: message.safeAreaMargin }),
        ...(message.mode === undefined ? {} : { mode: message.mode }),
        ...(message.rollingSlotCount === undefined ? {} : { rollingSlotCount: message.rollingSlotCount }),
        ...(message.rollSpeedPerSecond === undefined ? {} : { rollSpeedPerSecond: message.rollSpeedPerSecond }),
        ...(message.rollStopMode === undefined ? {} : { rollStopMode: message.rollStopMode }),
        ...(message.rollDurationSeconds === undefined ? {} : { rollDurationSeconds: message.rollDurationSeconds }),
        ...(message.presentationSeed === undefined ? {} : { presentationSeed: message.presentationSeed }),
        ...(message.presentationMode === undefined ? {} : { presentationMode: message.presentationMode }),
        ...(message.revealMode === undefined ? {} : { revealMode: message.revealMode }),
        ...(message.stage === 'rolling' ? {
          rollingSlotCount: message.rollingSlotCount ?? 1,
          rollSpeedPerSecond: message.rollSpeedPerSecond ?? 12,
          rollStopMode: message.rollStopMode ?? 'timed',
          rollDurationSeconds: message.rollDurationSeconds ?? 8,
          presentationSeed: message.presentationSeed ?? message.drawSessionId ?? 'raffle-os-audience',
          revealMode: message.revealMode ?? 'all-together',
        } : {}),
        ...(message.ticketNumbers === undefined ? {} : { ticketNumbers: message.ticketNumbers }),
        ...(message.winnerStatuses === undefined ? {} : { winnerStatuses: message.winnerStatuses }),
        ...(message.verificationState === undefined ? {} : { verificationState: message.verificationState }),
      }, options.expectedSession)
      const serializedSnapshot = serializePublicDisplaySnapshot(snapshot)
      const visibleSnapshot = state.kind === 'snapshot' && state.connection === 'connected' ? state.snapshot : undefined
      const reuseVisibleSnapshot = visibleSnapshot !== undefined && retainedSnapshotSerialized === serializedSnapshot
      acceptedMessageIds.add(envelope.messageId)
      acceptedOrdering = { epoch: envelope.epoch, sequence: envelope.sequence }
      acceptedOperator = sender
      if (!isSafeNonDrawState) acceptedSession = snapshot.drawSessionId
      restoreRequested = false
      connection = 'connected'
      retainedSnapshot = reuseVisibleSnapshot ? visibleSnapshot : snapshot
      retainedSnapshotSerialized = serializedSnapshot
      if (!reuseVisibleSnapshot) state = { kind: 'snapshot', connection, snapshot }
      recordPublisherActivity(false)
      const publicState = snapshot.displayTest === true ? 'display-test' : snapshot.stage === 'standby' ? 'standby' : 'draw'
      clearRestoreRetry()
      pendingAcknowledgement = { envelope, snapshot, publicState }
      diagnostics = { ...diagnostics, validationResult: 'accepted', rejectionReason: undefined, publicState, stateAfterReceipt: state.kind, acceptedPublisherInstanceId: envelope.sender.id, acceptedEpoch: envelope.epoch, acceptedSequence: envelope.sequence, firstSnapshotApplied: diagnostics.firstSnapshotApplied ?? { epoch: envelope.epoch, sequence: envelope.sequence, publicState }, acknowledgementPending: { epoch: envelope.epoch, sequence: envelope.sequence, publicState }, acknowledgementSuppressionReason: undefined, invariantFailure: undefined }
      if (reuseVisibleSnapshot) {
        pendingAcknowledgement = undefined
        diagnostics = { ...diagnostics, acknowledgementPending: undefined, selectedRenderedState: publicState }
        trace({ messageType: 'visual-state-unchanged', validationResult: 'accepted', orderingResult: 'accepted', controllerStateAfter: state.kind, renderedState: publicState, acknowledgementStatus: 'sent' })
        sendApplied(envelope, snapshot)
      } else {
        trace({ validationResult: 'accepted', orderingResult: 'accepted', controllerStateAfter: state.kind, renderedState: publicState, acknowledgementStatus: 'pending' })
        notify()
      }
      // React must report the actual selected public presentation before this
      // snapshot is acknowledged. Validation/controller receipt alone is not
      // product-visible application.
    } catch (error: unknown) {
      // Invalid, private, cross-session, or otherwise malformed snapshots never replace safe state.
      const reason = error instanceof Error ? error.message : 'invalid-public-snapshot'
      trace({ validationResult: 'rejected', rejectionReason: reason })
      diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: reason }
    }
  }

  const enterDisconnected = () => {
    if (closed) return
    if (presenceHeartbeatHandle !== null) { cancelPresenceHeartbeat(presenceHeartbeatHandle); presenceHeartbeatHandle = null; diagnostics = { ...diagnostics, activePresenceHeartbeatTimerCount: 0 } }
    diagnostics = { ...diagnostics, channelOpen: false }
    connection = options.transportFactory === undefined ? 'disconnected-safe' : 'reconnect-pending'
    state = { kind: 'disconnected-safe', connection }
    diagnostics = { ...diagnostics, selectedRenderedState: 'disconnected-safe' }
    notify()
    if (options.transportFactory !== undefined && reconnectHandle === null) {
      reconnectHandle = schedule(() => {
        reconnectHandle = null
        if (closed) return
        unsubscribe()
        unsubscribeClose()
        currentTransport.close()
        unsubscribe = () => undefined
        unsubscribeClose = () => undefined
        currentTransport = options.transportFactory?.() ?? currentTransport
        connection = currentTransport.capability.transport === 'available' ? 'connecting' : 'unavailable'
        state = currentTransport.capability.transport === 'available' ? { kind: 'connecting' } : { kind: 'unavailable', connection: 'unavailable' }
        notify()
        diagnostics = { ...diagnostics, listenerAttached: false, channelOpen: currentTransport.capability.transport === 'available' }
        if (currentTransport.capability.transport === 'available') startHandshake()
      }, options.reconnectDelayMs ?? 100)
    }
  }
  const attach = () => {
    unsubscribe()
    unsubscribeClose()
    unsubscribe = currentTransport.subscribe(onEnvelope)
    unsubscribeClose = currentTransport.onClose?.(enterDisconnected) ?? (() => undefined)
  }
  if (options.autoStartHandshake !== false) startHandshake()

  return {
    getState: () => state,
    getDiagnostics: () => diagnostics,
    getConnectionState: () => connection,
    commitRenderedState,
    startHandshake,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
  close() {
      if (closed) return
      send({ type: 'display-close' }, nextOutboundSequence++)
      closed = true
      clearWatchdog()
      clearRestoreRetry()
      if (presenceHeartbeatHandle !== null) { cancelPresenceHeartbeat(presenceHeartbeatHandle); presenceHeartbeatHandle = null }
      if (reconnectHandle !== null) { cancel(reconnectHandle); reconnectHandle = null }
      unsubscribe()
      unsubscribeClose()
      currentTransport.close()
      trace({ messageType: 'listener-disposed', direction: 'local', cleanupDisposeReason: 'close-called', controllerStateBefore: state.kind, controllerStateAfter: 'disconnected-safe' })
      trace({ messageType: 'channel-closed', direction: 'local', cleanupDisposeReason: 'close-called' })
      connection = 'disconnected-safe'
      diagnostics = { ...diagnostics, channelOpen: false, listenerAttached: false, activePresenceHeartbeatTimerCount: 0, transportCleanupReason: 'close-called' }
      state = { kind: 'disconnected-safe', connection }
      notify()
      listeners.clear()
    },
  }
}
