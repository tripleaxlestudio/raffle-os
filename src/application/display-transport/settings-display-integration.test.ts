import { describe, expect, it } from 'vitest'
import { createAudienceController } from './audience-controller.ts'
import { createOperatorPublisher } from './operator-publisher.ts'
import { createInMemoryTransportPair } from './transport.ts'
import type { ProtocolScope } from './protocol.ts'

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
    publisher.close(); audience.close()
  })
})
