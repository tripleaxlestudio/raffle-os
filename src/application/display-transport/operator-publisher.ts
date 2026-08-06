import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import {
  createProtocolEnvelope,
  validateEnvelopeContext,
  type ProtocolEnvelope,
  type ProtocolError,
  type ProtocolScope,
} from './protocol.ts'
import {
  projectPublicDisplaySnapshot,
  publicSnapshotToProtocolState,
  serializePublicDisplaySnapshot,
  type PresentationProjectionSource,
  type PublicDisplaySnapshot,
} from './public-projection.ts'
import type { Transport } from './transport.ts'
import { appendRuntimeTrace } from './runtime-trace.ts'

export type PublisherClock = { readonly now: () => IsoTimestamp }
export type PublisherStatus =
  | { readonly kind: 'ready' }
  | { readonly kind: 'waiting-for-display' }
  | { readonly kind: 'display-ready' }
  | { readonly kind: 'snapshot-applied'; readonly epoch: number; readonly sequence: number; readonly publicState: 'display-test' | 'standby' | 'draw' }
  | { readonly kind: 'transport-error'; readonly error: ProtocolError }
  | { readonly kind: 'projection-error'; readonly message: string }
  | { readonly kind: 'closed' }

export type PublisherResult =
  | { readonly ok: true; readonly snapshot: PublicDisplaySnapshot; readonly published: boolean }
  | { readonly ok: false; readonly error: ProtocolError | { readonly kind: 'projection-error'; readonly message: string } }

export type OperatorPublisher = {
  readonly start: (initial: PresentationProjectionSource) => PublisherResult
  readonly publish: (source: PresentationProjectionSource) => PublisherResult
  readonly subscribe: (listener: (status: PublisherStatus) => void) => () => void
  readonly close: () => void
  readonly getSnapshot: () => PublicDisplaySnapshot | undefined
  readonly getDiagnostics: () => OperatorPublisherDiagnostics
}

export const AUDIENCE_HEARTBEAT_INTERVAL_MS = 1000

export type PublisherRuntimeIdentity = { readonly publisherInstanceId: string; readonly epoch: number }

export function createPublisherRuntimeIdentity(): PublisherRuntimeIdentity {
  const random = new Uint32Array(1)
  globalThis.crypto.getRandomValues(random)
  return { publisherInstanceId: globalThis.crypto.randomUUID(), epoch: random[0] === 0 ? 1 : random[0] }
}

export type OperatorPublisherDiagnostics = {
  readonly channelName: string
  readonly publisherInstanceId: string
  readonly epoch: number
  readonly sequence: number
  readonly lastSnapshotType: 'display-test' | 'standby' | 'draw' | undefined
  readonly lastSnapshotTimestamp: string | undefined
  readonly retainedPublicState: 'display-test' | 'standby' | 'draw' | undefined
  readonly lastEnvelopeSent: { readonly epoch: number; readonly sequence: number; readonly publicState: 'display-test' | 'standby' | 'draw' } | undefined
  readonly expectedAcknowledgement: { readonly epoch: number; readonly sequence: number; readonly publicState: 'display-test' | 'standby' | 'draw' } | undefined
  readonly lastAcknowledgement: { readonly epoch: number; readonly sequence: number; readonly publicState: 'display-test' | 'standby' | 'draw' } | undefined
  readonly subscriberCount: number
  readonly heartbeatCount: number
  readonly lastHeartbeatTimestamp: string | undefined
  readonly heartbeatIntervalMs: number
  readonly activeHeartbeatTimerCount: number
  readonly heartbeatReceivedCount: number
  readonly helloCount: number
  readonly restoreRequestCount: number
  readonly retainedSnapshotResendCount: number
}

