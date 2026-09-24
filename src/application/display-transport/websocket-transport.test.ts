import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProtocolEnvelope } from './protocol.ts'
import { createWebSocketDisplayTransport } from './websocket-transport.ts'

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static readonly instances: FakeWebSocket[] = []
  readyState = FakeWebSocket.CONNECTING
  readonly sent: string[] = []
  readonly url: string
  constructor(url: string) { super(); this.url = url; FakeWebSocket.instances.push(this) }
  open(): void { this.readyState = FakeWebSocket.OPEN; this.dispatchEvent(new Event('open')) }
  send(value: string): void { this.sent.push(value) }
  close(): void { this.readyState = FakeWebSocket.CLOSED; this.dispatchEvent(new Event('close')) }
  fail(): void { this.readyState = FakeWebSocket.CLOSED; this.dispatchEvent(new Event('close')) }
}

afterEach(() => {
  FakeWebSocket.instances.splice(0)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('WebSocket display transport', () => {
  it('queues while connecting and reconnects after a socket drop', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const transport = createWebSocketDisplayTransport({ role: 'operator', scope: { eventId: 'event', displayId: 'display' }, endpoint: 'ws://127.0.0.1/ws/display', reconnectDelayMs: 25 })
    expect(FakeWebSocket.instances).toHaveLength(0)
    const statuses: string[] = []
    transport.subscribeStatus?.((status) => statuses.push(status.connection))
    const envelope = createProtocolEnvelope({ sender: { kind: 'operator', id: 'operator' }, scope: { eventId: 'event', displayId: 'display' }, epoch: 1, sequence: 0, emittedAt: '2026-09-08T00:00:00.000Z', message: { type: 'display-heartbeat' } })
    expect(transport.publish(envelope)).toEqual({ ok: true })
    await vi.runAllTicks()
    expect(FakeWebSocket.instances[0]?.sent).toHaveLength(0)
    FakeWebSocket.instances[0]?.open()
    await vi.waitFor(() => expect(FakeWebSocket.instances[0]?.sent).toHaveLength(1))
    FakeWebSocket.instances[0]?.fail()
    await vi.advanceTimersByTimeAsync(25)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(statuses).toContain('reconnecting')
    FakeWebSocket.instances[1]?.open()
    expect(transport.getStatus?.()).toMatchObject({ connection: 'connected', authoritative: true })
    transport.close()
  })
})
