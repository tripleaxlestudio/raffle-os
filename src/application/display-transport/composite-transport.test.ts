import { describe, expect, it } from 'vitest'
import { createProtocolEnvelope, type ProtocolEnvelope } from './protocol.ts'
import { createCompositeDisplayTransport, type Transport, type TransportListener } from './transport.ts'

function adapter(): { transport: Transport; emit: (envelope: ProtocolEnvelope) => void; sent: ProtocolEnvelope[] } {
  const listeners = new Set<TransportListener>()
  const sent: ProtocolEnvelope[] = []
  return {
    sent,
    emit: (envelope) => listeners.forEach((listener) => listener(envelope)),
    transport: {
      capability: { transport: 'available', broadcastChannel: 'unavailable', fullscreen: 'unavailable' },
      publish(envelope) { sent.push(envelope); return { ok: true } },
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
      close() { listeners.clear() },
    },
  }
}

const message = createProtocolEnvelope({ sender: { kind: 'operator', id: 'operator' }, scope: { eventId: 'event', displayId: 'display' }, epoch: 1, sequence: 1, emittedAt: '2026-09-08T00:00:00.000Z', message: { type: 'display-heartbeat' } })

describe('composite display transport', () => {
  it('publishes through both adapters but delivers one inbound envelope to controllers', () => {
    const primary = adapter()
    const fallback = adapter()
    const composite = createCompositeDisplayTransport(primary.transport, fallback.transport)
    const received: ProtocolEnvelope[] = []
    composite.subscribe((envelope) => received.push(envelope))
    expect(composite.publish(message)).toEqual({ ok: true })
    expect(primary.sent).toEqual([message])
    expect(fallback.sent).toEqual([message])
    primary.emit(message)
    fallback.emit(structuredClone(message))
    expect(received).toEqual([message])
  })
})
