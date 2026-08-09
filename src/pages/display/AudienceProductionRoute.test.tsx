import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { appRoutes } from '../../app/router.tsx'
import { createAudienceController } from '../../application/display-transport/audience-controller.ts'
import { createInMemoryTransportPair } from '../../application/display-transport/transport.ts'
import { PROTOCOL_VERSION, type ProtocolEnvelope, type ProtocolScope, type PublicMessage } from '../../application/display-transport/protocol.ts'
import { AudienceDisplayPage } from './AudienceDisplayPage.tsx'

const scope: ProtocolScope = { eventId: 'event-1', displayId: 'display-1' }
const session = '123e4567-e89b-12d3-a456-426614174000'

function stateMessage(sequence: number, overrides: Partial<Extract<PublicMessage, { type: 'display-state' }>> = {}): ProtocolEnvelope {
  return {
    protocolVersion: PROTOCOL_VERSION,
    messageId: `message-${sequence}`,
    sender: { kind: 'operator', id: 'operator-1' },
    scope,
    drawSessionId: session,
    epoch: 1,
    sequence,
    emittedAt: '2026-08-05T00:00:00.000Z',
    message: {
      type: 'display-state',
      stage: 'standby',
      drawSessionId: session,
      blackoutRequested: false,
      ...overrides,
    },
  }
}

function renderProduction(path = '/display') {
  return render(<RouterProvider router={createMemoryRouter(appRoutes, { initialEntries: [path] })} />)
}

function expectFullViewportAudienceStage() {
  const page = document.querySelector('.audience-display-page')
  expect(page).toBeInTheDocument()
  expect(page?.querySelector('.audience-stage')).toBeInTheDocument()
  expect(page?.querySelector('.audience-stage')?.parentElement).toBe(page)
  expect(page?.querySelector('.runtime-diagnostics')).not.toBeInTheDocument()
  expect(Array.from(page?.children ?? []).filter((child) => !child.classList.contains('audience-fullscreen-controls'))).toHaveLength(1)
}

function expectCenteredDrawHeader() {
  const header = document.querySelector('.audience-draw-header')
  expect(header).toBeInTheDocument()
  expect(header?.querySelector('.event-brand')).toBeInTheDocument()
  expect(header?.querySelector('.audience-draw-header__identity')).toBeInTheDocument()
  expect(header?.querySelector('.audience-draw-header__prize')).toBeInTheDocument()
  expect(header?.querySelector('.audience-draw-header__meta')).toBeInTheDocument()
}

