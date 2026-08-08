import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrawSessionQueueResult } from '../../application/draw/draw-session-queue.ts'
import type { Event } from '../../domain/events/event.types.ts'
import { RuntimeDiagnosticsPanel } from '../../application/display-transport/RuntimeDiagnostics.tsx'
import { ProductionPendingResultsLandingPage } from './ProductionPendingResultsLandingPage.tsx'

const mocks = vi.hoisted(() => ({
  queue: null as DrawSessionQueueResult | null,
}))

const event = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Summer Raffle',
  status: 'live',
  createdAt: '2026-08-08T00:00:00.000Z',
  updatedAt: '2026-08-08T00:00:00.000Z',
} as Event

vi.mock('../../app/workspace/ProductionWorkspaceContext.tsx', () => ({
  useProductionWorkspace: () => ({
    status: 'ready',
    event,
  }),
}))

vi.mock('../../infrastructure/composition/draw-command-production.ts', () => ({
  createDrawSetupProductionServices: () => ({ open: vi.fn(async () => undefined) }),
}))

vi.mock('../../application/draw/draw-session-queue.ts', () => ({
  queryDrawSessionQueue: vi.fn(async () => mocks.queue),
}))

function renderPage() {
  return render(<MemoryRouter><ProductionPendingResultsLandingPage /></MemoryRouter>)
}

function sessionItem(status: 'pending-confirmation' | 'completed', mode: 'live' | 'practice' = 'live') {
  return {
    session: {
      id: `${mode}-${status}`,
      eventId: event.id,
      configurationId: 'configuration-1',
      mode,
      status,
      configurationSnapshot: null,
      candidatePoolSnapshot: null,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    },
    event,
    category: { id: 'category-1', eventId: event.id, name: 'Grand Prize', prizeName: 'Travel Voucher' },
    winnerCount: 1,
    checkpoint: null,
    relation: 'valid',
    action: status === 'pending-confirmation' ? { kind: 'pending', to: `/draw/pending/${mode}-${status}` } : { kind: 'history', to: '/history' },
  } as DrawSessionQueueResult['items'][number]
}

beforeEach(() => {
  mocks.queue = { event, items: [] }
})

describe('production Pending Results landing state', () => {
  it('renders a bounded no-action empty state with event context and navigation', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Pending Results' })).toBeInTheDocument()
    expect(screen.getByText('Summer Raffle · unresolved Live sessions')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'No pending results' })).toBeInTheDocument()
    expect(screen.getByText('There are no Live draw results waiting for operator review.')).toBeInTheDocument()

    const emptyState = screen.getByRole('heading', { level: 2, name: 'No pending results' }).closest('.pending-results__empty-state')
    expect(emptyState).toBeInTheDocument()
    expect(emptyState).toHaveClass('ui-card')
    expect(emptyState).toHaveClass('pending-results__empty-state')
    expect(within(emptyState as HTMLElement).getByLabelText('No action required')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Live Draw' })).toHaveAttribute('href', '/draw/live')
    expect(screen.getByRole('link', { name: 'View History' })).toHaveAttribute('href', '/history')
    expect(screen.queryByText('Review Pending Result')).not.toBeInTheDocument()
  })

  it('keeps practice and completed sessions out of the unresolved Live empty state', async () => {
    mocks.queue = { event, items: [sessionItem('pending-confirmation', 'practice'), sessionItem('completed')] }
    renderPage()

    expect(await screen.findByRole('heading', { level: 2, name: 'No pending results' })).toBeInTheDocument()
  })

  it('preserves the operational pending-result card when a Live session is unresolved', async () => {
    mocks.queue = { event, items: [sessionItem('pending-confirmation')] }
    renderPage()

    const review = await screen.findByRole('link', { name: 'Review Pending Result' })
    expect(review).toHaveAttribute('href', '/draw/pending/live-pending-confirmation')
    expect(screen.getByText('Action required')).toBeInTheDocument()
    expect(screen.getByText('Travel Voucher')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'No pending results' })).not.toBeInTheDocument()
    expect(document.querySelector('.pending-results__landing-card')).toBeInTheDocument()
  })

  it('keeps diagnostics separate and collapsible at the production layout boundary', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ProductionPendingResultsLandingPage /><RuntimeDiagnosticsPanel side="Operator" title="Audience publisher diagnostics" summary={<p>Diagnostics summary</p>} /></MemoryRouter>)

    const emptyState = await screen.findByRole('heading', { level: 2, name: 'No pending results' })
    const diagnostics = screen.getByTestId('operator-runtime-diagnostics')
    expect(emptyState.closest('.pending-results__empty-state')).not.toContainElement(diagnostics)
    expect(diagnostics).not.toHaveAttribute('open')
    await user.click(screen.getByText('Audience publisher diagnostics'))
    expect(screen.getByText('Diagnostics summary')).toBeVisible()
  })
})
