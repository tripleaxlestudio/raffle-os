import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import { ProductionPendingResultsPage } from './ProductionPendingResultsPage.tsx'

const mocks = vi.hoisted(() => {
  const session = {
    id: '00000000-0000-4000-8000-000000000001',
    eventId: '00000000-0000-4000-8000-000000000002',
    configurationId: '00000000-0000-4000-8000-000000000003',
    mode: 'live',
    status: 'pending-confirmation',
    configurationSnapshot: { snapshotFormatVersion: 1, configurationId: '00000000-0000-4000-8000-000000000003', prizeCategoryId: '00000000-0000-4000-8000-000000000004', categoryName: 'Grand Prize', prizeName: 'Sepeda Listrik', requestedWinners: 2, winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, capturedAt: '2026-09-05T06:00:00.000Z' },
    candidatePoolSnapshot: { snapshotFormatVersion: 1, eventId: '00000000-0000-4000-8000-000000000002', configurationId: '00000000-0000-4000-8000-000000000003', prizeCategoryId: '00000000-0000-4000-8000-000000000004', mode: 'live', capturedAt: '2026-09-05T06:00:00.000Z', winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, candidateEntries: [{ participantId: '00000000-0000-4000-8000-000000000010', ticketNumber: '00042' }, { participantId: '00000000-0000-4000-8000-000000000011', ticketNumber: '00043' }, { participantId: '00000000-0000-4000-8000-000000000012', ticketNumber: '00044' }], eligibleSnapshotCount: 3 },
    createdAt: '2026-09-05T06:00:00.000Z',
    updatedAt: '2026-09-05T06:00:00.000Z',
  } as unknown as DrawSession
  const winners = [
    { id: '00000000-0000-4000-8000-000000000020', eventId: session.eventId, prizeCategoryId: session.configurationSnapshot!.prizeCategoryId, drawSessionId: session.id, participantId: '00000000-0000-4000-8000-000000000010', ticketNumber: '00042', sequenceNumber: 1, status: 'pending', createdAt: session.createdAt, updatedAt: session.updatedAt },
    { id: '00000000-0000-4000-8000-000000000021', eventId: session.eventId, prizeCategoryId: session.configurationSnapshot!.prizeCategoryId, drawSessionId: session.id, participantId: '00000000-0000-4000-8000-000000000011', ticketNumber: '00043', sequenceNumber: 2, status: 'pending', createdAt: session.createdAt, updatedAt: session.updatedAt },
  ] as unknown as readonly WinnerRecord[]
  return { session, winners, confirmed: false, redraw: vi.fn(), signal: vi.fn(), prepare: vi.fn(), findActiveRedraw: vi.fn(), publish: vi.fn() }
})

vi.mock('../../app/workspace/ProductionWorkspaceContext.tsx', () => ({
  signalProductionWorkspaceChanged: mocks.signal,
  useIntentionalRedrawTransition: () => ({ handoff: null, prepare: mocks.prepare, clear: vi.fn() }),
  useProductionAudiencePublisher: () => ({ publisher: { publish: mocks.publish }, publish: mocks.publish, subscribe: () => () => undefined }),
}))

vi.mock('../../application/draw/draw-readiness-query.ts', () => ({
  queryDrawReadiness: vi.fn(async () => ({ state: 'session-not-ready', data: { session: mocks.session } })),
}))