type OperatorPublisherOptions = {
  readonly transport: Transport
  readonly transportFactory?: () => Transport
  readonly scope: ProtocolScope
  readonly senderId: string
  readonly clock: PublisherClock
  readonly epoch?: number
  readonly expectedSession?: string
  readonly heartbeatIntervalMs?: number
  readonly scheduleHeartbeat?: (callback: () => void, delayMs: number) => unknown
  readonly cancelHeartbeat?: (handle: unknown) => void
  readonly route?: () => string
}

const projectionError = (cause: unknown): { readonly kind: 'projection-error'; readonly message: string } => ({
  kind: 'projection-error',
  message: cause instanceof Error ? cause.message : 'Public presentation projection failed safely.',
})

export function createOperatorPublisher(options: OperatorPublisherOptions): OperatorPublisher {
  let closed = false
  let started = false
  let sequence = 0
  const epoch = options.epoch ?? 1
  let snapshot: PublicDisplaySnapshot | undefined
  let serializedSnapshot: string | undefined
  let currentTransport = options.transport
  let unsubscribe: () => void = () => undefined
  let heartbeatHandle: unknown = null
  let heartbeatCount = 0
  let heartbeatReceivedCount = 0
  let helloCount = 0
  let restoreRequestCount = 0
  let retainedSnapshotResendCount = 0
  let lastHeartbeatTimestamp: string | undefined
  let restoreCount = 0
  let lastEnvelopeSent: OperatorPublisherDiagnostics['lastEnvelopeSent']
  let lastAcknowledgement: OperatorPublisherDiagnostics['lastAcknowledgement']
  const statuses = new Set<(status: PublisherStatus) => void>()
  const traceBase = { side: 'Operator' as const, publisherControllerInstanceId: options.senderId, scope: options.scope, channelName: `raffle-os-display:${options.scope.eventId}:${options.scope.displayId}`, route: options.route }
  const trace = (patch: Parameters<typeof appendRuntimeTrace>[1]) => appendRuntimeTrace(traceBase, patch)
  trace({ messageType: 'publisher-created', direction: 'local', acknowledgementStatus: 'not-applicable' })
  trace({ messageType: 'channel-opened', direction: 'local', validationResult: currentTransport.capability.transport === 'available' ? 'accepted' : 'rejected', acknowledgementStatus: 'not-applicable' })

  const report = (status: PublisherStatus): void => {
    statuses.forEach((listener) => {
      try { listener(status) } catch { /* status reporting must not affect presentation */ }
    })
  }

  const publishSnapshot = (next: PublicDisplaySnapshot, force: boolean, restore = false): PublisherResult => {
    const serialized = serializePublicDisplaySnapshot(next)
    if (!force && serialized === serializedSnapshot) return { ok: true, snapshot: next, published: false }
    const nextSequence = restore ? sequence : sequence + 1
    if (restore) restoreCount += 1
    const envelope = createProtocolEnvelope({
      sender: { kind: 'operator', id: options.senderId },
      scope: options.scope,
      drawSessionId: next.drawSessionId,
      epoch,
      sequence: nextSequence,
      emittedAt: options.clock.now(),
      message: { ...publicSnapshotToProtocolState(next), ...(restore ? { restore: true } : {}) },
      ...(restore ? { messageId: `${options.senderId}:${epoch}:restore:${restoreCount}` } : {}),
    })
    // Publishers must expose the current snapshot before posting so a synchronous
    // in-memory/test transport can acknowledge the first state immediately.
    snapshot = next
    serializedSnapshot = serialized
    sequence = nextSequence
    const publicState = next.displayTest === true ? 'display-test' : next.stage === 'standby' ? 'standby' : 'draw'
    lastEnvelopeSent = { epoch, sequence: nextSequence, publicState }
    const result = currentTransport.publish(envelope)
    trace({ epoch, sequence: nextSequence, direction: 'sent', messageType: restore ? 'restore-snapshot' : next.displayTest === true ? 'display-test' : next.stage === 'standby' ? 'standby' : 'display-state', publicState, validationResult: 'accepted', orderingResult: 'accepted', acknowledgementStatus: 'pending' })
    if (!result.ok) {
      snapshot = undefined
      serializedSnapshot = undefined
      if (!restore) sequence = nextSequence - 1
      report({ kind: 'transport-error', error: result.error })
      return { ok: false, error: result.error }
    }
    return { ok: true, snapshot: next, published: true }
  }

  const projectAndPublish = (source: PresentationProjectionSource, force: boolean): PublisherResult => {
    if (closed) return { ok: false, error: { kind: 'transport-closed' } }
    let next: PublicDisplaySnapshot
    try { next = projectPublicDisplaySnapshot(source) } catch (cause: unknown) {
      const error = projectionError(cause)
      report({ kind: 'projection-error', message: error.message })
      return { ok: false, error }
    }
    return publishSnapshot(next, force)
  }

  const sendHeartbeat = (): void => {
    if (closed || !started || currentTransport.capability.transport !== 'available') return
    heartbeatCount += 1
    lastHeartbeatTimestamp = options.clock.now()
    const result = currentTransport.publish(createProtocolEnvelope({
      sender: { kind: 'operator', id: options.senderId },
      scope: options.scope,
      epoch,
      sequence,
      emittedAt: lastHeartbeatTimestamp,
      message: { type: 'display-heartbeat' },
      messageId: `${options.senderId}:${epoch}:heartbeat:${heartbeatCount}`,
    }))
    if (result.ok) {
      trace({ epoch, sequence, direction: 'sent', messageType: 'heartbeat', validationResult: 'accepted', orderingResult: 'not-run', acknowledgementStatus: 'not-applicable' })
    }
  }

  const armHeartbeat = (): void => {
    if (heartbeatHandle !== null || options.heartbeatIntervalMs === 0) return
    const schedule = options.scheduleHeartbeat ?? ((callback, delay) => globalThis.setInterval(callback, delay))
    heartbeatHandle = schedule(sendHeartbeat, options.heartbeatIntervalMs ?? AUDIENCE_HEARTBEAT_INTERVAL_MS)
  }

  const clearHeartbeat = (): void => {
    if (heartbeatHandle === null) return
    const cancel = options.cancelHeartbeat ?? ((handle) => globalThis.clearInterval(handle as number))
    cancel(heartbeatHandle)
    heartbeatHandle = null
  }

  const onEnvelope = (envelope: ProtocolEnvelope): void => {
    const receivedState = envelope.message.type === 'display-snapshot-applied' ? envelope.message.publicState : 'unknown'
    trace({ epoch: envelope.epoch, sequence: envelope.sequence, direction: 'received', messageType: envelope.message.type, publicState: receivedState, validationResult: 'not-run', orderingResult: 'not-run', acknowledgementStatus: envelope.message.type === 'display-snapshot-applied' ? 'received' : 'not-applicable' })
    if (closed || (envelope.message.type !== 'display-ready' && envelope.message.type !== 'display-restore-request' && envelope.message.type !== 'display-snapshot-applied' && envelope.message.type !== 'display-heartbeat')) return
    if (envelope.sender.kind !== 'display' || envelope.sender.id.length === 0) return
    if (validateEnvelopeContext(envelope, options.scope) !== undefined) return
    if (options.expectedSession !== undefined && envelope.drawSessionId !== undefined && envelope.drawSessionId !== options.expectedSession) return
    if (snapshot === undefined) return
    if (envelope.message.type === 'display-heartbeat') {
      heartbeatReceivedCount += 1
      return
    }
    if (envelope.message.type === 'display-snapshot-applied') {
      if (lastEnvelopeSent === undefined || envelope.message.appliedEpoch !== lastEnvelopeSent.epoch || envelope.message.appliedSequence !== lastEnvelopeSent.sequence || envelope.message.publicState !== lastEnvelopeSent.publicState) return
      lastAcknowledgement = { ...lastEnvelopeSent }
      trace({ epoch: envelope.epoch, sequence: envelope.sequence, messageType: 'acknowledgement', direction: 'received', publicState: lastEnvelopeSent.publicState, validationResult: 'accepted', orderingResult: 'accepted', acknowledgementStatus: 'accepted' })
      report({ kind: 'snapshot-applied', epoch, sequence, publicState: lastEnvelopeSent.publicState })
      return
    }
    if (envelope.message.type === 'display-ready') { helloCount += 1; trace({ messageType: 'hello', direction: 'received', validationResult: 'accepted' }); report({ kind: 'display-ready' }) }
    if (envelope.message.type === 'display-restore-request') restoreRequestCount += 1
    // Ready and restore are explicit, idempotent requests for the current public snapshot.
    retainedSnapshotResendCount += 1
    publishSnapshot(snapshot, true, true)
  }

  const subscribeTransport = (): void => { unsubscribe = currentTransport.subscribe(onEnvelope) }

  return {
    start(initial) {
      if (closed) {
        if (options.transportFactory === undefined) return { ok: false, error: { kind: 'transport-closed' } }
        currentTransport = options.transportFactory()
        closed = false
        started = false
        sequence = 0
        snapshot = undefined
        serializedSnapshot = undefined
        subscribeTransport()
      } else if (!started) {
        subscribeTransport()
      }
      if (started) {
        if (snapshot === undefined) return { ok: false, error: { kind: 'projection-error', message: 'Publisher has no current snapshot.' } }
        return { ok: true, snapshot, published: false }
      }
      started = true
      const result = projectAndPublish(initial, true)
      if (result.ok) {
        armHeartbeat()
        report({ kind: 'ready' })
        if (currentTransport.capability.transport === 'available') report({ kind: 'waiting-for-display' })
        else report({ kind: 'transport-error', error: { kind: 'transport-unavailable', reason: 'Display transport is unavailable.' } })
      }
      return result
    },
    publish(source) {
      if (!started) {
        const initial = projectAndPublish(source, true)
        started = true
        return initial
      }
      return projectAndPublish(source, false)
    },
    subscribe(listener) { statuses.add(listener); return () => statuses.delete(listener) },
    close() {
      if (closed) return
      closed = true
      clearHeartbeat()
      unsubscribe()
      currentTransport.close()
      trace({ messageType: 'publisher-disposed', direction: 'local', cleanupDisposeReason: 'close-called' })
      trace({ messageType: 'channel-closed', direction: 'local', cleanupDisposeReason: 'close-called' })
      snapshot = undefined
      report({ kind: 'closed' })
      statuses.clear()
    },
    getSnapshot: () => snapshot,
    getDiagnostics: () => ({
      channelName: `raffle-os-display:${options.scope.eventId}:${options.scope.displayId}`,
      publisherInstanceId: options.senderId,
      epoch,
      sequence,
      lastSnapshotType: snapshot === undefined ? undefined : snapshot.displayTest === true ? 'display-test' : snapshot.stage === 'standby' ? 'standby' : 'draw',
      lastSnapshotTimestamp: snapshot?.stageStartedAt,
      retainedPublicState: snapshot === undefined ? undefined : snapshot.displayTest === true ? 'display-test' : snapshot.stage === 'standby' ? 'standby' : 'draw',
      lastEnvelopeSent,
      expectedAcknowledgement: lastEnvelopeSent,
      lastAcknowledgement,
      subscriberCount: statuses.size,
      heartbeatCount,
      lastHeartbeatTimestamp,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? AUDIENCE_HEARTBEAT_INTERVAL_MS,
      activeHeartbeatTimerCount: heartbeatHandle === null ? 0 : 1,
      heartbeatReceivedCount,
      helloCount,
      restoreRequestCount,
      retainedSnapshotResendCount,
    }),
  }
}
