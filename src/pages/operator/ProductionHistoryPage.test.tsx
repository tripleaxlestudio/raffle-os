import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficialHistorySession } from '../../application/history/history-read-model.ts'
import type { PresentationProjectionSource } from '../../application/display-transport/public-projection.ts'
import { ProductionHistoryPage } from './ProductionHistoryPage.tsx'

const mocks = vi.hoisted(() => ({
  findByEventId: vi.fn(),
  retainedSnapshot: undefined as { drawSessionId: string; stage: string; verificationState?: string } | undefined,
  snapshotListeners: new Set<() => void>(),
  publish: vi.fn((source: PresentationProjectionSource) => { mocks.retainedSnapshot = { drawSessionId: source.drawSessionId, stage: source.stage, verificationState: source.verificationState }; mocks.snapshotListeners.forEach((listener) => listener()); return { ok: true } }),
  downloadExport: vi.fn(),
  serializeXlsx: vi.fn(async () => new ArrayBuffer(1)),
}))

const event = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: '24th K-Link Indonesia Anniversary',
  status: 'live',
  createdAt: '2026-08-08T00:00:00.000Z',
  updatedAt: '2026-08-08T00:00:00.000Z',
}

vi.mock('../../app/workspace/ProductionWorkspaceContext.tsx', () => ({
  useProductionWorkspace: () => ({ status: 'ready', event, eventSettings: { displayName: 'Current event', subtitle: '', primaryColor: '#111111', accentColor: '#222222' }, displayConfiguration: { blackoutAppearance: 'pure-black', safeAreaMargin: 48 } }),
  useProductionAudiencePublisher: () => ({ publish: mocks.publish, getSnapshot: () => mocks.retainedSnapshot, subscribeSnapshot: (listener: () => void) => { mocks.snapshotListeners.add(listener); return () => mocks.snapshotListeners.delete(listener) } }),
}))

vi.mock('../../infrastructure/composition/draw-command-production.ts', () => ({
  createDrawSetupProductionServices: () => ({
    open: vi.fn(async () => undefined),
    sessions: { findByEventId: mocks.findByEventId },
    configurations: { findById: vi.fn(async () => null) },
    categories: { findById: vi.fn(async () => null) },
    winners: { findByDrawSessionId: vi.fn(async () => []) },
    redraws: { findByDrawSessionId: vi.fn(async () => []) },
    audits: { findByEventId: vi.fn(async () => []) },
  }),
}))

vi.mock('../../application/history/confirmed-results-export.ts', async () => {
  const actual = await vi.importActual<typeof import('../../application/history/confirmed-results-export.ts')>('../../application/history/confirmed-results-export.ts')
  return { ...actual, downloadExport: mocks.downloadExport, serializeConfirmedResultsXlsx: mocks.serializeXlsx }
})

vi.mock('../../application/history/history-read-model.ts', async () => {
  const actual = await vi.importActual<typeof import('../../application/history/history-read-model.ts')>('../../application/history/history-read-model.ts')
  return {
    ...actual,
    reconstructOfficialHistoryForEvent: async (eventId: string) => {
      const sessions = await mocks.findByEventId(eventId)
      return {
        eventId,
        sessions: sessions.map((session: OfficialHistorySession['session']) => ({
          kind: 'complete' as const,
          value: {
            audits: [], category: null, configuration: null, event: { id: eventId, name: '24th K-Link Indonesia Anniversary', status: 'live', createdAt: '2026-08-08T00:00:00.000Z', updatedAt: '2026-08-08T00:00:00.000Z' }, issues: [], lineages: [], redraws: [], session,
            summary: { categoryId: null, categoryName: null, completionTimestamp: session.completedAt, drawSessionId: session.id, drawTimestamp: session.createdAt, eligibleCount: null, eventId, eventName: '24th K-Link Indonesia Anniversary', mode: session.mode, prizeName: null, requestedWinnerCount: null, sessionStatus: session.status },
            winners: session.status === 'completed' ? [{ winnerRecordId: `winner-${session.id}`, drawSessionId: session.id, participantId: 'participant-1', selectedTimestamp: session.createdAt, sequence: 1, status: 'confirmed', ticketNumber: '00042', confirmationTimestamp: session.completedAt }] : [],
          },
        })),
      }
    },
  }
})

