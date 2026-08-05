import { describe, expect, it, vi } from 'vitest'
import { createOperatorPublisher } from './operator-publisher.ts'
import { PROTOCOL_VERSION, type ProtocolEnvelope } from './protocol.ts'
import type { Transport } from './transport.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import type { PresentationProjectionSource } from './public-projection.ts'

const session = '00000000-0000-4000-8000-000000000001' as DrawSessionId
const scope = { eventId: 'production-event', displayId: 'public-display' } as const
const result = { drawSessionId: session, winners: [{ sequence: 1, ticketNumber: '00042' }, { sequence: 2, ticketNumber: '42' }] } as const
const source = (stage: 'ready' | 'standby' | 'countdown' | 'rolling' | 'reveal' | 'pending-handoff', blackoutRequested = false): PresentationProjectionSource => ({
  drawSessionId: session,
  stage,
  ...(stage === 'ready' || stage === 'standby' ? {} : { stageStartedAt: '2026-08-05T00:00:00.000Z' as never }),
  blackoutRequested,
  mode: 'live' as const,
  result,
})

function transportHarness() {
  const messages: ProtocolEnvelope[] = []
  const listeners = new Set<(envelope: ProtocolEnvelope) => void>()
  let closed = false
  const transport: Transport = {
    capability: { transport: 'available', broadcastChannel: 'available', fullscreen: 'unavailable' },
    publish(envelope) {
      if (closed) return { ok: false, error: { kind: 'transport-closed' as const } }
      messages.push(structuredClone(envelope))
      listeners.forEach((listener) => listener(envelope))
      return { ok: true }
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    close() { closed = true; listeners.clear() },
  }
  return { transport, messages, listeners }
}

function readyEnvelope(overrides: Partial<ProtocolEnvelope> = {}): ProtocolEnvelope {
  return {
    protocolVersion: PROTOCOL_VERSION,
    messageId: 'display:display-1:1:0',
    sender: { kind: 'display', id: 'display-1' },
    scope,
    drawSessionId: session,
    epoch: 1,
    sequence: 0,
    emittedAt: '2026-08-05T00:00:00.000Z',
    message: { type: 'display-ready', capability: { broadcastChannel: 'available', fullscreen: 'unavailable' } },
    ...overrides,
  }
}

describe('operator presentation publisher', () => {
  it('publishes an initial safe standby snapshot and maps ready to standby', () => {
    const harness = transportHarness()
    const publisher = createOperatorPublisher({ transport: harness.transport, scope, senderId: 'operator-1', expectedSession: session, epoch: 7, clock: { now: () => '2026-08-05T00:00:00.000Z' as never } })
    const result = publisher.start(source('ready'))
    expect(result).toMatchObject({ ok: true, published: true, snapshot: { stage: 'standby' } })
    expect(harness.messages[0]).toMatchObject({ epoch: 7, sequence: 1, message: { type: 'display-state', stage: 'standby' } })
  })

  it.each([
    ['standby', 'countdown'], ['countdown', 'rolling'], ['rolling', 'reveal'], ['reveal', 'pending-handoff'],
  ] as const)('publishes exactly one message for %s to %s', (from, to) => {
    const harness = transportHarness()
    const publisher = createOperatorPublisher({ transport: harness.transport, scope, senderId: 'operator-1', clock: { now: () => '2026-08-05T00:00:00.000Z' as never } })
    publisher.start(source(from))
    const before = harness.messages.length
    expect(publisher.publish(source(to))).toMatchObject({ ok: true, published: true })
    expect(harness.messages).toHaveLength(before + 1)
  })

  it('deduplicates repeated public state and keeps ticket strings distinct', () => {
    const harness = transportHarness()
    const publisher = createOperatorPublisher({ transport: harness.transport, scope, senderId: 'operator-1', clock: { now: () => '2026-08-05T00:00:00.000Z' as never } })
    publisher.start(source('reveal'))
    expect(publisher.publish({ ...source('reveal'), result: { ...result, winners: [...result.winners] } })).toMatchObject({ published: false })
    expect(harness.messages.at(-1)?.message).toMatchObject({ ticketNumbers: ['00042', '42'] })
    expect(harness.messages.at(-1)?.message).not.toHaveProperty('winnerId')
  })

  it('increments sequence for blackout without changing the underlying stage', () => {
    const harness = transportHarness()
    const publisher = createOperatorPublisher({ transport: harness.transport, scope, senderId: 'operator-1', clock: { now: () => '2026-08-05T00:00:00.000Z' as never } })
    publisher.start(source('reveal'))
    publisher.publish(source('reveal', true))
    expect(harness.messages.at(-1)).toMatchObject({ epoch: 1, sequence: 2, message: { stage: 'reveal', blackoutRequested: true, ticketNumbers: ['00042', '42'] } })
  })

  it('responds to valid display-ready and rejects wrong scope/session safely', () => {
    const harness = transportHarness()
    const publisher = createOperatorPublisher({ transport: harness.transport, scope, senderId: 'operator-1', expectedSession: session, clock: { now: () => '2026-08-05T00:00:00.000Z' as never } })
    publisher.start(source('standby'))
    const before = harness.messages.length
    harness.listeners.forEach((listener) => listener(readyEnvelope()))
    expect(harness.messages).toHaveLength(before + 1)
    const afterValid = harness.messages.length
    harness.listeners.forEach((listener) => listener(readyEnvelope({ scope: { eventId: 'other', displayId: scope.displayId } })))
    harness.listeners.forEach((listener) => listener(readyEnvelope({ drawSessionId: '00000000-0000-4000-8000-000000000099' })))
    expect(harness.messages).toHaveLength(afterValid)
  })

  it('isolates projection and transport failures, and close is idempotent', () => {
    const harness = transportHarness()
    const status = vi.fn()
    const publisher = createOperatorPublisher({ transport: harness.transport, scope, senderId: 'operator-1', clock: { now: () => '2026-08-05T00:00:00.000Z' as never } })
    publisher.subscribe(status)
    expect(publisher.start({ ...source('reveal'), result: { drawSessionId: session, winners: [{ sequence: 1, ticketNumber: '' }] } })).toMatchObject({ ok: false, error: { kind: 'projection-error' } })
    publisher.close()
    publisher.close()
    expect(publisher.publish(source('standby'))).toMatchObject({ ok: false, error: { kind: 'transport-closed' } })
  })

  it('does not mutate authoritative input or retain later ticket mutations', () => {
    const harness = transportHarness()
    const winners = [{ sequence: 1, ticketNumber: '00042' }]
    const authoritative = { drawSessionId: session, stage: 'reveal' as const, stageStartedAt: '2026-08-05T00:00:00.000Z' as never, blackoutRequested: false, mode: 'practice' as const, result: { drawSessionId: session, winners } }
    const publisher = createOperatorPublisher({ transport: harness.transport, scope, senderId: 'operator-1', clock: { now: () => '2026-08-05T00:00:00.000Z' as never } })
    publisher.start(authoritative)
    winners[0].ticketNumber = '42'
    expect(harness.messages[0].message).toMatchObject({ ticketNumbers: ['00042'], mode: 'practice' })
  })
})
