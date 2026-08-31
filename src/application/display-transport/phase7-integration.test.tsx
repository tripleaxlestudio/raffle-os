import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createAudienceController } from './audience-controller.ts'
import { createFullscreenController, type FullscreenDocument, type FullscreenTarget } from './fullscreen-controller.ts'
import { createOperatorPublisher } from './operator-publisher.ts'
import { projectPublicDisplaySnapshot, type PresentationProjectionSource } from './public-projection.ts'
import { PROTOCOL_VERSION, type ProtocolEnvelope, type ProtocolScope } from './protocol.ts'
import { createInMemoryTransportPair, type Transport } from './transport.ts'
import { AudienceDisplayPage } from '../../pages/display/AudienceDisplayPage.tsx'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'

const scope: ProtocolScope = { eventId: 'phase7-event', displayId: 'phase7-display' }
const session = '123e4567-e89b-12d3-a456-426614174000' as DrawSessionId
const timestamp = '2026-08-05T00:00:00.000Z'
const result = {
  drawSessionId: session,
  winners: [
    { sequence: 1, ticketNumber: '00042' },
    { sequence: 2, ticketNumber: '42' },
  ],
} as const

function source(stage: PresentationProjectionSource['stage'], mode: 'practice' | 'live' = 'live', blackoutRequested = false): PresentationProjectionSource {
  return {
    drawSessionId: session,
    stage,
    mode,
    blackoutRequested,
    prizeCategory: 'Door Prize',
    prizeName: 'Sepeda',
    result,
    ...(stage !== 'ready' && stage !== 'standby' ? { stageStartedAt: timestamp as never } : {}),
  }
}

function clock() {
  return { now: () => timestamp as never }
}

function directTransportSet(count = 3) {
  const links: Array<(envelope: ProtocolEnvelope) => void> = []
  const make = (): Transport => {
    let closed = false
    const listeners = new Set<(envelope: ProtocolEnvelope) => void>()
    return {
      capability: { transport: 'available', broadcastChannel: 'available', fullscreen: 'unavailable' },
      publish(envelope) {
        if (closed) return { ok: false, error: { kind: 'transport-closed' as const } }
        links.forEach((link) => link(envelope))
        return { ok: true }
      },
      subscribe(listener) {
        listeners.add(listener)
        const link = (envelope: ProtocolEnvelope) => listeners.forEach((current) => current(envelope))
        links.push(link)
        return () => {
          listeners.delete(listener)
          const index = links.indexOf(link)
          if (index >= 0) links.splice(index, 1)
        }
      },
      close() {
        closed = true
        listeners.clear()
      },
    }
  }
  return Array.from({ length: count }, make)
}

function directTransportPair() {
  return directTransportSet(2) as [Transport, Transport]
}

