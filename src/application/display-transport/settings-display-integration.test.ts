import { act, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createAudienceController } from './audience-controller.ts'
import { createOperatorPublisher } from './operator-publisher.ts'
import { createBroadcastChannelTransport, createInMemoryTransportPair } from './transport.ts'
import type { ProtocolScope } from './protocol.ts'
import { AudienceDisplayPage } from '../../pages/display/AudienceDisplayPage.tsx'

const scope: ProtocolScope = { eventId: '40000000-0000-4000-8000-000000000001', displayId: '40000000-0000-4000-8000-000000000002' }
const session = scope.eventId as never

describe('production Settings display-test integration', () => {
  it('moves the real Audience controller from connecting to display test after acknowledgement', () => {
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('settings-display-test')
    const audience = createAudienceController({ transport: audienceTransport, scope })
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'settings-test-operator', expectedSession: session, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    const statuses: string[] = []
    publisher.subscribe((status) => { statuses.push(status.kind) })
    const result = publisher.start({ drawSessionId: session, stage: 'standby', blackoutRequested: false, displayTest: true, eventName: 'Updated Event', eventSubtitle: 'Public subtitle', primaryColor: '#112233', accentColor: '#DDAA44', safeAreaMargin: 64 })
    expect(result).toMatchObject({ ok: true, snapshot: { displayTest: true, eventName: 'Updated Event', safeAreaMargin: 64 } })
    expect(audience.getState()).toMatchObject({ kind: 'snapshot', connection: 'connected', snapshot: { displayTest: true, eventName: 'Updated Event', eventSubtitle: 'Public subtitle', safeAreaMargin: 64 } })
    expect(statuses).toContain('display-ready')
    expect(statuses).toContain('snapshot-applied')
    publisher.close(); audience.close()
  })

  it('restores the same public test for late joiners, refreshes, and multiple windows', () => {
    const [operatorTransport, firstAudienceTransport] = createInMemoryTransportPair('settings-display-lifecycle')
    const [, secondAudienceTransport] = createInMemoryTransportPair('settings-display-lifecycle')
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'settings-test-operator', expectedSession: session, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })

    expect(publisher.start({ drawSessionId: session, stage: 'standby', blackoutRequested: false, displayTest: true, eventName: 'Persisted Event', eventSubtitle: 'Persisted subtitle', primaryColor: '#112233', accentColor: '#DDAA44', safeAreaMargin: 72 })).toMatchObject({ ok: true, published: true })

    const first = createAudienceController({ transport: firstAudienceTransport, scope })
    const second = createAudienceController({ transport: secondAudienceTransport, scope })
    expect(first.getState()).toMatchObject({ kind: 'snapshot', snapshot: { displayTest: true, eventName: 'Persisted Event', safeAreaMargin: 72 } })
    expect(second.getState()).toEqual(first.getState())

    render(createElement(AudienceDisplayPage, { transport: firstAudienceTransport, scope }))
    expect(screen.getByText(/DISPLAY TEST/)).toBeVisible()
    expect(screen.getByText(/NOT AN OFFICIAL DRAW/)).toBeVisible()
    expect(screen.getByText('Persisted subtitle')).toBeVisible()

    first.close()
    const refreshedTransport = createInMemoryTransportPair('settings-display-lifecycle')[1]
    const refreshed = createAudienceController({ transport: refreshedTransport, scope })
    act(() => undefined)
    expect(refreshed.getState()).toMatchObject({ kind: 'snapshot', snapshot: { displayTest: true, eventSubtitle: 'Persisted subtitle', safeAreaMargin: 72 } })

    publisher.close(); second.close(); refreshed.close(); firstAudienceTransport.close(); secondAudienceTransport.close(); refreshedTransport.close()
  })

  it('keeps one publisher alive across five realtime start/stop cycles', () => {
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('settings-display-repeated-lifecycle')
    const [, observerTransport] = createInMemoryTransportPair('settings-display-repeated-lifecycle')
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'settings-test-operator', expectedSession: session, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    const statuses: string[] = []
    const stateEnvelopes: Array<{ readonly epoch: number; readonly sequence: number; readonly displayTest: boolean }> = []
    publisher.subscribe((status) => { if (status.kind === 'snapshot-applied') statuses.push(`${status.publicState}:${status.epoch}/${status.sequence}`) })
    observerTransport.subscribe((envelope) => {
      if (envelope.sender.kind === 'operator' && envelope.message.type === 'display-state') stateEnvelopes.push({ epoch: envelope.epoch, sequence: envelope.sequence, displayTest: envelope.message.displayTest === true })
    })

    expect(publisher.start({ drawSessionId: session, stage: 'standby', blackoutRequested: false, displayTest: false, eventName: 'Cycle Event' })).toMatchObject({ ok: true, published: true })
    render(createElement(AudienceDisplayPage, { transport: audienceTransport, scope }))
    expect(screen.getByText('Draw will begin shortly')).toBeVisible()

    for (let cycle = 0; cycle < 5; cycle += 1) {
        act(() => { publisher.publish({ drawSessionId: session, stage: 'standby', blackoutRequested: false, displayTest: true, eventName: 'Cycle Event' }) })
        expect(screen.getByText(/DISPLAY TEST/)).toBeVisible()
        act(() => { publisher.publish({ drawSessionId: session, stage: 'standby', blackoutRequested: false, displayTest: false, eventName: 'Cycle Event' }) })
        expect(screen.getByText('Draw will begin shortly')).toBeVisible()
      }

    expect(stateEnvelopes.map((envelope) => envelope.sequence)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1))
    expect(stateEnvelopes.every((envelope) => envelope.epoch === 1)).toBe(true)
    expect(statuses).toHaveLength(11)
    expect(statuses.at(-1)).toBe('standby:1/12')
    expect(publisher.getDiagnostics()).toMatchObject({ epoch: 1, sequence: 12, lastAcknowledgement: { epoch: 1, sequence: 12 } })

    publisher.close(); observerTransport.close(); operatorTransport.close(); audienceTransport.close()
  })

  it('delivers the production snapshot through the BroadcastChannel adapter', () => {
    class FakeBroadcastChannel {
      static channels = new Map<string, Set<FakeBroadcastChannel>>()
      readonly listeners = new Set<(event: MessageEvent<unknown>) => void>()
      readonly peers: Set<FakeBroadcastChannel>
      readonly name: string
      constructor(name: string) { this.name = name; this.peers = FakeBroadcastChannel.channels.get(name) ?? new Set(); this.peers.add(this); FakeBroadcastChannel.channels.set(name, this.peers) }
      postMessage(value: unknown): void { this.peers.forEach((peer) => { if (peer !== this) peer.listeners.forEach((listener) => listener(new MessageEvent('message', { data: structuredClone(value) }))) }) }
      addEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void { this.listeners.add(listener) }
      removeEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void { this.listeners.delete(listener) }
      close(): void { this.peers.delete(this); this.listeners.clear() }
    }
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
    const operator = createBroadcastChannelTransport('raffle-os-display', scope)
    const audience = createBroadcastChannelTransport('raffle-os-display', scope)
    const publisher = createOperatorPublisher({ transport: operator, scope, senderId: 'native-settings-test', expectedSession: session, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    publisher.start({ drawSessionId: session, stage: 'standby', blackoutRequested: false, displayTest: true, eventName: 'Native Event', eventSubtitle: 'Native subtitle', safeAreaMargin: 48 })
    render(createElement(AudienceDisplayPage, { transport: audience, scope }))
    expect(screen.getByText(/DISPLAY TEST/)).toBeVisible()
    expect(screen.getByText('Native subtitle')).toBeVisible()
    publisher.close(); audience.close(); operator.close(); vi.unstubAllGlobals()
  })
})