function session(id: string, status: 'completed' | 'cancelled' = 'completed') {
  return {
    id,
    eventId: event.id,
    configurationId: `configuration-${id}`,
    mode: 'live',
    status,
    configurationSnapshot: null,
    candidatePoolSnapshot: null,
    createdAt: '2026-08-08T00:27:00.000Z',
    updatedAt: '2026-08-08T06:39:00.000Z',
    completedAt: '2026-08-08T06:39:00.000Z',
  }
}

function renderPage(path = '/history') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/history" element={<ProductionHistoryPage />} /><Route path="/history/:drawSessionId" element={<ProductionHistoryPage />} /></Routes></MemoryRouter>)
}

beforeEach(() => {
  mocks.findByEventId.mockResolvedValue([])
  mocks.publish.mockClear()
  mocks.retainedSnapshot = undefined
  mocks.snapshotListeners.clear()
  mocks.downloadExport.mockClear()
  mocks.serializeXlsx.mockClear()
})

describe('production History empty state', () => {
  it('hides the selected Event context, filters, and secondary sessions action while keeping the empty state action', async () => {
    renderPage()

    const heading = await screen.findByRole('heading', { name: 'Belum ada undian resmi', level: 2 })
    expect(heading.parentElement).toHaveClass('history-empty-state__copy')
    expect(screen.getByText('Riwayat resmi')).toHaveClass('history-empty-state__label')
    expect(screen.getByText('Acara ini belum memiliki hasil Undian tersimpan.')).toBeInTheDocument()
    expect(screen.getByText('Undian resmi yang selesai akan muncul otomatis di sini.')).toBeInTheDocument()
    expect(screen.getByText('Sesi Undian resmi untuk 24th K-Link Indonesia Anniversary.')).toBeInTheDocument()
    expect(screen.queryByText('Selected Event')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Buka Pengaturan Undian' })).toHaveAttribute('href', '/draw/setup')
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Mode' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open Draw Sessions' })).not.toBeInTheDocument()
    expect(heading.closest('.history-empty-state')).toHaveClass('ui-card')
  })

  it('restores filters and populated History behavior when an official session exists', async () => {
    mocks.findByEventId.mockResolvedValue([session('completed-1'), session('cancelled-1', 'cancelled')])
    const { container } = renderPage('/history?status=completed&mode=live')

    expect(await screen.findByRole('combobox', { name: 'Status' })).toHaveValue('completed')
    expect(screen.getByRole('combobox', { name: 'Mode' })).toHaveValue('live')
    expect(screen.getByRole('link', { name: 'Buka Sesi Undian' })).toHaveAttribute('href', '/draw/live')
    expect(screen.getByText(/Sesi Undian resmi untuk 24th K-Link Indonesia Anniversary/)).toBeInTheDocument()
    expect(container.querySelector('table[aria-label="Sesi Riwayat resmi"]')).toBeInTheDocument()
    expect(screen.queryByText('Selected Event')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Belum ada undian resmi' })).not.toBeInTheDocument()
    expect(screen.queryByText('cancelled-1')).not.toBeInTheDocument()
  })

  it('queries authoritative history by the selected Event', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Belum ada undian resmi' })
    expect(mocks.findByEventId).toHaveBeenCalledWith(event.id)
  })

  it('shows and publishes from an eligible row while retaining the details action', async () => {
    mocks.findByEventId.mockResolvedValue([session('completed-1'), session('cancelled-1', 'cancelled')])
    renderPage()

    expect(await screen.findByRole('button', { name: 'Tampilkan' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Lihat Detail' }).find((link) => link.getAttribute('href') === '/history/completed-1')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Tampilkan' })).toHaveLength(1)
    await screen.getByRole('button', { name: 'Tampilkan' }).click()
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ drawSessionId: 'completed-1', verificationState: 'verified', result: { drawSessionId: 'completed-1', winners: [{ sequence: 1, ticketNumber: '00042', status: 'confirmed' }] } }))
    expect(await screen.findByRole('button', { name: 'Sembunyikan' })).toBeInTheDocument()
  })

  it('derives Hide from the retained Audience session and returns every row to Show on standby', async () => {
    mocks.findByEventId.mockResolvedValue([session('completed-a'), session('completed-b'), session('cancelled-1', 'cancelled')])
    renderPage()

    expect(await screen.findAllByRole('button', { name: 'Tampilkan' })).toHaveLength(2)
    await screen.getAllByRole('button', { name: 'Tampilkan' })[0].click()
    expect(await screen.findByRole('button', { name: 'Sembunyikan' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Tampilkan' })).toHaveLength(1)
    await screen.getByRole('button', { name: 'Tampilkan' }).click()
    expect(await screen.findAllByRole('button', { name: 'Sembunyikan' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Tampilkan' })).toHaveLength(1)
    await screen.getByRole('button', { name: 'Sembunyikan' }).click()
    expect(await screen.findAllByRole('button', { name: 'Tampilkan' })).toHaveLength(2)
    expect(mocks.publish).toHaveBeenLastCalledWith(expect.objectContaining({ stage: 'standby', eventName: 'Current event' }))
  })

  it('renders an official result route without the history list', async () => {
    mocks.findByEventId.mockResolvedValue([session('completed-1')])
    renderPage('/history/completed-1')

    expect(await screen.findByRole('heading', { name: 'Record pemenang' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Sesi Riwayat resmi')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke Riwayat' })).toHaveAttribute('href', '/history')
    expect(screen.queryByRole('button', { name: 'Tampilkan' })).not.toBeInTheDocument()
  })
})

describe('production History export menu', () => {
  it('opens a contained menu without shifting the History filters', async () => {
    const user = userEvent.setup()
    mocks.findByEventId.mockResolvedValue([session('completed-1')])
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Ekspor (1)' }))
    expect(screen.getByRole('menu', { name: 'Ekspor hasil terkonfirmasi' })).toHaveClass('history-export__menu')
    expect(screen.getByRole('menuitem', { name: /CSV/ })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: /XLSX/ })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: /CSV/ })).toHaveFocus()
    expect(screen.getByLabelText('Filter Riwayat')).toBeInTheDocument()
  })

  it('supports arrow, Home, End, and Escape menu keyboard behavior', async () => {
    const user = userEvent.setup()
    mocks.findByEventId.mockResolvedValue([session('completed-1')])
    renderPage()

    const trigger = await screen.findByRole('button', { name: 'Ekspor (1)' })
    await user.click(trigger)
    const csv = screen.getByRole('menuitem', { name: /CSV/ })
    const xlsx = screen.getByRole('menuitem', { name: /XLSX/ })
    expect(csv).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(xlsx).toHaveFocus()
    await user.keyboard('{Home}')
    expect(csv).toHaveFocus()
    await user.keyboard('{End}')
    expect(xlsx).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('triggers CSV export and closes the menu', async () => {
    const user = userEvent.setup()
    mocks.findByEventId.mockResolvedValue([session('completed-1')])
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Ekspor (1)' }))
    await user.click(screen.getByRole('menuitem', { name: /CSV/ }))
    expect(mocks.downloadExport).toHaveBeenCalledWith(expect.any(String), 'text/csv;charset=utf-8', expect.stringContaining('.csv'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('triggers XLSX export and closes the menu', async () => {
    const user = userEvent.setup()
    mocks.findByEventId.mockResolvedValue([session('completed-1')])
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Ekspor (1)' }))
    await user.click(screen.getByRole('menuitem', { name: /XLSX/ }))
    await waitFor(() => expect(mocks.serializeXlsx).toHaveBeenCalled())
    expect(mocks.downloadExport).toHaveBeenCalledWith(expect.any(ArrayBuffer), expect.stringContaining('spreadsheetml'), expect.stringContaining('.xlsx'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on outside click and Escape', async () => {
    const user = userEvent.setup()
    mocks.findByEventId.mockResolvedValue([session('completed-1')])
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Ekspor (1)' }))
    await user.click(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ekspor (1)' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
