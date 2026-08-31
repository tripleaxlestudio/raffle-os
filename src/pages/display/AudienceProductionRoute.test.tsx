import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { appRoutes } from '../../app/router.tsx'
import { createAudienceController } from '../../application/display-transport/audience-controller.ts'
import { createInMemoryTransportPair } from '../../application/display-transport/transport.ts'
import { PROTOCOL_VERSION, type ProtocolEnvelope, type ProtocolScope, type PublicMessage } from '../../application/display-transport/protocol.ts'
import { AudienceDisplayPage } from './AudienceDisplayPage.tsx'
import { createFullscreenController } from '../../application/display-transport/fullscreen-controller.ts'

// A supported Fullscreen API must not bring controls back onto the public stage.
vi.mock('../../application/display-transport/fullscreen-controller.ts', () => ({
  createFullscreenController: vi.fn(() => ({
    isSupported: () => true,
    getState: () => 'windowed',
    subscribe: () => () => undefined,
    enter: vi.fn(), exit: vi.fn(), close: vi.fn(),
  })),
}))

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
  expect(Array.from(page?.children ?? []).filter((child) => !child.classList.contains('sr-only'))).toHaveLength(1)
  expectCleanAudienceOutput()
}

function expectCleanAudienceOutput() {
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Kontrol tampilan publik')).not.toBeInTheDocument()
  expect(screen.queryByText('Tampilan berjendela')).not.toBeInTheDocument()
  expect(document.querySelector('.audience-fullscreen-controls')).not.toBeInTheDocument()
  expect(createFullscreenController).not.toHaveBeenCalled()
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
    expect(screen.getByRole('heading', { name: 'Menghubungkan ke Operator' })).toBeVisible()
    expect(screen.queryByText('000123')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expectCleanAudienceOutput()
  })

  it('renders valid public snapshots without operator controls', () => {
    const [publisher, display] = createInMemoryTransportPair('production-audience-route')
    render(<AudienceDisplayPage transport={display} scope={scope} />)
    act(() => { publisher.publish(stateMessage(1, { displayTest: false })) })
    expect(screen.getByRole('heading', { name: 'Menunggu undian berikutnya' })).toBeVisible()
    expect(screen.getByText('HUT RI 81')).toBeVisible()
    expect(screen.queryByText('Raffle OS Audience')).not.toBeInTheDocument()
    expect(screen.queryByText('Audience runtime diagnostics')).not.toBeInTheDocument()
    expect(screen.queryByTestId('audience-runtime-diagnostics')).not.toBeInTheDocument()
    expectFullViewportAudienceStage()
    const standbyStage = document.querySelector('.standby-stage')
    expect(standbyStage?.querySelector('.event-brand')).toBeInTheDocument()
    expect(standbyStage?.querySelector('.event-brand')?.nextElementSibling).toHaveClass('standby-stage__message')
    expect(standbyStage?.querySelector('.standby-stage__message')).toHaveTextContent('Tampilan siap')
    expect(standbyStage?.querySelector('.standby-stage__message')).toHaveTextContent('Menunggu undian berikutnya')
    expect(standbyStage?.querySelector('.standby-stage__message')).toHaveTextContent('Undian aktif')
    const footer = standbyStage?.querySelector('.audience-prize')
    expect(footer?.parentElement).toHaveClass('standby-stage__message')
    expect(footer?.querySelector('span')).toHaveTextContent('Undian aktif')
    expect(footer?.querySelector('strong')).toHaveTextContent('Pengumuman pemenang')
    act(() => { publisher.publish(stateMessage(2, { stage: 'countdown', stageStartedAt: '2026-08-05T00:00:00.000Z', countdownValue: 2 })) })
    expect(screen.getByRole('heading', { name: 'Bersiap' })).toBeVisible()
    expect(screen.getByLabelText('Hitung mundur: 2')).toBeVisible()
    expectFullViewportAudienceStage()
    act(() => { publisher.publish(stateMessage(3, { stage: 'rolling', stageStartedAt: '2026-08-05T00:00:00.000Z', rollingSlotCount: 3, winnerCount: 3, prizeCategory: 'Door Prize', prizeName: 'Sepeda' })) })
    expect(screen.getByRole('heading', { name: 'Sepeda' })).toBeVisible()
    expect(screen.getByText('UNDIAN AKTIF')).toBeVisible()
    expect(screen.getByText('Door Prize')).toBeVisible()
    expect(screen.getByText('3 Pemenang')).toBeVisible()
    expect(screen.getByText('Putaran berlangsung')).toBeVisible()
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
    expect(screen.getByText('HASIL DIKONFIRMASI')).toBeVisible()
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
    expect(screen.getByText('10 Pemenang')).toBeVisible()
    expect(screen.getByText('Undian segera dimulai')).toBeVisible()
    expect(screen.queryByText('Undian aktif')).not.toBeInTheDocument()
    expect(screen.queryByText('Menunggu undian berikutnya')).not.toBeInTheDocument()
    expectFullViewportAudienceStage()
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
    expect(screen.getByText('VERIFIKASI BERLANGSUNG')).toBeVisible()
    expect(after.map((tile) => tile.getAttribute('data-verification-status'))).toEqual(['confirmed', 'pending', 'pending'])
    expect(after).toEqual(before)
    expect(after.map((tile) => tile.textContent?.replace('Dikonfirmasi', '').replace('Menunggu', '').trim())).toEqual(['00073', '00052', '00059'])
    controller.close()
    publisher.close()
  })

  it('keeps an accepted snapshot while blackout is requested', () => {
    const [publisher, display] = createInMemoryTransportPair('production-blackout')
    const controller = createAudienceController({ transport: display, scope })
    render(<AudienceDisplayPage controller={controller} scope={scope} />)
    act(() => { publisher.publish(stateMessage(1, { stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z', ticketNumbers: ['00042'] })) })
    act(() => { publisher.publish(stateMessage(2, { stage: 'reveal', stageStartedAt: '2026-08-05T00:00:00.000Z', ticketNumbers: ['00042'], blackoutRequested: true })) })
    expect(controller.getState()).toMatchObject({ kind: 'snapshot', snapshot: { stage: 'reveal', ticketNumbers: ['00042'], blackoutRequested: true } })
    expect(document.querySelector('[data-audience-state="blackout"]')).toBeInTheDocument()
    expect(screen.queryByText('00042')).not.toBeInTheDocument()
    expectCleanAudienceOutput()
    controller.close()
    publisher.close()
  })

  it('keeps connecting and disconnected-safe surfaces free of fullscreen UI', () => {
    const [publisher, display] = createInMemoryTransportPair('production-clean-disconnect')
    let expire: (() => void) | undefined
    const controller = createAudienceController({ transport: display, scope,
      scheduleWatchdog: (callback) => { expire = callback; return 1 },
      cancelWatchdog: () => undefined,
    })
    render(<AudienceDisplayPage controller={controller} scope={scope} />)
    expect(screen.getByRole('heading', { name: 'Menghubungkan ke Operator' })).toBeVisible()
    expectCleanAudienceOutput()
    act(() => { publisher.publish(stateMessage(1, { displayTest: false })) })
    expectFullViewportAudienceStage()
    act(() => { expire?.() })
    expect(screen.getByRole('heading', { name: 'Koneksi tampilan terputus' })).toBeVisible()
    expectCleanAudienceOutput()
    controller.close(); display.close(); publisher.close()
  })
})
