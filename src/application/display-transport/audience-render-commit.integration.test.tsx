import { act, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { AudienceDisplayPage } from '../../pages/display/AudienceDisplayPage.tsx'
import { createAudienceController } from './audience-controller.ts'
import { createOperatorPublisher } from './operator-publisher.ts'
import { createInMemoryTransportPair } from './transport.ts'
import type { ProtocolScope } from './protocol.ts'

const scope: ProtocolScope = { eventId: '60000000-0000-4000-8000-000000000001', displayId: '60000000-0000-4000-8000-000000000002' }
const session = scope.eventId as never

function source(displayTest: boolean) {
  return { drawSessionId: session, stage: 'standby' as const, blackoutRequested: false, displayTest, eventName: 'Render Commit Event', eventSubtitle: 'Public subtitle' }
}

describe('Phase 8 Audience render-source acknowledgement boundary', () => {
  it('attaches the receive listener before handshake and stops restore retry after application', () => {
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('phase8-listener-order')
    const retryCallbacks: Array<() => void> = []
    const audience = createAudienceController({ transport: audienceTransport, scope, scheduleRestoreRetry: (callback) => { retryCallbacks.push(callback); return retryCallbacks.length }, cancelRestoreRetry: () => undefined })
    expect(audience.getDiagnostics()).toMatchObject({ listenerAttached: true, channelOpen: true, helloCount: 1, restoreRequestCount: 1 })
    retryCallbacks[0]?.()
    expect(audience.getDiagnostics().restoreRequestCount).toBe(2)
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'phase8-listener-order-operator', expectedSession: session, heartbeatIntervalMs: 0, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    publisher.start(source(false))
    expect(audience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { displayTest: false } })
    const restoreCountAfterApplication = audience.getDiagnostics().restoreRequestCount
    retryCallbacks.at(-1)?.()
    expect(audience.getDiagnostics().restoreRequestCount).toBe(restoreCountAfterApplication)
    expect(audience.getDiagnostics().firstSnapshotApplied).toMatchObject({ publicState: 'standby', sequence: 1 })
    audience.close(); publisher.close(); audienceTransport.close(); operatorTransport.close()
  })

  it('restores retained standby for a late Audience without a sequence or heartbeat storm', () => {
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('phase8-late-join-restore')
    const operatorEnvelopes: Array<{ readonly epoch: number; readonly sequence: number; readonly type: string; readonly restore?: boolean }> = []
    const audienceMessages: string[] = []
    operatorTransport.subscribe((envelope) => { if (envelope.sender.kind === 'display') audienceMessages.push(envelope.message.type) })
    audienceTransport.subscribe((envelope) => {
      if (envelope.sender.kind === 'operator') operatorEnvelopes.push({ epoch: envelope.epoch, sequence: envelope.sequence, type: envelope.message.type, restore: envelope.message.type === 'display-state' ? envelope.message.restore : undefined })
    })
    let heartbeat: (() => void) | undefined
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'phase8-late-join-operator', expectedSession: session, epoch: 3671760148, heartbeatIntervalMs: 1000, scheduleHeartbeat: (callback) => { heartbeat = callback; return 1 }, cancelHeartbeat: () => undefined, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    const statuses: string[] = []
    publisher.subscribe((status) => { if (status.kind === 'snapshot-applied') statuses.push(`${status.publicState}:${status.epoch}/${status.sequence}`) })
    act(() => { publisher.start(source(false)) })
    expect(publisher.getDiagnostics()).toMatchObject({ sequence: 1, retainedPublicState: 'standby', activeHeartbeatTimerCount: 1, heartbeatIntervalMs: 1000 })

    render(<StrictMode><AudienceDisplayPage transport={audienceTransport} scope={scope} /></StrictMode>)
    expect(screen.getByText('Display ready')).toBeVisible()
    expect(screen.getByText('Waiting for the next presentation')).toBeVisible()
    expect(screen.queryByText('Display connection interrupted')).not.toBeInTheDocument()
    expect(statuses.at(-1)).toBe('standby:3671760148/1')
    expect(audienceMessages.filter((type) => type === 'display-ready')).toHaveLength(1)
    expect(audienceMessages.filter((type) => type === 'display-restore-request')).toHaveLength(1)
    const stateEnvelopes = operatorEnvelopes.filter((envelope) => envelope.type === 'display-state')
    expect(stateEnvelopes.map((envelope) => envelope.sequence)).toEqual([1, 1, 1])
    expect(stateEnvelopes.slice(1).every((envelope) => envelope.epoch === 3671760148 && envelope.restore === true)).toBe(true)

    act(() => { heartbeat?.(); heartbeat?.() })
    expect(publisher.getDiagnostics()).toMatchObject({ sequence: 1, heartbeatCount: 2, heartbeatReceivedCount: 0, activeHeartbeatTimerCount: 1 })
    expect(operatorEnvelopes.filter((envelope) => envelope.type === 'display-heartbeat')).toHaveLength(2)
    expect(publisher.getDiagnostics().lastAcknowledgement).toMatchObject({ epoch: 3671760148, sequence: 1, publicState: 'standby' })

    publisher.close(); audienceTransport.close(); operatorTransport.close()
  })

  it('acknowledges standby and display-test only after the real route selects each presentation', async () => {
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('phase8-render-ack')
    const audience = createAudienceController({ transport: audienceTransport, scope })
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'phase8-operator', expectedSession: session, heartbeatIntervalMs: 0, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    const acknowledgementRenderStates: string[] = []
    publisher.subscribe((status) => { if (status.kind === 'snapshot-applied') acknowledgementRenderStates.push(document.body.textContent?.includes('DISPLAY TEST') === true ? 'display-test' : 'standby') })
    render(<AudienceDisplayPage transport={audienceTransport} scope={scope} controller={audience} />)

    act(() => { publisher.start(source(false)) })
    await waitFor(() => expect(screen.getByText('Display ready')).toBeVisible())
    expect(screen.getByText('Waiting for the next presentation')).toBeVisible()
    expect(acknowledgementRenderStates).toEqual(['standby'])

    act(() => { publisher.publish(source(true)) })
    expect(screen.getByText(/DISPLAY TEST/)).toBeVisible()
    expect(screen.getByText(/NOT AN OFFICIAL DRAW/)).toBeVisible()
    expect(acknowledgementRenderStates).toEqual(['standby', 'display-test'])
    expect(publisher.getDiagnostics().lastAcknowledgement?.publicState).toBe('display-test')

    publisher.close(); audience.close(); audienceTransport.close(); operatorTransport.close()
  })

  it('suppresses a contradictory render commit and records the invariant failure', () => {
    const [operatorTransport, audienceTransport] = createInMemoryTransportPair('phase8-render-mismatch')
    const audience = createAudienceController({ transport: audienceTransport, scope })
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'phase8-mismatch-operator', expectedSession: session, heartbeatIntervalMs: 0, clock: { now: () => '2026-08-06T00:00:00.000Z' as never } })
    const statuses: string[] = []
    publisher.subscribe((status) => { if (status.kind === 'snapshot-applied') statuses.push(status.publicState) })
    act(() => { publisher.start(source(true)) })
    const diagnostics = audience.getDiagnostics()
    audience.commitRenderedState({ epoch: diagnostics.acceptedEpoch ?? 0, sequence: diagnostics.acceptedSequence ?? 0, publicState: 'display-test', selectedRenderedState: 'disconnected-safe' })
    expect(statuses).toEqual([])
    expect(audience.getDiagnostics()).toMatchObject({ invariantFailure: 'rendered-state-mismatch:disconnected-safe!=display-test', acknowledgementPending: { publicState: 'display-test' } })
    expect(publisher.getDiagnostics().lastAcknowledgement).toBeUndefined()

    audience.close(); publisher.close(); audienceTransport.close(); operatorTransport.close()
  })
})
