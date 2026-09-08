import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import type { Event } from '../../domain/events/event.types.ts'
import { EventsPage } from './EventsPage.tsx'

const eventId = '11111111-1111-4111-8111-111111111111' as Event['id']
const at = '2026-08-08T00:00:00.000Z' as Event['createdAt']
let event: Event
let service: { activateEvent: ReturnType<typeof vi.fn> }

vi.mock('../../app/workspace/ProductionWorkspaceContext.tsx', () => ({
  signalProductionWorkspaceChanged: vi.fn(),
  useProductionWorkspace: () => ({ status: 'ready', event, participantCount: 2, checkedInParticipantCount: 2, prizeCategoryCount: 1, liveSessionCount: 0, sessionCounts: { draft: 0, ready: 1, drawing: 0, 'pending-confirmation': 0, completed: 0, cancelled: 0 }, unresolvedSession: null, currentMode: null, displayConfiguration: null, eventSettings: { eventId: event.id, displayName: event.name, subtitle: '', primaryColor: '#000000', accentColor: '#ffffff', updatedAt: at } }),
}))

vi.mock('../../infrastructure/composition/event-setup-production.ts', () => ({
  createEventSetupProductionServices: () => ({
    service,
    open: vi.fn(async () => undefined),
    events: { findAll: vi.fn(async () => [event]) },
    participants: { countByEventId: vi.fn(async () => 2) },
    categories: { findByEventId: vi.fn(async () => [{ id: 'category-1' }]) },
    sessions: { findByEventId: vi.fn(async () => []) },
  }),
}))

function renderPage() {
  return render(<MemoryRouter><EventsPage /></MemoryRouter>)
}

describe('EventsPage activation flow', () => {
  beforeEach(() => {
    event = { id: eventId, name: 'Uji Coba Event', status: 'draft', createdAt: at, updatedAt: at }
    service = { activateEvent: vi.fn(async () => { event = { ...event, status: 'ready', updatedAt: '2026-08-08T00:01:00.000Z' as Event['updatedAt'] }; return event }) }
  })

  it('distinguishes Current from Draft and requires confirmation before activation', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('AKTIF')).toBeInTheDocument()
    expect(screen.getByText('DRAF')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aktifkan Acara' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Aktifkan Uji Coba Event?')
    expect(screen.getByText('Pastikan pengaturan Acara sudah benar sebelum melanjutkan.')).toBeInTheDocument()
    expect(service.activateEvent).not.toHaveBeenCalled()
  })

  it('cancels without changing Draft, then activates to Ready while remaining Current', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Aktifkan Acara' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('DRAF')).toBeInTheDocument()
    expect(service.activateEvent).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Aktifkan Acara' }))
    const activationButtons = screen.getAllByRole('button', { name: 'Aktifkan Acara' })
    await user.click(activationButtons[activationButtons.length - 1])
    expect(await screen.findByText('SIAP')).toBeInTheDocument()
    expect(screen.getByText('AKTIF')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aktifkan Acara' })).not.toBeInTheDocument()
  })

  it('does not offer activation for a Live Event', async () => {
    event = { ...event, status: 'live' }
    renderPage()

    await screen.findByText('MODE LIVE')
    expect(screen.queryByRole('button', { name: 'Aktifkan Acara' })).not.toBeInTheDocument()
    expect(screen.getByText('Dilindungi')).toBeInTheDocument()
  })
})
