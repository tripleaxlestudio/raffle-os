import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AudienceDisplayPage } from '../../pages/display/AudienceDisplayPage.tsx'
import { createAudienceController } from './audience-controller.ts'
import type { Transport, TransportListener } from './transport.ts'
import { createProtocolEnvelope, type ProtocolEnvelope, type ProtocolScope } from './protocol.ts'

const scope: ProtocolScope = {
  eventId: '81000000-0000-4000-8000-000000000001',
  displayId: '81000000-0000-4000-8000-000000000002',
}

describe('Audience idle Standby stability', () => {
  it('keeps the visible snapshot, DOM, and asset URLs stable across identical restore snapshots and heartbeats', async () => {
    let listener: TransportListener = () => undefined
    const transport: Transport = {
      capability: { transport: 'available', broadcastChannel: 'available', fullscreen: 'unavailable' },
      publish: () => ({ ok: true }),
      subscribe(next) { listener = next; return () => { listener = () => undefined } },
      close: () => undefined,
    }
    const emit = (envelope: ProtocolEnvelope) => listener(envelope)
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:idle-${createObjectUrl.mock.calls.length}`)
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const firstImage = new Blob(['stable-logo'], { type: 'image/png' })
    const restoredImage = new Blob(['stable-logo'], { type: 'image/png' })
    const audience = createAudienceController({ transport, scope, schedulePresenceHeartbeat: () => 1, cancelPresenceHeartbeat: () => undefined })
    let presentationNotifications = 0
    const unsubscribeNotifications = audience.subscribe(() => { presentationNotifications += 1 })
    const view = render(<AudienceDisplayPage transport={transport} scope={scope} controller={audience} />)
    const message = (blob: Blob) => ({
      type: 'display-state' as const,
      drawSessionId: scope.eventId,
      stage: 'standby' as const,
      blackoutRequested: false,
      displayTest: false,
      eventName: 'Idle Stability',
      logo: { type: blob.type, blob },
      background: { type: blob.type, blob },
    })
    act(() => {
      emit(createProtocolEnvelope({
        sender: { kind: 'operator', id: 'idle-operator' }, scope, drawSessionId: scope.eventId as never,
        epoch: 9, sequence: 1, emittedAt: '2026-09-08T00:00:00.000Z', message: message(firstImage),
        messageId: 'idle-state-1',
      }))
    })
    const firstState = audience.getState()
    const firstPage = view.container.querySelector('.audience-display-page')
    expect(firstState.kind, JSON.stringify(audience.getDiagnostics())).toBe('snapshot')
    expect(firstPage).not.toBeNull()
    await waitFor(() => expect(view.container.querySelector('.audience-display-logo img')).not.toBeNull())
    const firstLogo = view.container.querySelector('.audience-display-logo img')
    expect(firstLogo).not.toBeNull()
    const initialObjectUrlCount = createObjectUrl.mock.calls.length
    expect(initialObjectUrlCount).toBeGreaterThan(0)
    const notificationsAfterFirstSnapshot = presentationNotifications

    act(() => {
      emit(createProtocolEnvelope({
        sender: { kind: 'operator', id: 'idle-operator' }, scope, drawSessionId: scope.eventId as never,
        epoch: 9, sequence: 1, emittedAt: '2026-09-08T00:00:01.000Z', message: { ...message(restoredImage), restore: true },
        messageId: 'idle-restore-2',
      }))
      emit(createProtocolEnvelope({
        sender: { kind: 'operator', id: 'idle-operator' }, scope,
        epoch: 9, sequence: 1, emittedAt: '2026-09-08T00:00:02.000Z', message: { type: 'display-heartbeat' },
        messageId: 'idle-heartbeat-3',
      }))
    })
    expect(audience.getState()).toBe(firstState)
    expect(view.container.querySelector('.audience-display-page')).toBe(firstPage)
    expect(view.container.querySelector('.audience-display-logo img')).toBe(firstLogo)
    expect(createObjectUrl).toHaveBeenCalledTimes(initialObjectUrlCount)
    expect(revokeObjectUrl).not.toHaveBeenCalled()
    expect(presentationNotifications).toBe(notificationsAfterFirstSnapshot)

    view.unmount()
    audience.close()
    unsubscribeNotifications()
    createObjectUrl.mockRestore()
    revokeObjectUrl.mockRestore()
  })
})
