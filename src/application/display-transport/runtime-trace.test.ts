import { render } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { appendRuntimeTrace, clearRuntimeTrace, getRuntimeTrace, getRuntimeTraceLimit, serializeRuntimeTrace } from './runtime-trace.ts'
import { createAudienceController } from './audience-controller.ts'
import { createOperatorPublisher } from './operator-publisher.ts'
import { createInMemoryTransportPair } from './transport.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import { AudienceDisplayPage } from '../../pages/display/AudienceDisplayPage.tsx'

const base = { side: 'Operator' as const, publisherControllerInstanceId: 'operator:test', scope: { eventId: 'event-1', displayId: 'display-1' } }
const session = '00000000-0000-4000-8000-000000000001' as DrawSessionId

describe('runtime diagnostics trace', () => {
  beforeEach(() => clearRuntimeTrace())

  it('retains entries in append order and bounds the ring buffer', () => {
    for (let index = 0; index < getRuntimeTraceLimit() + 5; index += 1) appendRuntimeTrace(base, { messageType: `marker-${index}` })
    const trace = getRuntimeTrace()
    expect(trace).toHaveLength(getRuntimeTraceLimit())
    expect(trace[0]?.messageType).toBe('marker-5')
    expect(trace.at(-1)?.messageType).toBe(`marker-${getRuntimeTraceLimit() + 4}`)
  })

  it('contains only the explicitly safe diagnostic fields when serialized', () => {
    appendRuntimeTrace(base, { messageType: 'display-test', publicState: 'display-test', direction: 'sent', epoch: 2, sequence: 4 })
    const parsed: unknown = JSON.parse(serializeRuntimeTrace())
    expect(parsed).toEqual([expect.objectContaining({ messageType: 'display-test', publicState: 'display-test', epoch: 2, sequence: 4 })])
    expect(serializeRuntimeTrace()).not.toMatch(/participant|winner|receipt|candidate|eligibility|payload|notes/i)
  })

  it('does not allow arbitrary private fields through the trace patch type at runtime', () => {
    const entry = appendRuntimeTrace(base, { messageType: 'publisher-created', cleanupDisposeReason: 'none' })
    expect(Object.keys(entry).sort()).toEqual([
      'acknowledgementStatus', 'channelName', 'cleanupDisposeReason', 'controllerStateAfter', 'controllerStateBefore', 'currentRoute', 'direction', 'displayConfigurationId', 'epoch', 'eventId', 'messageType', 'orderingResult', 'publisherControllerInstanceId', 'publicState', 'renderedState', 'rejectionReason', 'scope', 'sequence', 'side', 'timestamp', 'validationResult',
    ].sort())
  })

  it('records publisher lifecycle and Audience validation/order/render transitions', () => {
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('trace-lifecycle')
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope: base.scope, senderId: 'operator:trace', expectedSession: session, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    publisher.start({ drawSessionId: session, stage: 'standby', blackoutRequested: false, mode: 'live', result: { drawSessionId: session, winners: [] } })
    const audience = createAudienceController({ transport: audienceTransport, scope: base.scope, expectedSession: session, sourceId: 'audience:trace' })
    const view = render(createElement(AudienceDisplayPage, { transport: audienceTransport, scope: base.scope, expectedSession: session, controller: audience }))
    const operatorEvents = getRuntimeTrace().filter((entry) => entry.side === 'Operator')
    const audienceEvents = getRuntimeTrace().filter((entry) => entry.side === 'Audience')
    expect(operatorEvents.map((entry) => entry.messageType)).toEqual(expect.arrayContaining(['publisher-created', 'channel-opened', 'display-state', 'hello', 'acknowledgement']))
    expect(audienceEvents.map((entry) => entry.messageType)).toEqual(expect.arrayContaining(['listener-created', 'channel-opened', 'hello', 'display-state', 'display-snapshot-applied', 'acknowledgement']))
    expect(audienceEvents.some((entry) => entry.validationResult === 'accepted' && entry.orderingResult === 'accepted' && entry.renderedState === 'standby')).toBe(true)
    view.unmount()
    audience.close()
    publisher.close()
    expect(getRuntimeTrace().map((entry) => entry.messageType)).toEqual(expect.arrayContaining(['listener-disposed', 'publisher-disposed', 'channel-closed']))
  })
})
