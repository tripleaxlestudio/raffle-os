import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrawReadinessResult } from '../../application/draw/draw-readiness.types.ts'
import type { RedrawRequest } from '../../domain/winners/redraw-request.types.ts'
import { DrawRunPage } from './DrawRunPage.tsx'

const mocks = vi.hoisted(() => {
  const sessionId = '00000000-0000-4000-8000-000000000001'
  const request = {
    id: '00000000-0000-4000-8000-000000000090',
    eventId: '00000000-0000-4000-8000-000000000002',
    drawSessionId: sessionId,
    status: 'pending',
    reason: 'absent',
    targets: [
      { winnerId: '00000000-0000-4000-8000-000000000020', originalStatus: 'pending', originalSequenceNumber: 1 },
      { winnerId: '00000000-0000-4000-8000-000000000021', originalStatus: 'pending', originalSequenceNumber: 2 },
    ],
    replacementCount: 2,
    createdAt: '2026-09-05T06:00:00.000Z',
    updatedAt: '2026-09-05T06:00:00.000Z',
  } as unknown as RedrawRequest
  const running = {
    ...request,
    status: 'running',
    startedAt: '2026-09-05T06:01:00.000Z',
    updatedAt: '2026-09-05T06:01:00.000Z',
    selections: [
      { winnerRecordId: '00000000-0000-4000-8000-000000000030', participantId: '00000000-0000-4000-8000-000000000040', ticketNumber: '00044', selectionOrder: 1 },
      { winnerRecordId: '00000000-0000-4000-8000-000000000031', participantId: '00000000-0000-4000-8000-000000000041', ticketNumber: '00045', selectionOrder: 2 },
    ],
  } as unknown as RedrawRequest
  return { request, running, activeRequest: request as RedrawRequest | null, handoff: null as import('../../app/workspace/ProductionWorkspaceContext.tsx').IntentionalRedrawHandoff | null, start: vi.fn(), complete: vi.fn(), publish: vi.fn(), clear: vi.fn() }
})

vi.mock('../../application/draw/draw-readiness-query.ts', () => ({
  queryDrawReadiness: vi.fn(async (): Promise<DrawReadinessResult> => ({
    state: 'session-not-ready', retryable: false, reason: 'pending confirmation', errorCode: 'session-not-ready',
    data: {
      event: { id: mocks.request.eventId, name: 'Panggung Seni', status: 'live' },
      category: { id: '00000000-0000-4000-8000-000000000004', eventId: mocks.request.eventId, name: 'Grand Prize', prizeName: 'Sepeda Listrik' },
      configuration: { id: '00000000-0000-4000-8000-000000000003', eventId: mocks.request.eventId, prizeCategoryId: '00000000-0000-4000-8000-000000000004', requestedWinners: 5, winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, presentation: { presentationMode: 'random-number-roll', rollStopMode: 'manual', rollDurationSeconds: 8, rollSpeedPerSecond: 12, revealMode: 'all-together' } },
      session: { id: mocks.request.drawSessionId, eventId: mocks.request.eventId, configurationId: '00000000-0000-4000-8000-000000000003', mode: 'live', status: 'pending-confirmation', configurationSnapshot: { snapshotFormatVersion: 1, configurationId: '00000000-0000-4000-8000-000000000003', prizeCategoryId: '00000000-0000-4000-8000-000000000004', categoryName: 'Grand Prize', prizeName: 'Sepeda Listrik', requestedWinners: 5, winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, capturedAt: '2026-09-05T06:00:00.000Z', presentation: { presentationMode: 'random-number-roll', rollStopMode: 'manual', rollDurationSeconds: 8, rollSpeedPerSecond: 12, revealMode: 'all-together' } }, candidatePoolSnapshot: { snapshotFormatVersion: 1, eventId: mocks.request.eventId, configurationId: '00000000-0000-4000-8000-000000000003', prizeCategoryId: '00000000-0000-4000-8000-000000000004', mode: 'live', capturedAt: '2026-09-05T06:00:00.000Z', winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, candidateEntries: [], eligibleSnapshotCount: 216 }, createdAt: '2026-09-05T06:00:00.000Z', updatedAt: '2026-09-05T06:00:00.000Z' },
      authoritativeEligibleCount: 216, totalParticipantCount: 221, checkedInParticipantCount: 221, previousWinnerExcludedCount: 0, requestedWinnerCount: 5, mode: 'live',
    },
  } as unknown as DrawReadinessResult)),
}))

vi.mock('../../app/workspace/ProductionWorkspaceContext.tsx', () => ({
  signalProductionWorkspaceChanged: vi.fn(),
  useIntentionalRedrawTransition: () => ({ handoff: mocks.handoff, prepare: vi.fn(), clear: mocks.clear }),
  useProductionWorkspace: () => ({ status: 'ready', event: { id: mocks.request.eventId, name: 'Panggung Seni' }, eventSettings: { displayName: 'Panggung Seni', subtitle: '', primaryColor: '#000000', accentColor: '#ffffff', presentation: { countdownDurationSeconds: 3, rollingDurationSeconds: 8 } }, displayConfiguration: { id: '00000000-0000-4000-8000-000000000050', blackoutAppearance: 'pure-black', safeAreaMargin: 5 } }),
  useProductionAudiencePublisher: () => ({ status: { kind: 'ready' }, publisher: { publish: mocks.publish }, publish: mocks.publish, subscribe: () => () => undefined, subscribeSnapshot: () => () => undefined, getSnapshot: () => undefined, getDiagnostics: () => ({}) }),
}))

