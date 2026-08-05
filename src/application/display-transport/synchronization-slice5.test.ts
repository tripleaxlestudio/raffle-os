import { describe, expect, it, vi } from 'vitest'
import { createAudienceController } from './audience-controller.ts'
import { createOperatorPublisher } from './operator-publisher.ts'
import { PROTOCOL_VERSION, type ProtocolEnvelope, type ProtocolScope, type PublicMessage } from './protocol.ts'
import type { Transport } from './transport.ts'
import type { PresentationProjectionSource } from './public-projection.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'

const scope: ProtocolScope = { eventId: 'event-1', displayId: 'display-1' }
const session = '123e4567-e89b-12d3-a456-426614174000' as DrawSessionId
const result = { drawSessionId: session, winners: [{ sequence: 1, ticketNumber: '00042' }, { sequence: 2, ticketNumber: '42' }] } as const
const source = (stage: PresentationProjectionSource['stage'], blackoutRequested = false): PresentationProjectionSource => ({
  drawSessionId: session, stage, blackoutRequested, mode: 'live', result,
  ...(stage !== 'ready' && stage !== 'standby' ? { stageStartedAt: '2026-08-05T00:00:00.000Z' as never } : {}),
})

function directTransportPair() {
  const links: Array<(envelope: ProtocolEnvelope) => void> = []
  const make = (): Transport => {
    let closed = false
    const listeners = new Set<(envelope: ProtocolEnvelope) => void>()
    return {
      capability: { transport: 'available', broadcastChannel: 'available', fullscreen: 'unavailable' },
      publish(envelope) { if (closed) return { ok: false, error: { kind: 'transport-closed' as const } }; links.forEach((link) => link(envelope)); return { ok: true } },
      subscribe(listener) { listeners.add(listener); const link = (envelope: ProtocolEnvelope) => listeners.forEach((current) => current(envelope)); links.push(link); return () => { listeners.delete(listener); const index = links.indexOf(link); if (index >= 0) links.splice(index, 1) } },
      close() { closed = true; listeners.clear() },
    }
  }
  return [make(), make()] as const
}

function stateEnvelope(sequence: number, overrides: Partial<Extract<PublicMessage, { type: 'display-state' }>> = {}): ProtocolEnvelope {
  return { protocolVersion: PROTOCOL_VERSION, messageId: `operator:1:${sequence}`, sender: { kind: 'operator', id: 'operator-1' }, scope, drawSessionId: session, epoch: 1, sequence, emittedAt: '2020-01-01T00:00:00.000Z', message: { type: 'display-state', stage: 'standby', drawSessionId: session, blackoutRequested: false, ...overrides } }
}

describe('Phase 7 Slice 5 synchronization', () => {
  it('accepts contiguous updates, ignores duplicates/stale timestamps, and preserves strings', () => {
    const [publisher, display] = directTransportPair()
    const controller = createAudienceController({ transport: display, scope, now: () => '2026-08-05T00:00:00.000Z' })
    publisher.publish(stateEnvelope(1))
    publisher.publish(stateEnvelope(1, { stage: 'reveal', stageStartedAt: '2026-08-05T00:00:01.000Z', ticketNumbers: ['00042', '42'] }))
    expect(controller.getState()).toMatchObject({ kind: 'snapshot', snapshot: { stage: 'standby' } })
    publisher.publish(stateEnvelope(2, { stage: 'reveal', stageStartedAt: '2026-08-05T00:00:02.000Z', ticketNumbers: ['00042', '42'] }))
    expect(controller.getState()).toMatchObject({ kind: 'snapshot', snapshot: { stage: 'reveal', ticketNumbers: ['00042', '42'] } })
    controller.close()
  })

  it('accepts a first snapshot, rejects a gap without applying it, and requests restore once', () => {
    const [operator, display] = directTransportPair()
    const sent: ProtocolEnvelope[] = []
    const originalPublish = operator.publish.bind(operator)
    const controller = createAudienceController({ transport: display, scope })
    display.subscribe(() => undefined)
    const observing: Transport = { ...operator, publish(envelope) { sent.push(envelope); return originalPublish(envelope) } }
    const audience = createAudienceController({ transport: observing, scope })
    operator.publish(stateEnvelope(1))
    operator.publish(stateEnvelope(3, { stage: 'rolling', stageStartedAt: '2026-08-05T00:00:01.000Z' }))
    expect(audience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { stage: 'standby' } })
    expect(sent.filter((envelope) => envelope.message.type === 'display-restore-request')).toHaveLength(1)
    controller.close()
    audience.close()
  })

  it('late joining Audience receives the publisher snapshot through display-ready', () => {
    const [publisherTransport, displayTransport] = directTransportPair()
    const publisher = createOperatorPublisher({ transport: publisherTransport, scope, senderId: 'operator-1', expectedSession: session, epoch: 4, clock: { now: () => '2026-08-05T00:00:00.000Z' as never } })
    publisher.start(source('reveal'))
    const controller = createAudienceController({ transport: displayTransport, scope })
    expect(controller.getState()).toMatchObject({ kind: 'snapshot', snapshot: { stage: 'reveal', ticketNumbers: ['00042', '42'] } })
    controller.close()
    publisher.close()
  })

  it('repeated restore requests and listener failures do not mutate authority or stop peers', () => {
    const [publisherTransport, displayTransport] = directTransportPair()
    const publisher = createOperatorPublisher({ transport: publisherTransport, scope, senderId: 'operator-1', expectedSession: session, epoch: 2, clock: { now: () => '2026-08-05T00:00:00.000Z' as never } })
    publisher.start(source('reveal', true))
    const first = createAudienceController({ transport: displayTransport, scope })
    const second = createAudienceController({ transport: displayTransport, scope })
    const listener = vi.fn(() => { throw new Error('display listener failed') })
    first.subscribe(listener)
    expect(second.getState()).toMatchObject({ kind: 'snapshot', snapshot: { blackoutRequested: true, ticketNumbers: ['00042', '42'] } })
    expect(publisher.getSnapshot()).toMatchObject({ stage: 'reveal', blackoutRequested: true })
    first.close()
    expect(second.getState()).toMatchObject({ kind: 'snapshot', snapshot: { blackoutRequested: true } })
    second.close()
    publisher.close()
  })
})
