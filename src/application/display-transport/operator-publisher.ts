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
}

type OperatorPublisherOptions = {
  readonly transport: Transport
  readonly transportFactory?: () => Transport
  readonly scope: ProtocolScope
  readonly senderId: string
  readonly clock: PublisherClock
  readonly epoch?: number
  readonly expectedSession?: string
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
  let lastEnvelopeSent: OperatorPublisherDiagnostics['lastEnvelopeSent']
  let lastAcknowledgement: OperatorPublisherDiagnostics['lastAcknowledgement']
  const statuses = new Set<(status: PublisherStatus) => void>()

  const report = (status: PublisherStatus): void => {
    statuses.forEach((listener) => {
      try { listener(status) } catch { /* status reporting must not affect presentation */ }
    })
  }

  const publishSnapshot = (next: PublicDisplaySnapshot, force: boolean, restore = false): PublisherResult => {
    const serialized = serializePublicDisplaySnapshot(next)
    if (!force && serialized === serializedSnapshot) return { ok: true, snapshot: next, published: false }
    const nextSequence = sequence + 1
    const envelope = createProtocolEnvelope({
      sender: { kind: 'operator', id: options.senderId },
      scope: options.scope,
      drawSessionId: next.drawSessionId,
      epoch,
      sequence: nextSequence,
      emittedAt: options.clock.now(),
      message: { ...publicSnapshotToProtocolState(next), ...(restore ? { restore: true } : {}) },
    })
    // Publishers must expose the current snapshot before posting so a synchronous
    // in-memory/test transport can acknowledge the first state immediately.
    snapshot = next
    serializedSnapshot = serialized
    sequence = nextSequence
    const publicState = next.displayTest === true ? 'display-test' : next.stage === 'standby' ? 'standby' : 'draw'
    lastEnvelopeSent = { epoch, sequence: nextSequence, publicState }
    const result = currentTransport.publish(envelope)
    if (!result.ok) {
      snapshot = undefined
      serializedSnapshot = undefined
      sequence = nextSequence - 1
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

  const onEnvelope = (envelope: ProtocolEnvelope): void => {
    if (closed || (envelope.message.type !== 'display-ready' && envelope.message.type !== 'display-restore-request' && envelope.message.type !== 'display-snapshot-applied')) return
    if (envelope.sender.kind !== 'display' || envelope.sender.id.length === 0) return
    if (validateEnvelopeContext(envelope, options.scope) !== undefined) return
    if (options.expectedSession !== undefined && envelope.drawSessionId !== undefined && envelope.drawSessionId !== options.expectedSession) return
    if (snapshot === undefined) return
    if (envelope.message.type === 'display-snapshot-applied') {
      if (lastEnvelopeSent === undefined || envelope.message.appliedEpoch !== lastEnvelopeSent.epoch || envelope.message.appliedSequence !== lastEnvelopeSent.sequence || envelope.message.publicState !== lastEnvelopeSent.publicState) return
      lastAcknowledgement = { ...lastEnvelopeSent }
      report({ kind: 'snapshot-applied', epoch, sequence, publicState: lastEnvelopeSent.publicState })
      return
    }
    if (envelope.message.type === 'display-ready') report({ kind: 'display-ready' })
    // Ready and restore are explicit, idempotent requests for the current public snapshot.
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
      unsubscribe()
      currentTransport.close()
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
    }),
  }
}
