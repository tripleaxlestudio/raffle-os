import { acceptSequence, createProtocolEnvelope, validateEnvelopeContext, type ProtocolEnvelope, type ProtocolScope, type SequenceTracker } from './protocol.ts'
import { parsePublicDisplaySnapshot, type PublicDisplaySnapshot } from './public-projection.ts'
import type { Transport } from './transport.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'

export type AudienceControllerState =
  | { readonly kind: 'connecting' }
  | { readonly kind: 'unavailable'; readonly connection: 'unavailable' }
  | { readonly kind: 'disconnected-safe'; readonly connection: AudienceConnectionState }
  | { readonly kind: 'snapshot'; readonly connection: AudienceConnectionState; readonly snapshot: PublicDisplaySnapshot }

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
}

export function createAudienceController(options: AudienceControllerOptions): AudienceController {
  let currentTransport = options.transport
  let connection: AudienceConnectionState = currentTransport.capability.transport === 'available' ? 'connecting' : 'unavailable'
  let state: AudienceControllerState = currentTransport.capability.transport === 'available' ? { kind: 'connecting' } : { kind: 'unavailable', connection: 'unavailable' }
  let acceptedSession = options.expectedSession
  let acceptedOrdering: SequenceTracker | undefined
  let acceptedOperator: string | undefined
  const sourceId = options.sourceId ?? `${options.scope.displayId}:${globalThis.crypto.randomUUID()}`
  const acceptedMessageIds = new Set<string>()
  let restoreRequested = false
  let nextOutboundSequence = 1
  let reconnectHandle: unknown = null
  let closed = false
  let unsubscribe: () => void = () => undefined
  let unsubscribeClose: () => void = () => undefined
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
  }
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => { try { listener() } catch { /* one display cannot break another */ } })
  const now = () => options.now?.() ?? new Date().toISOString()
  const schedule = options.scheduleReconnect ?? ((callback, delay) => globalThis.setTimeout(callback, delay))
  const cancel = options.cancelReconnect ?? ((handle) => globalThis.clearTimeout(handle as number))

  const send = (message: ProtocolEnvelope['message'], sequence: number): void => {
    if (closed || currentTransport.capability.transport !== 'available') return
    currentTransport.publish(createProtocolEnvelope({
      sender: { kind: 'display', id: sourceId },
      scope: options.scope,
      ...(acceptedSession === undefined ? {} : { drawSessionId: acceptedSession }),
      epoch: 1,
      sequence,
      emittedAt: now(),
      message,
    }))
  }
  const sendReady = () => send({ type: 'display-ready', capability: { broadcastChannel: currentTransport.capability.broadcastChannel, fullscreen: currentTransport.capability.fullscreen } }, 0)
  const sendApplied = (envelope: ProtocolEnvelope, snapshot: PublicDisplaySnapshot) => {
    const publicState = snapshot.displayTest === true ? 'display-test' : snapshot.stage === 'standby' ? 'standby' : 'draw'
    diagnostics = { ...diagnostics, lastSnapshotApplied: { epoch: envelope.epoch, sequence: envelope.sequence, publicState } }
    send({ type: 'display-snapshot-applied', appliedEpoch: envelope.epoch, appliedSequence: envelope.sequence, publicState }, nextOutboundSequence++)
  }
  const requestRestore = () => {
    if (restoreRequested) return
    restoreRequested = true
    connection = 'restore-pending'
    if (state.kind === 'snapshot') state = { ...state, connection }
    notify()
    send({ type: 'display-restore-request', ...(acceptedOrdering === undefined ? {} : { requestedEpoch: acceptedOrdering.epoch, requestedSequence: acceptedOrdering.sequence }) }, nextOutboundSequence++)
  }

  const onEnvelope = (envelope: ProtocolEnvelope): void => {
    diagnostics = { ...diagnostics, lastMessageType: envelope.message.type, lastEnvelopeEpoch: envelope.epoch, lastEnvelopeSequence: envelope.sequence, stateBeforeReceipt: state.kind, rejectionReason: undefined }
    if (closed || envelope.message.type !== 'display-state' || envelope.sender.kind !== 'operator') return
    const contextError = validateEnvelopeContext(envelope, options.scope)
    if (contextError !== undefined) { diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: contextError.kind }; return }
    const sender = `${envelope.sender.kind}:${envelope.sender.id}`
    if (acceptedOperator !== undefined && sender !== acceptedOperator) { diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: 'operator-mismatch' }; return }
    if (acceptedSession !== undefined && envelope.drawSessionId !== acceptedSession) { diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: 'session-mismatch' }; return }
    if (acceptedMessageIds.has(envelope.messageId)) { diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: 'duplicate-message' }; return }
    const message = envelope.message
    const isRestore = message.restore === true
    const orderingError = isRestore ? undefined : acceptSequence(acceptedOrdering, envelope)
    if (orderingError !== undefined) {
      if (orderingError.kind === 'sequence-gap' || orderingError.kind === 'sequence-out-of-order') requestRestore()
      diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: orderingError.kind }
      return
    }
    try {
      const snapshot = parsePublicDisplaySnapshot({
        drawSessionId: message.drawSessionId,
        stage: message.stage,
        ...(message.stageStartedAt === undefined ? {} : { stageStartedAt: message.stageStartedAt }),
        blackoutRequested: message.blackoutRequested ?? false,
        ...(message.displayTest === undefined ? {} : { displayTest: message.displayTest }),
        ...(message.eventName === undefined ? {} : { eventName: message.eventName }),
        ...(message.eventSubtitle === undefined ? {} : { eventSubtitle: message.eventSubtitle }), ...(message.primaryColor === undefined ? {} : { primaryColor: message.primaryColor }), ...(message.accentColor === undefined ? {} : { accentColor: message.accentColor }), ...(message.logo === undefined ? {} : { logo: message.logo }), ...(message.background === undefined ? {} : { background: message.background }), ...(message.blackoutAppearance === undefined ? {} : { blackoutAppearance: message.blackoutAppearance }), ...(message.safeAreaMargin === undefined ? {} : { safeAreaMargin: message.safeAreaMargin }),
        ...(message.mode === undefined ? {} : { mode: message.mode }),
        ...(message.ticketNumbers === undefined ? {} : { ticketNumbers: message.ticketNumbers }),
        ...(message.winnerStatuses === undefined ? {} : { winnerStatuses: message.winnerStatuses }),
      }, acceptedSession)
      const wasConnected = connection === 'connected'
      acceptedMessageIds.add(envelope.messageId)
      acceptedOrdering = { epoch: envelope.epoch, sequence: envelope.sequence }
      acceptedOperator = sender
      acceptedSession ??= snapshot.drawSessionId
      restoreRequested = false
      connection = 'connected'
      state = { kind: 'snapshot', connection, snapshot }
      const publicState = snapshot.displayTest === true ? 'display-test' : snapshot.stage === 'standby' ? 'standby' : 'draw'
      diagnostics = { ...diagnostics, validationResult: 'accepted', rejectionReason: undefined, publicState, stateAfterReceipt: state.kind }
      if (!wasConnected) sendReady()
      sendApplied(envelope, snapshot)
      notify()
    } catch (error: unknown) {
      // Invalid, private, cross-session, or otherwise malformed snapshots never replace safe state.
      diagnostics = { ...diagnostics, validationResult: 'rejected', rejectionReason: error instanceof Error ? error.message : 'invalid-public-snapshot' }
    }
  }

  const enterDisconnected = () => {
    if (closed) return
    connection = options.transportFactory === undefined ? 'disconnected-safe' : 'reconnect-pending'
    state = { kind: 'disconnected-safe', connection }
    notify()
    if (options.transportFactory !== undefined && reconnectHandle === null) {
      reconnectHandle = schedule(() => {
        reconnectHandle = null
        if (closed) return
        currentTransport = options.transportFactory?.() ?? currentTransport
        connection = currentTransport.capability.transport === 'available' ? 'connecting' : 'unavailable'
        state = currentTransport.capability.transport === 'available' ? { kind: 'connecting' } : { kind: 'unavailable', connection: 'unavailable' }
        notify()
        attach()
        if (currentTransport.capability.transport === 'available') sendReady()
      }, options.reconnectDelayMs ?? 100)
    }
  }
  const attach = () => {
    unsubscribe()
    unsubscribeClose()
    unsubscribe = currentTransport.subscribe(onEnvelope)
    unsubscribeClose = currentTransport.onClose?.(enterDisconnected) ?? (() => undefined)
  }
  attach()
  if (currentTransport.capability.transport === 'available') sendReady()

  return {
    getState: () => state,
    getDiagnostics: () => diagnostics,
    getConnectionState: () => connection,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    close() {
      if (closed) return
      closed = true
      if (reconnectHandle !== null) { cancel(reconnectHandle); reconnectHandle = null }
      unsubscribe()
      unsubscribeClose()
      currentTransport.close()
      connection = 'disconnected-safe'
      state = { kind: 'disconnected-safe', connection }
      notify()
      listeners.clear()
    },
  }
}