vi.mock('../../infrastructure/composition/draw-command-production.ts', () => ({
  createDrawSetupProductionServices: () => ({
    open: vi.fn(async () => undefined),
    checkStorage: vi.fn(async () => ({ ok: true })),
    checkCrypto: vi.fn(async () => ({ ok: true })),
    sessions: { findById: vi.fn(async () => mocks.session) },
    events: { findById: vi.fn(async () => ({ id: mocks.session.eventId, name: 'Panggung Seni Dirgahayu 81', status: 'live' })) },
    categories: { findById: vi.fn(async () => ({ id: mocks.session.configurationSnapshot!.prizeCategoryId, eventId: mocks.session.eventId, name: 'Grand Prize', prizeName: 'Sepeda Listrik' })) },
    winners: { findByDrawSessionId: vi.fn(async () => mocks.winners.map((winner) => mocks.confirmed ? { ...winner, status: 'confirmed' as const } : winner)) },
    redraws: { findByDrawSessionId: vi.fn(async () => []) },
    redrawRequests: { findActiveByDrawSessionId: mocks.findActiveRedraw },
    displayConfigurations: { findByEventId: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000030',
      eventId: mocks.session.eventId,
      safeAreaMargin: 56,
      blackoutAppearance: 'pure-black',
      appearance: {
        logo: { visible: true, source: 'custom', customAsset: { type: 'image/png', blob: new Blob(['event-logo'], { type: 'image/png' }) }, position: 'bottom-right', size: 112 },
        theme: { preset: 'light' },
        colors: { primary: '#112233', accent: '#445566', text: '#17202A', background: '#F7F3E8' },
        textStyle: 'shadow',
        drawBox: { preset: 'brutal', fillColor: '#FFFDF7', borderVisible: true, borderColor: '#112233', borderWidth: 5, cornerStyle: 'square', shadowStyle: 'hard', textColor: '#17202A', labelVisible: true, labelFillColor: '#445566', labelTextColor: '#FFFFFF' },
        background: { type: 'color', fit: 'cover' },
      },
    })) },
    presentationCheckpoints: { findByDrawSessionId: vi.fn(async () => null) },
    pendingDecisions: {
      redraw: { redraw: mocks.redraw },
      confirmation: { confirm: vi.fn() },
      cancellation: { cancel: vi.fn() },
    },
  }),
}))

describe('Production Pending Results redraw handoff', () => {
  beforeEach(() => {
    mocks.signal.mockReset()
    mocks.prepare.mockReset()
    mocks.confirmed = false
    mocks.publish.mockReset()
    mocks.findActiveRedraw.mockReset()
    mocks.findActiveRedraw.mockResolvedValueOnce(null).mockResolvedValue({ id: 'request-1', drawSessionId: mocks.session.id, status: 'pending' })
    mocks.redraw.mockReset()
    mocks.redraw.mockResolvedValue({ status: 'committed', outcome: { status: 'committed', commandId: 'request-1', operation: 'redraw-pending-winners', drawSessionId: mocks.session.id, affectedWinnerIds: [mocks.winners[0]!.id], replacementWinnerIds: [], replacementTickets: [] } })
  })

  it('creates only a redraw request and navigates to the existing Live Draw route', async () => {
    const router = createMemoryRouter([
      { path: '/draw/pending/:drawSessionId', element: <ProductionPendingResultsPage /> },
      { path: '/draw/run/:drawSessionId', element: <h1>Live Draw Redraw Mode</h1> },
    ], { initialEntries: [`/draw/pending/${mocks.session.id}`] })
    const user = userEvent.setup()
    render(<RouterProvider router={router} />)

    const checkbox = (await screen.findAllByRole('checkbox'))[0]!
    await user.click(checkbox)
    await user.click(screen.getByRole('button', { name: 'Undi Ulang 1' }))
    await user.click(screen.getByRole('button', { name: 'Undi ulang secara resmi' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(`/draw/run/${mocks.session.id}`))
    expect(mocks.redraw).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'redraw-pending-winners',
      targets: [{ winnerId: mocks.winners[0]!.id, expectedStatus: 'pending' }],
    }))
    expect(mocks.signal).toHaveBeenCalledTimes(1)
    expect(mocks.winners).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Live Draw Redraw Mode' })).toBeInTheDocument()
  })

  it('publishes the saved DisplayConfiguration appearance with the confirmed production snapshot', async () => {
    mocks.confirmed = true
    const router = createMemoryRouter([
      { path: '/draw/pending/:drawSessionId', element: <ProductionPendingResultsPage /> },
    ], { initialEntries: [`/draw/pending/${mocks.session.id}`] })

    render(<RouterProvider router={router} />)

    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'pending-handoff',
      verificationState: 'verified',
      appearance: expect.objectContaining({
        logo: expect.objectContaining({ visible: true, source: 'custom', position: 'bottom-right', size: 112 }),
        theme: { preset: 'light' },
        colors: { primary: '#112233', accent: '#445566', text: '#17202A', background: '#F7F3E8' },
        textStyle: 'shadow',
        drawBox: expect.objectContaining({ preset: 'brutal', fillColor: '#FFFDF7', borderColor: '#112233', textColor: '#17202A' }),
        background: { type: 'color', fit: 'cover' },
      }),
      safeAreaMargin: 56,
    })))
  })
})
