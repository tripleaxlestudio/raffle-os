import { describe, expect, it } from 'vitest'
import { createAudienceController } from './audience-controller.ts'
import { createOperatorPublisher } from './operator-publisher.ts'
import { createInMemoryTransportPair } from './transport.ts'
import type { ProtocolScope } from './protocol.ts'
import type { PresentationProjectionSource } from './public-projection.ts'

const scope: ProtocolScope = { eventId: '60000000-0000-4000-8000-000000000011', displayId: '60000000-0000-4000-8000-000000000012' }
const sessionA = '60000000-0000-4000-8000-000000000021' as never
const sessionB = '60000000-0000-4000-8000-000000000022' as never
const sessionC = '60000000-0000-4000-8000-000000000023' as never

function source(drawSessionId: string, ticketNumber: string): PresentationProjectionSource {
  return {
    drawSessionId: drawSessionId as never,
    stage: 'pending-handoff',
    stageStartedAt: '2026-08-10T00:00:00.000Z' as never,
    blackoutRequested: false,
    mode: 'live',
    verificationState: 'verified',
    result: { drawSessionId: drawSessionId as never, winners: [{ sequence: 1, ticketNumber, status: 'confirmed' }] },
  }
}

describe('sequential historical Audience publications', () => {
  it('delivers confirmed(A) → confirmed(B) → confirmed(C), advances sequence, and retains C for reconnect', () => {
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('sequential-history-results')
    const audience = createAudienceController({ transport: audienceTransport, scope })
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'history-sequential-publisher', heartbeatIntervalMs: 0, clock: { now: () => '2026-08-10T00:00:00.000Z' as never } })

    publisher.start(source(sessionA, '00048'))
    expect(audience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { drawSessionId: sessionA, ticketNumbers: ['00048'], verificationState: 'verified' } })
    publisher.publish(source(sessionB, '00112'))
    expect(audience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { drawSessionId: sessionB, ticketNumbers: ['00112'], verificationState: 'verified' } })
    publisher.publish(source(sessionC, '00125'))
    expect(audience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { drawSessionId: sessionC, ticketNumbers: ['00125'], verificationState: 'verified' } })

    expect(publisher.getDiagnostics().sequence).toBe(3)
    const lateAudience = createAudienceController({ transport: audienceTransport, scope })
    expect(lateAudience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { drawSessionId: sessionC, ticketNumbers: ['00125'] } })

    lateAudience.close(); audience.close(); publisher.close(); audienceTransport.close(); operatorTransport.close()
  })

  it('returns a confirmed historical result to standby and retains standby for a reconnecting Audience', () => {
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('sequential-history-standby')
    const audience = createAudienceController({ transport: audienceTransport, scope })
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'history-standby-publisher', heartbeatIntervalMs: 0, clock: { now: () => '2026-08-10T00:00:00.000Z' as never } })

    publisher.start(source(sessionA, '00048'))
    expect(audience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { stage: 'pending-handoff', ticketNumbers: ['00048'] } })
    publisher.publish({ drawSessionId: scope.eventId as never, stage: 'standby', blackoutRequested: false, displayTest: false, eventName: 'Acara Saat Ini', eventSubtitle: 'Subtitle', primaryColor: '#111111', accentColor: '#222222', blackoutAppearance: 'pure-black', safeAreaMargin: 48 })

    expect(audience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { stage: 'standby', drawSessionId: scope.eventId, eventName: 'Acara Saat Ini' } })
    const reconnectingAudience = createAudienceController({ transport: audienceTransport, scope })
    expect(reconnectingAudience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { stage: 'standby', eventName: 'Acara Saat Ini' } })

    reconnectingAudience.close(); audience.close(); publisher.close(); audienceTransport.close(); operatorTransport.close()
  })
})
