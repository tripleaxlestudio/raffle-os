import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAudienceController } from './audience-controller.ts'
import type { Transport } from './transport.ts'

afterEach(() => vi.useRealTimers())

function trackedTransport(close: () => void, subscribe: Transport['subscribe'] = () => () => undefined): Transport {
  return {
    capability: { transport: 'available', broadcastChannel: 'unavailable', fullscreen: 'unavailable' },
    publish: () => ({ ok: true }),
    subscribe,
    close,
  }
}

describe('Audience transport recovery', () => {
  it('does not attach transport side effects before an explicit handshake', () => {
    const subscribe = vi.fn(() => () => undefined)
    const controller = createAudienceController({
      transport: trackedTransport(() => undefined, subscribe),
      scope: { eventId: 'event', displayId: 'display' },
      autoStartHandshake: false,
    })

    expect(subscribe).not.toHaveBeenCalled()
    controller.startHandshake()
    expect(subscribe).toHaveBeenCalledTimes(1)
    controller.close()
  })

  it('closes the stale transport before connecting a replacement', async () => {
    vi.useFakeTimers()
    const firstClose = vi.fn()
    const secondClose = vi.fn()
    const controller = createAudienceController({
      transport: trackedTransport(firstClose),
      transportFactory: () => trackedTransport(secondClose),
      scope: { eventId: 'event', displayId: 'display' },
      livenessTimeoutMs: 25,
      reconnectDelayMs: 10,
      presenceHeartbeatIntervalMs: 1_000,
    })

    await vi.advanceTimersByTimeAsync(35)
    expect(firstClose).toHaveBeenCalledTimes(1)
    expect(controller.getConnectionState()).toBe('connecting')

    controller.close()
    expect(secondClose).toHaveBeenCalledTimes(1)
  })
})