vi.mock('../../infrastructure/composition/draw-command-production.ts', () => ({
  createDrawSetupProductionServices: () => ({
    open: vi.fn(async () => undefined), checkStorage: vi.fn(async () => ({ ok: true })), checkCrypto: vi.fn(async () => ({ ok: true })),
    redrawRequests: { findActiveByDrawSessionId: vi.fn(async () => mocks.activeRequest) },
    winners: { findByDrawSessionId: vi.fn(async () => [{ id: mocks.request.targets[0]!.winnerId, drawSessionId: mocks.request.drawSessionId, ticketNumber: '00042', status: 'cancelled' }, { id: mocks.request.targets[1]!.winnerId, drawSessionId: mocks.request.drawSessionId, ticketNumber: '00043', status: 'cancelled' }]) },
    displayConfigurations: { findByEventId: vi.fn(async () => ({ id: '00000000-0000-4000-8000-000000000050' })) },
    presentationCheckpoints: { findByDrawSessionId: vi.fn(async () => null), upsert: vi.fn(async () => undefined) },
    pendingDecisions: { redraw: { start: mocks.start, complete: mocks.complete } },
  }),
}))

vi.mock('../../ui/operator/draw/ProductionDrawPresentation.tsx', () => ({
  ProductionDrawRunHeader: ({ stage }: { readonly stage: string }) => <h1>{stage}</h1>,
  PresentationSupport: () => <aside>Pratinjau Audiens</aside>,
  ProductionDrawPresentation: ({ result, redrawContext }: { readonly result: { readonly winners: readonly { readonly ticketNumber: string }[] }; readonly redrawContext?: { readonly replacementCount: number } }) => <section><h1>Presentasi Undi Ulang</h1><p>{redrawContext?.replacementCount} pengganti</p><output>{result.winners.map((winner) => winner.ticketNumber).join(',')}</output></section>,
}))

describe('Draw Run redraw mode', () => {
  beforeEach(() => {
    mocks.activeRequest = mocks.request
    mocks.handoff = null
    mocks.start.mockReset()
    mocks.complete.mockReset()
    mocks.publish.mockReset()
    mocks.start.mockResolvedValue(mocks.running)
  })

  it('shows explicit redraw context and starts the requested replacement batch', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={[`/draw/run/${mocks.request.drawSessionId}`]}><Routes><Route path="/draw/run/:drawSessionId" element={<DrawRunPage />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Undi Ulang siap dijalankan' })).toBeInTheDocument()
    expect(screen.getByText('Mengganti 2 pemenang · Sepeda Listrik · Grand Prize')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gunakan konfirmasi mulai Undi Ulang' }))
    await user.click(screen.getByRole('button', { name: 'Mulai Undi Ulang' }))
    expect(await screen.findByRole('heading', { name: 'Presentasi Undi Ulang' })).toBeInTheDocument()
    expect(mocks.start).toHaveBeenCalledWith(mocks.request.id)
    expect(screen.getByText('2 pengganti')).toBeInTheDocument()
  })

  it('restores a running redraw with the same locked selection without starting again', async () => {
    mocks.activeRequest = mocks.running
    render(<MemoryRouter initialEntries={[`/draw/run/${mocks.request.drawSessionId}`]}><Routes><Route path="/draw/run/:drawSessionId" element={<DrawRunPage />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Presentasi Undi Ulang' })).toBeInTheDocument()
    expect(screen.getByText('00044,00045')).toBeInTheDocument()
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('does not let the prior batch start guard block a new redraw request with a different count', async () => {
    const user = userEvent.setup()
    const nextRequest = {
      ...mocks.request,
      id: '00000000-0000-4000-8000-000000000091',
      targets: Array.from({ length: 6 }, (_, index) => ({
        winnerId: `00000000-0000-4000-8000-${String(30 + index).padStart(12, '0')}`,
        originalStatus: 'pending' as const,
        originalSequenceNumber: index + 1,
      })),
      replacementCount: 6,
    } as unknown as RedrawRequest
    const nextRunning = {
      ...nextRequest,
      status: 'running',
      selections: Array.from({ length: 6 }, (_, index) => ({
        winnerRecordId: `00000000-0000-4000-8000-${String(40 + index).padStart(12, '0')}`,
        participantId: `00000000-0000-4000-8000-${String(50 + index).padStart(12, '0')}`,
        ticketNumber: String(50 + index).padStart(5, '0'),
        selectionOrder: index + 1,
      })),
    } as unknown as RedrawRequest
    mocks.start.mockImplementation(async (requestId) => requestId === nextRequest.id ? nextRunning : mocks.running)
    const view = () => <MemoryRouter initialEntries={[`/draw/run/${mocks.request.drawSessionId}`]}><Routes><Route path="/draw/run/:drawSessionId" element={<DrawRunPage />} /></Routes></MemoryRouter>
    const { rerender } = render(view())

    expect(await screen.findByRole('heading', { name: 'Undi Ulang siap dijalankan' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gunakan konfirmasi mulai Undi Ulang' }))
    await user.click(screen.getByRole('button', { name: 'Mulai Undi Ulang' }))
    expect(await screen.findByText('2 pengganti')).toBeInTheDocument()

    mocks.activeRequest = nextRequest
    mocks.handoff = { drawSessionId: nextRequest.drawSessionId, request: nextRequest, readiness: {} as DrawReadinessResult, displayConfigurationId: '00000000-0000-4000-8000-000000000050' }
    rerender(view())

    expect(await screen.findByText('Mengganti 6 pemenang · Sepeda Listrik · Grand Prize')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gunakan konfirmasi mulai Undi Ulang' }))
    await user.click(screen.getByRole('button', { name: 'Mulai Undi Ulang' }))
    expect(await screen.findByText('6 pengganti')).toBeInTheDocument()
    expect(mocks.start).toHaveBeenNthCalledWith(1, mocks.request.id)
    expect(mocks.start).toHaveBeenNthCalledWith(2, nextRequest.id)
  })
})
