import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AudienceDisplayPage } from '../../pages/display/AudienceDisplayPage.tsx'
import { createAudienceController } from './audience-controller.ts'
import { createOperatorPublisher } from './operator-publisher.ts'
import { createInMemoryTransportPair } from './transport.ts'
import type { ProtocolScope } from './protocol.ts'

const scope: ProtocolScope = { eventId: '50000000-0000-4000-8000-000000000001', displayId: '50000000-0000-4000-8000-000000000002' }
const session = scope.eventId as never
const source = { drawSessionId: session, stage: 'standby' as const, blackoutRequested: false, displayTest: true, eventName: 'Liveness Event' }

describe('Audience liveness watchdog', () => {
  it('keeps heartbeat out of presentation ordering and acknowledgements', () => {
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('audience-heartbeat-ordering')
    const audience = createAudienceController({ transport: audienceTransport, scope })
    const view = render(<AudienceDisplayPage transport={audienceTransport} scope={scope} controller={audience} />)
    // A scheduled callback is the public heartbeat seam; invoke it through a
    // captured scheduler so this test does not depend on wall-clock timing.
    let scheduled: (() => void) | undefined
    const scheduledPublisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'operator-heartbeat-ordering-2', heartbeatIntervalMs: 100, scheduleHeartbeat: (callback) => { scheduled = callback; return 1 }, cancelHeartbeat: () => undefined, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    act(() => { scheduledPublisher.start(source); scheduled?.() })
    expect(scheduledPublisher.getDiagnostics()).toMatchObject({ sequence: 1, heartbeatCount: 1, lastAcknowledgement: { sequence: 1 } })
    expect(audience.getDiagnostics().lastSnapshotApplied).toBeDefined()
    view.unmount(); audience.close(); scheduledPublisher.close(); audienceTransport.close(); operatorTransport.close()
  })

  it('accepts a fresh publisher runtime after the previous runtime stops', () => {
    const [firstTransport, audienceTransport] = createInMemoryTransportPair('audience-publisher-refresh')
    const audience = createAudienceController({ transport: audienceTransport, scope })
    const first = createOperatorPublisher({ transport: firstTransport, scope, senderId: 'operator-old-runtime', epoch: 1, heartbeatIntervalMs: 0, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    first.start(source)
    first.close()
    const [secondTransport] = createInMemoryTransportPair('audience-publisher-refresh')
    const second = createOperatorPublisher({ transport: secondTransport, scope, senderId: 'operator-new-runtime', epoch: 1, heartbeatIntervalMs: 0, clock: { now: () => '2026-08-06T00:00:01.000Z' as never } })
    second.start({ ...source, displayTest: false })
    expect(audience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { displayTest: false } })
    expect(audience.getDiagnostics().acceptedPublisherInstanceId).toBe('operator-new-runtime')
    audience.close(); second.close(); firstTransport.close(); secondTransport.close(); audienceTransport.close()
  })

  it('keeps DISPLAY TEST and standby rendered while the real publisher heartbeat continues', () => {
    vi.useFakeTimers()
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('audience-liveness-healthy')
    let heartbeat: (() => void) | undefined
    const publisher = createOperatorPublisher({
      transport: operatorTransport,
      scope,
      senderId: 'operator-liveness',
      heartbeatIntervalMs: 100,
      scheduleHeartbeat: (callback) => { heartbeat = callback; return 1 },
      cancelHeartbeat: () => undefined,
      clock: { now: () => new Date().toISOString() as never },
    })
    const view = render(<AudienceDisplayPage transport={audienceTransport} scope={scope} />)
    act(() => { publisher.start(source) })
    expect(screen.getByText(/DISPLAY TEST/)).toBeVisible()
    act(() => { heartbeat?.() })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(screen.getByText(/DISPLAY TEST/)).toBeVisible()

    act(() => { publisher.publish({ ...source, displayTest: false }) })
    expect(screen.getByText('Display ready')).toBeVisible()
    expect(screen.getByText('Waiting for the next presentation')).toBeVisible()
    act(() => { heartbeat?.() })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(screen.getByText('Display ready')).toBeVisible()
    expect(screen.queryByText('Display connection interrupted')).not.toBeInTheDocument()

    view.unmount(); publisher.close(); audienceTransport.close(); operatorTransport.close()
    vi.useRealTimers()
  })

  it('keeps the public presentation stable for a 60-second heartbeat interval', () => {
    vi.useFakeTimers()
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('audience-liveness-sixty-seconds')
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'operator-sixty-seconds', heartbeatIntervalMs: 1000, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    const view = render(<AudienceDisplayPage transport={audienceTransport} scope={scope} />)
    act(() => { publisher.start(source); vi.advanceTimersByTime(60_000) })
    expect(screen.getByText(/DISPLAY TEST/)).toBeVisible()
    expect(publisher.getDiagnostics()).toMatchObject({ epoch: 1, sequence: 1, heartbeatCount: 60 })
    view.unmount(); publisher.close(); audienceTransport.close(); operatorTransport.close()
    vi.useRealTimers()
  })

  it('shows interrupted only after publisher activity expires, then restores the retained snapshot', () => {
    vi.useFakeTimers()
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('audience-liveness-expiry')
    let heartbeat: (() => void) | undefined
    const publisher = createOperatorPublisher({
      transport: operatorTransport,
      scope,
      senderId: 'operator-expiry',
      heartbeatIntervalMs: 100,
      scheduleHeartbeat: (callback) => { heartbeat = callback; return 1 },
      cancelHeartbeat: () => undefined,
      clock: { now: () => new Date().toISOString() as never },
    })
    const view = render(<AudienceDisplayPage transport={audienceTransport} scope={scope} />)
    act(() => { publisher.start(source) })
    act(() => { vi.advanceTimersByTime(5001) })
    expect(screen.getByRole('heading', { name: 'Display connection interrupted' })).toBeVisible()

    act(() => { heartbeat?.() })
    expect(screen.getByText(/DISPLAY TEST/)).toBeVisible()
    expect(screen.queryByText('Display connection interrupted')).not.toBeInTheDocument()

    view.unmount(); publisher.close(); audienceTransport.close(); operatorTransport.close()
    vi.useRealTimers()
  })

  it('ignores a stale watchdog callback after a newer snapshot re-arms liveness', () => {
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('audience-liveness-stale')
    const watchdogs: Array<() => void> = []
    const controller = createAudienceController({
      transport: audienceTransport,
      scope,
      scheduleWatchdog: (callback) => { watchdogs.push(callback); return watchdogs.length },
      cancelWatchdog: () => undefined,
    })
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'operator-stale', heartbeatIntervalMs: 0, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    publisher.start(source)
    expect(watchdogs.length).toBeGreaterThanOrEqual(2)
    watchdogs[0]?.()
    expect(controller.getState()).toMatchObject({ kind: 'snapshot', snapshot: { displayTest: true } })
    controller.close(); publisher.close(); audienceTransport.close(); operatorTransport.close()
  })
})
