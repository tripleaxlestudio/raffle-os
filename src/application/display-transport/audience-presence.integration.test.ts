import { describe, expect, it } from 'vitest'
import { createAudienceController } from './audience-controller.ts'
import { createOperatorPublisher } from './operator-publisher.ts'
import { createInMemoryTransportPair } from './transport.ts'
import type { ProtocolScope } from './protocol.ts'

const scope: ProtocolScope = { eventId: '70000000-0000-4000-8000-000000000001', displayId: '70000000-0000-4000-8000-000000000002' }
const session = scope.eventId as never
const source = (displayTest: boolean) => ({ drawSessionId: session, stage: 'standby' as const, blackoutRequested: false, displayTest, eventName: 'Presence Event' })

describe('Phase 8 Audience presence liveness', () => {
  it('expires the last Audience without discarding retained display-test and restores it on reopen', () => {
    let nowMs = Date.parse('2026-08-06T00:00:00.000Z')
    let expire: (() => void) | undefined
    let presence: (() => void) | undefined
    const [operatorTransport, firstAudienceTransport] = createInMemoryTransportPair('phase8-presence-reopen')
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'presence-operator', expectedSession: session, heartbeatIntervalMs: 0, audienceLivenessTimeoutMs: 5000, scheduleAudienceLiveness: (callback) => { expire = callback; return 1 }, cancelAudienceLiveness: () => undefined, clock: { now: () => new Date(nowMs).toISOString() as never } })
    publisher.start(source(true))
    const first = createAudienceController({ transport: firstAudienceTransport, scope, now: () => new Date(nowMs).toISOString(), schedulePresenceHeartbeat: (callback) => { presence = callback; return 1 }, cancelPresenceHeartbeat: () => undefined })
    expect(publisher.getDiagnostics()).toMatchObject({ activeAudienceSubscriberCount: 1, retainedPublicState: 'display-test', sequence: 1 })
    presence?.()
    nowMs += 4000
    expire?.()
    expect(publisher.getDiagnostics()).toMatchObject({ activeAudienceSubscriberCount: 1 })
    nowMs += 2000
    expire?.()
    expect(publisher.getDiagnostics()).toMatchObject({ activeAudienceSubscriberCount: 0, mostRecentSubscriberExpiryReason: 'presence-timeout', retainedPublicState: 'display-test', sequence: 1 })

    first.close()
    const [, reopenedTransport] = createInMemoryTransportPair('phase8-presence-reopen')
    const reopened = createAudienceController({ transport: reopenedTransport, scope, now: () => new Date(nowMs).toISOString(), schedulePresenceHeartbeat: () => 1, cancelPresenceHeartbeat: () => undefined })
    expect(reopened.getState()).toMatchObject({ kind: 'snapshot', snapshot: { displayTest: true } })
    const reopenedDiagnostics = reopened.getDiagnostics()
    reopened.commitRenderedState({ epoch: reopenedDiagnostics.acceptedEpoch ?? 0, sequence: reopenedDiagnostics.acceptedSequence ?? 0, publicState: 'display-test', selectedRenderedState: 'display-test' })
    expect(publisher.getDiagnostics()).toMatchObject({ activeAudienceSubscriberCount: 1, retainedPublicState: 'display-test', sequence: 1 })
    expect(publisher.getDiagnostics().lastAcknowledgement?.sequence).toBe(1)
    reopened.close(); publisher.close(); firstAudienceTransport.close(); reopenedTransport.close(); operatorTransport.close()
  })

  it('keeps one connection alive while another subscriber closes, then waits after the last closes', () => {
    let expire: (() => void) | undefined
    const [operatorTransport, firstTransport] = createInMemoryTransportPair('phase8-presence-two')
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'presence-two-operator', expectedSession: session, heartbeatIntervalMs: 0, scheduleAudienceLiveness: (callback) => { expire = callback; return 1 }, cancelAudienceLiveness: () => undefined, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    publisher.start(source(false))
    const first = createAudienceController({ transport: firstTransport, scope, schedulePresenceHeartbeat: () => 1, cancelPresenceHeartbeat: () => undefined })
    const [, secondTransport] = createInMemoryTransportPair('phase8-presence-two')
    const second = createAudienceController({ transport: secondTransport, scope, schedulePresenceHeartbeat: () => 1, cancelPresenceHeartbeat: () => undefined })
    expect(publisher.getDiagnostics().activeAudienceSubscriberCount).toBe(2)
    first.close()
    expect(publisher.getDiagnostics().activeAudienceSubscriberCount).toBe(1)
    second.close()
    expect(publisher.getDiagnostics().activeAudienceSubscriberCount).toBe(0)
    expire?.()
    expect(publisher.getDiagnostics().retainedPublicState).toBe('standby')
    publisher.close(); firstTransport.close(); secondTransport.close(); operatorTransport.close()
  })
})