describe('production Audience route', () => {
  it('renders a safe production route and ignores prototype query state', () => {
    renderProduction('/display?state=reveal&stage=rolling')
    expect(screen.getByRole('heading', { name: 'Connecting to the operator' })).toBeVisible()
    expect(screen.queryByText('000123')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renders valid public snapshots without operator controls', () => {
    const [publisher, display] = createInMemoryTransportPair('production-audience-route')
    render(<AudienceDisplayPage transport={display} scope={scope} />)
    act(() => { publisher.publish(stateMessage(1, { displayTest: false })) })
    expect(screen.getByRole('heading', { name: 'Waiting for the next presentation' })).toBeVisible()
    expect(screen.getByText('HUT RI 81')).toBeVisible()
    expect(screen.queryByText('Raffle OS Audience')).not.toBeInTheDocument()
    expect(screen.queryByText('Audience runtime diagnostics')).not.toBeInTheDocument()
    expect(screen.queryByTestId('audience-runtime-diagnostics')).not.toBeInTheDocument()
    expectFullViewportAudienceStage()
    const standbyStage = document.querySelector('.standby-stage')
    expect(standbyStage?.querySelector('.event-brand')).toBeInTheDocument()
    expect(standbyStage?.querySelector('.event-brand')?.nextElementSibling).toHaveClass('standby-stage__message')
    expect(standbyStage?.querySelector('.standby-stage__message')).toHaveTextContent('Display ready')
    expect(standbyStage?.querySelector('.standby-stage__message')).toHaveTextContent('Waiting for the next presentation')
    expect(standbyStage?.querySelector('.standby-stage__message')).toHaveTextContent('Current draw')
    const footer = standbyStage?.querySelector('.audience-prize')
    expect(footer?.parentElement).toHaveClass('standby-stage__message')
    expect(footer?.querySelector('span')).toHaveTextContent('Current draw')
    expect(footer?.querySelector('strong')).toHaveTextContent('Winner announcement')
    act(() => { publisher.publish(stateMessage(2, { stage: 'countdown', stageStartedAt: '2026-08-05T00:00:00.000Z', countdownValue: 2 })) })
    expect(screen.getByRole('heading', { name: 'Get ready' })).toBeVisible()
    expect(screen.getByLabelText('Static countdown value: 2')).toBeVisible()
    expectFullViewportAudienceStage()
    act(() => { publisher.publish(stateMessage(3, { stage: 'rolling', stageStartedAt: '2026-08-05T00:00:00.000Z', rollingSlotCount: 3, winnerCount: 3, prizeCategory: 'Door Prize', prizeName: 'Sepeda' })) })
    expect(screen.getByRole('heading', { name: 'Sepeda' })).toBeVisible()
    expect(screen.getByText('CURRENT DRAW')).toBeVisible()
    expect(screen.getByText('Door Prize')).toBeVisible()
    expect(screen.getByText('3 Winners')).toBeVisible()
    expect(screen.getByText('Rolling in progress')).toBeVisible()
    expect(document.querySelectorAll('[data-ticket-tile]')).toHaveLength(3)
    expectCenteredDrawHeader()
    expectFullViewportAudienceStage()
    act(() => { publisher.publish(stateMessage(4, { stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z', ticketNumbers: ['00042', '42'] })) })
    expect(screen.getByText('00042')).toBeVisible()
    expect(screen.getByText('42')).toBeVisible()
    expectCenteredDrawHeader()
    expectFullViewportAudienceStage()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    act(() => { publisher.publish(stateMessage(5, { stage: 'pending-handoff', stageStartedAt: '2026-08-05T00:00:00.000Z', ticketNumbers: ['00042', '42'], winnerStatuses: ['confirmed', 'confirmed'] })) })
    expect(screen.getByText('RESULTS CONFIRMED')).toBeVisible()
    expect(screen.getAllByTestId('winner-grid')[0]).toHaveAttribute('data-row-composition', '2')
    expectCenteredDrawHeader()
    expectFullViewportAudienceStage()
    display.close()
    publisher.close()
  })

  it('renders an authoritative ready snapshot as the next draw without claiming current execution', () => {
    const [publisher, display] = createInMemoryTransportPair('production-ready-next-draw')
    render(<AudienceDisplayPage transport={display} scope={scope} />)
    act(() => { publisher.publish(stateMessage(1, { eventName: '24th K-Link Indonesia Anniversary', prizeCategory: 'Door Prize', prizeName: 'K-Ion Nano Premium 5', winnerCount: 10 })) })
    expect(screen.getByRole('heading', { level: 1, name: 'K-Ion Nano Premium 5' })).toBeVisible()
    expect(screen.getByText('Door Prize')).toBeVisible()
    expect(screen.getByText('10 Winners')).toBeVisible()
    expect(screen.getByText('Draw will begin shortly')).toBeVisible()
    expect(screen.queryByText('Current draw')).not.toBeInTheDocument()
    expect(screen.queryByText('Waiting for the next presentation')).not.toBeInTheDocument()
    display.close()
    publisher.close()
  })

  it('updates only the authoritative confirmed tile in place during partial verification', () => {
    const [publisher, display] = createInMemoryTransportPair('production-partial-verification')
    const controller = createAudienceController({ transport: display, scope })
    render(<AudienceDisplayPage controller={controller} scope={scope} />)
    act(() => { publisher.publish(stateMessage(1, { stage: 'pending-handoff', stageStartedAt: '2026-08-05T00:00:00.000Z', ticketNumbers: ['00073', '00052', '00059'], winnerStatuses: ['pending', 'pending', 'pending'] })) })
    const before = [...document.querySelectorAll('[data-ticket-tile]')]
    act(() => { publisher.publish(stateMessage(2, { stage: 'pending-handoff', stageStartedAt: '2026-08-05T00:00:00.000Z', ticketNumbers: ['00073', '00052', '00059'], winnerStatuses: ['confirmed', 'pending', 'pending'] })) })
    const after = [...document.querySelectorAll('[data-ticket-tile]')]
    expect(screen.getByText('VERIFICATION IN PROGRESS')).toBeVisible()
    expect(after.map((tile) => tile.getAttribute('data-verification-status'))).toEqual(['confirmed', 'pending', 'pending'])
    expect(after).toEqual(before)
    expect(after.map((tile) => tile.textContent?.replace('Confirmed', '').replace('Pending', '').trim())).toEqual(['00073', '00052', '00059'])
    controller.close()
    publisher.close()
  })

  it('keeps an accepted snapshot while blackout is requested', () => {
    const [publisher, display] = createInMemoryTransportPair('production-blackout')
    const controller = createAudienceController({ transport: display, scope })
    act(() => { publisher.publish(stateMessage(1, { stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z', ticketNumbers: ['00042'] })) })
    act(() => { publisher.publish(stateMessage(2, { stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z', ticketNumbers: ['00042'], blackoutRequested: true })) })
    expect(controller.getState()).toMatchObject({ kind: 'snapshot', snapshot: { stage: 'reveal', ticketNumbers: ['00042'], blackoutRequested: true } })
    controller.close()
    publisher.close()
  })
})
