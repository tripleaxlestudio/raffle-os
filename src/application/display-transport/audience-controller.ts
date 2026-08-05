import {
  parsePublicDisplaySnapshot,
  type PublicDisplaySnapshot,
} from './public-projection.ts'
import {
  createProtocolEnvelope,
  validateEnvelopeContext,
  type ProtocolEnvelope,
  type ProtocolScope,
} from './protocol.ts'
import type { Transport } from './transport.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'

export type AudienceControllerState =
  | { readonly kind: 'connecting' }
  | { readonly kind: 'disconnected-safe' }
  | { readonly kind: 'snapshot'; readonly snapshot: PublicDisplaySnapshot }

export type AudienceController = {
  readonly getState: () => AudienceControllerState
  readonly subscribe: (listener: () => void) => () => void
  readonly close: () => void
}

type AudienceControllerOptions = {
  readonly transport: Transport
  readonly scope: ProtocolScope
  readonly expectedSession?: DrawSessionId
  readonly sourceId?: string
  readonly now?: () => string
}

export function createAudienceController({
  transport,
  scope,
  expectedSession,
  sourceId,
  now,
}: AudienceControllerOptions): AudienceController {
  let state: AudienceControllerState =
    transport.capability.transport === 'available'
      ? { kind: 'connecting' }
      : { kind: 'disconnected-safe' }
  let acceptedSession = expectedSession
  let closed = false
  const listeners = new Set<() => void>()

  const notify = () => listeners.forEach((listener) => listener())

  const onEnvelope = (envelope: ProtocolEnvelope) => {
    if (closed || envelope.message.type !== 'display-state') return

    const contextError = validateEnvelopeContext(
      envelope,
      scope,
      acceptedSession,
    )
    if (contextError) return

    try {
      const message = envelope.message
      const snapshot = parsePublicDisplaySnapshot(
        {
          drawSessionId: message.drawSessionId,
          stage: message.stage,
          ...(message.stageStartedAt === undefined
            ? {}
            : { stageStartedAt: message.stageStartedAt }),
          blackoutRequested: message.blackoutRequested ?? false,
          ...(message.mode === undefined ? {} : { mode: message.mode }),
          ...(message.ticketNumbers === undefined
            ? {}
            : { ticketNumbers: message.ticketNumbers }),
        },
        acceptedSession,
      )
      acceptedSession ??= snapshot.drawSessionId
      state = { kind: 'snapshot', snapshot }
      notify()
    } catch {
      // Invalid public messages never replace the last accepted presentation.
    }
  }

  const unsubscribe = transport.subscribe(onEnvelope)
  if (transport.capability.transport === 'available') {
    transport.publish(createProtocolEnvelope({
      sender: { kind: 'display', id: sourceId ?? scope.displayId },
      scope,
      ...(expectedSession === undefined ? {} : { drawSessionId: expectedSession }),
      epoch: 1,
      sequence: 0,
      emittedAt: now?.() ?? new Date().toISOString(),
      message: { type: 'display-ready', capability: { broadcastChannel: transport.capability.broadcastChannel, fullscreen: transport.capability.fullscreen } },
    }))
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close() {
      if (closed) return
      closed = true
      unsubscribe()
      transport.close()
      state = { kind: 'disconnected-safe' }
      notify()
      listeners.clear()
    },
  }
}