describe('Phase 7 integration and automated acceptance', () => {
  it('runs the authoritative Operator → public projection → protocol → Audience → DOM flow', () => {
    const [operatorTransport, displayTransport] = createInMemoryTransportPair('phase7-happy-path')
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'operator-1', expectedSession: session, epoch: 9, clock: clock() })
    const { unmount } = render(<AudienceDisplayPage transport={displayTransport} scope={scope} />)

    act(() => { expect(publisher.start(source('standby', 'live'))).toMatchObject({ ok: true, published: true }) })
    expect(screen.getByRole('heading', { name: 'Draw will begin shortly' })).toBeVisible()
    expect(screen.queryByText('Connecting to the operator')).not.toBeInTheDocument()

    act(() => { publisher.publish(source('countdown')) })
    expect(screen.getByRole('heading', { name: 'Bersiap' })).toBeVisible()
    act(() => { publisher.publish(source('rolling')) })
    expect(screen.getByText('Rolling in progress')).toBeVisible()
    expect(screen.getByText('Door Prize')).toBeVisible()
    expect(screen.getByText('Sepeda')).toBeVisible()
    act(() => { publisher.publish(source('reveal')) })
    expect(screen.getByText('00042')).toBeVisible()
    expect(screen.getByText('42')).toBeVisible()
    expect(screen.getByText('Door Prize')).toBeVisible()
    expect(screen.getByText('Sepeda')).toBeVisible()
    act(() => { publisher.publish(source('pending-handoff')) })
    expect(screen.getByText('RESULTS UNDER VERIFICATION')).toBeVisible()

    publisher.close()
    unmount()
    displayTransport.close()
  })

  it('keeps Random Number Roll through committed projection, protocol, and Audience lock', () => {
    const committedSource: PresentationProjectionSource = {
      ...source('reveal'),
      presentationConfiguration: { presentationMode: 'random-number-roll', winnerCount: 2, rollSpeedPerSecond: 12, rollStopMode: 'timed', rollDurationSeconds: 8, revealMode: 'all-together' },
      presentationSeed: session,
    }
    const [operatorTransport, displayTransport] = createInMemoryTransportPair('phase7-random-roll-lock')
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'operator-1', expectedSession: session, epoch: 4, clock: clock() })
    const { unmount } = render(<AudienceDisplayPage transport={displayTransport} scope={scope} />)

    act(() => { expect(publisher.start(committedSource)).toMatchObject({ ok: true, published: true }) })
    expect(publisher.getSnapshot()).toMatchObject({ stage: 'reveal', presentationMode: 'random-number-roll', revealStartedAt: timestamp, presentationSeed: session, ticketNumbers: ['00042', '42'] })
    expect(screen.getByTestId('winner-grid').querySelectorAll('[data-reveal-entrance="true"]')).toHaveLength(0)
    expect(screen.getByTestId('winner-grid').querySelectorAll('[data-reveal-entrance="false"]')).toHaveLength(2)

    publisher.close()
    unmount()
    displayTransport.close()
  })

  it('preserves exact ticket identity, order, immutability, and publication isolation', () => {
    const mutableTickets = [{ sequence: 1, ticketNumber: '00042' }, { sequence: 2, ticketNumber: '42' }]
    const input: PresentationProjectionSource = { ...source('reveal'), result: { drawSessionId: session, winners: mutableTickets } }
    const snapshot = projectPublicDisplaySnapshot(input)
    const original = JSON.stringify(snapshot.ticketNumbers)
    mutableTickets.reverse()
    mutableTickets[0].ticketNumber = '99999'
    expect(snapshot.ticketNumbers).toEqual(['00042', '42'])
    expect(JSON.stringify(snapshot.ticketNumbers)).toBe(original)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.ticketNumbers)).toBe(true)
  })

  it('keeps Practice and Live public modes authoritative without selecting or persisting', () => {
    const [operatorTransport, displayTransport] = createInMemoryTransportPair('phase7-modes')
    const published: ProtocolEnvelope[] = []
    const observer = createAudienceController({ transport: displayTransport, scope })
    displayTransport.subscribe((envelope) => published.push(envelope))
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'operator-1', clock: clock() })
    publisher.start(source('reveal', 'practice'))
    publisher.publish(source('reveal', 'live'))
    expect(published.filter((envelope) => envelope.sender.kind === 'operator').map((envelope) => envelope.message.type)).toEqual(['display-state', 'display-state'])
    expect(observer.getState()).toMatchObject({ snapshot: { mode: 'live', ticketNumbers: ['00042', '42'] } })
    expect(publisher.getSnapshot()).toMatchObject({ mode: 'live' })
    publisher.close()
    observer.close()
    displayTransport.close()
  })

  it('enforces privacy and route boundary for public messages and blackout DOM', () => {
    const [operatorTransport, displayTransport] = createInMemoryTransportPair('phase7-privacy')
    const sent: ProtocolEnvelope[] = []
    displayTransport.subscribe((envelope) => sent.push(envelope))
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'operator-1', clock: clock() })
    publisher.start(source('reveal'))
    const encoded = JSON.stringify(sent)
    for (const forbidden of ['Participant', 'participantId', 'winnerId', 'name', 'checkedIn', 'group', 'notes', 'candidate', 'eligibility', 'filter', 'WinnerRecord', 'checkpoint', 'mutationLock', 'confirm', 'cancel', 'redraw', 'history', 'export', 'backup']) expect(encoded).not.toContain(forbidden)

    render(<AudienceDisplayPage transport={displayTransport} scope={scope} />)
    act(() => { publisher.publish(source('reveal', 'live', true)) })
    expect(document.querySelector('[data-audience-state="blackout"]')).toBeInTheDocument()
    expect(screen.queryByText('00042')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('participant')
    publisher.close()
    displayTransport.close()
  })

  it('rejects gaps, stale epochs, invalid restores, and duplicate messages safely', () => {
    const [operator, display] = directTransportPair()
    const restoreRequests: ProtocolEnvelope[] = []
    operator.subscribe((envelope) => { if (envelope.message.type === 'display-restore-request') restoreRequests.push(envelope) })
    const audience = createAudienceController({ transport: display, scope, expectedSession: session })
    const envelope = (sequence: number, epoch = 1, overrides: Partial<ProtocolEnvelope['message']> = {}): ProtocolEnvelope => ({
      protocolVersion: PROTOCOL_VERSION,
      messageId: `operator:${epoch}:${sequence}`,
      sender: { kind: 'operator', id: 'operator-1' },
      scope,
      drawSessionId: session,
      epoch,
      sequence,
      emittedAt: timestamp,
      message: { type: 'display-state', stage: 'standby', drawSessionId: session, blackoutRequested: false, ...overrides } as ProtocolEnvelope['message'],
    })
    operator.publish(envelope(1))
    operator.publish(envelope(3, 1, { stage: 'rolling', stageStartedAt: timestamp }))
    operator.publish(envelope(1, 1, { stage: 'reveal', stageStartedAt: timestamp, ticketNumbers: ['private'] }))
    expect(audience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { stage: 'standby' } })
    expect(restoreRequests).toHaveLength(2)
    operator.publish(envelope(2, 2, { stage: 'reveal', stageStartedAt: timestamp, ticketNumbers: ['00042'] }))
    expect(audience.getState()).toMatchObject({ kind: 'snapshot', snapshot: { stage: 'reveal', ticketNumbers: ['00042'] } })
    operator.publish(envelope(2, 2, { stage: 'standby' }))
    expect(audience.getState()).toMatchObject({ snapshot: { stage: 'reveal' } })
    audience.close()
    operator.close()
    display.close()
  })

  it('gives multiple Audiences equivalent state and isolates unmount/listener failures', () => {
    const [operatorTransport, firstTransport, secondTransport] = directTransportSet(3)
    const publisher = createOperatorPublisher({ transport: operatorTransport, scope, senderId: 'operator-1', clock: clock() })
    const first = createAudienceController({ transport: firstTransport, scope })
    const second = createAudienceController({ transport: secondTransport, scope })
    first.subscribe(() => { throw new Error('one display failed') })
    publisher.start(source('reveal'))
    expect(first.getState()).toMatchObject({ snapshot: { ticketNumbers: ['00042', '42'] } })
    expect(second.getState()).toEqual(first.getState())
    first.close()
    publisher.publish(source('pending-handoff'))
    expect(second.getState()).toMatchObject({ snapshot: { stage: 'pending-handoff', ticketNumbers: ['00042', '42'] } })
    second.close()
    publisher.close()
    firstTransport.close()
    secondTransport.close()
  })

  it('uses fullscreen only on explicit action and cleans capability listeners', async () => {
    const listeners = new Set<() => void>()
    let fullscreenElement: Element | null = null
    const fullscreenDocument: FullscreenDocument = {
      fullscreenEnabled: true,
      get fullscreenElement() { return fullscreenElement },
      addEventListener: (_type, listener) => { listeners.add(listener) },
      removeEventListener: (_type, listener) => { listeners.delete(listener) },
      exitFullscreen: vi.fn(async () => { fullscreenElement = null; listeners.forEach((listener) => listener()) }),
    }
    const target = document.createElement('main') as FullscreenTarget
    target.requestFullscreen = vi.fn(async () => { fullscreenElement = target; listeners.forEach((listener) => listener()) })
    const controller = createFullscreenController({ document: fullscreenDocument, target })
    expect(target.requestFullscreen).not.toHaveBeenCalled()
    expect(controller.getState()).toBe('windowed')
    await controller.enter()
    expect(target.requestFullscreen).toHaveBeenCalledTimes(1)
    expect(controller.getState()).toBe('fullscreen')
    await controller.exit()
    expect(fullscreenDocument.exitFullscreen).toHaveBeenCalledTimes(1)
    controller.close()
    expect(listeners).toHaveLength(0)
  })
})
