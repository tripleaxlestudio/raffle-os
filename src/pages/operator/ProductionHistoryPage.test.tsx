import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfficialHistorySession } from '../../application/history/history-read-model.ts'
import { ProductionHistoryPage } from './ProductionHistoryPage.tsx'

const mocks = vi.hoisted(() => ({
  findByEventId: vi.fn(),
}))

const event = {
  id: 'event-selected',
  name: '24th K-Link Indonesia Anniversary',
  status: 'live',
  createdAt: '2026-08-08T00:00:00.000Z',
  updatedAt: '2026-08-08T00:00:00.000Z',
}

vi.mock('../../app/workspace/ProductionWorkspaceContext.tsx', () => ({
  useProductionWorkspace: () => ({ status: 'ready', event }),
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

vi.mock('../../application/history/history-read-model.ts', async () => {
  const actual = await vi.importActual<typeof import('../../application/history/history-read-model.ts')>('../../application/history/history-read-model.ts')
  return {
    ...actual,
    buildOfficialHistorySession: (session: OfficialHistorySession['session'], selectedEvent: typeof event) => ({
      relation: 'valid',
      event: selectedEvent,
      category: null,
      session,
      records: [],
    }),
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
  return render(<MemoryRouter initialEntries={[path]}><ProductionHistoryPage /></MemoryRouter>)
}

beforeEach(() => {
  mocks.findByEventId.mockResolvedValue([])
})

describe('production History empty state', () => {
  it('hides the selected Event context, filters, and secondary sessions action while keeping the empty state action', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'No official draws yet' })).toBeInTheDocument()
    expect(screen.getByText('This Event does not have any persisted Live draw results yet.')).toBeInTheDocument()
    expect(screen.getByText('Completed official draws will appear here automatically.')).toBeInTheDocument()
    expect(screen.getByText('Authoritative Live DrawSessions for 24th K-Link Indonesia Anniversary.')).toBeInTheDocument()
    expect(screen.queryByText('Selected Event')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Draw Setup' })).toHaveAttribute('href', '/draw/setup')
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Mode' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open Draw Sessions' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No official draws yet' }).closest('.history-empty-state')).toHaveClass('ui-card')
  })

  it('restores filters and populated History behavior when an official session exists', async () => {
    mocks.findByEventId.mockResolvedValue([session('completed-1'), session('cancelled-1', 'cancelled')])
    const { container } = renderPage('/history?status=completed&mode=live')

    expect(await screen.findByRole('combobox', { name: 'Status' })).toHaveValue('completed')
    expect(screen.getByRole('combobox', { name: 'Mode' })).toHaveValue('live')
    expect(screen.getByRole('link', { name: 'Open Draw Sessions' })).toHaveAttribute('href', '/draw/live')
    expect(screen.getByText('Selected Event')).toBeInTheDocument()
    expect(container.querySelector('[aria-label="Official history sessions"]')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'No official draws yet' })).not.toBeInTheDocument()
    expect(screen.queryByText('cancelled-1')).not.toBeInTheDocument()
  })

  it('queries authoritative history by the selected Event', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'No official draws yet' })
    expect(mocks.findByEventId).toHaveBeenCalledWith('event-selected')
  })
})
