import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { DrawSetupProductionServices } from '../../application/draw/draw-setup-query.types.ts'
import type { DrawCommandResult } from '../../application/draw/draw-command.types.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import { DrawSetupPage } from './DrawSetupPage.tsx'

function makeServices(overrides: { participants?: Participant[]; event?: Event | null; configuration?: DrawConfiguration | null; category?: PrizeCategory | null; session?: DrawSession | null } = {}) {
  const event = overrides.event === undefined ? { id: 'event-1', name: 'Persisted Gala', status: 'live', createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:00.000Z' } as Event : overrides.event
  const category = overrides.category === undefined ? { id: 'category-1', eventId: 'event-1', name: 'Grand Prize', prizeName: 'Luxury Electric Vehicle', displayOrder: 1, createdAt: '2026-07-31T08:00:00.000Z' } as PrizeCategory : overrides.category
  const configuration = overrides.configuration === undefined ? { id: 'configuration-1', eventId: 'event-1', prizeCategoryId: 'category-1', requestedWinners: 1, winningRule: 'once-per-event', requireCheckIn: true, eligibleGroupFilter: null, createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:00.000Z' } as DrawConfiguration : overrides.configuration
  const session = overrides.session === undefined ? { id: 'session-1', eventId: 'event-1', configurationId: 'configuration-1', mode: 'practice', status: 'ready', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:00.000Z' } as DrawSession : overrides.session
  const participants = overrides.participants ?? [{ id: 'participant-1', eventId: 'event-1', ticketNumber: '00042', isCheckedIn: true, group: undefined, createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:00.000Z' }] as Participant[]
  const execute = vi.fn(async (): Promise<{ ok: true; value: DrawCommandResult }> => ({
    ok: true,
    value: {
      auditRecord: { action: 'draw-session-started', actor: { type: 'operator', name: 'Test Operator' }, detail: {}, eventId: event!.id, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' as never, timestamp: '2026-07-31T08:00:00.000Z' as never },
      candidatePoolSnapshot: {} as DrawCommandResult['candidatePoolSnapshot'],
      configuration: configuration!,
      configurationSnapshot: {} as DrawCommandResult['configurationSnapshot'],
      event: event!,
      pendingWinners: [{ id: '88888888-8888-4888-8888-888888888881' as never, eventId: event!.id, prizeCategoryId: category!.id, drawSessionId: session!.id, participantId: participants[0].id, ticketNumber: '00042' as never, sequenceNumber: 1, status: 'pending', createdAt: '2026-07-31T08:00:00.000Z' as never, updatedAt: '2026-07-31T08:00:00.000Z' as never }],
      participants,
      prizeCategory: category!,
      selectedCandidateEntries: [{ participantId: participants[0].id, ticketNumber: '00042' as never }],
      session: session!,
    },
  }))
  const services = {
    open: vi.fn(async () => undefined),
    events: { findById: vi.fn(async () => event), findAll: vi.fn(), create: vi.fn(), updateDraft: vi.fn(), transitionStatus: vi.fn(), deleteDraft: vi.fn() },
    preferences: { get: vi.fn(async () => event?.id ?? null), set: vi.fn() },
    configurations: { findById: vi.fn(async () => configuration), findByEventId: vi.fn(async () => configuration === null ? [] : [configuration]), createDraft: vi.fn(), updateDraft: vi.fn(), deleteUnused: vi.fn() },
    categories: { findById: vi.fn(async () => category), findByEventId: vi.fn(async () => category === null ? [] : [category]), create: vi.fn(), updateDraft: vi.fn(), deleteDraft: vi.fn() },
    sessions: { findById: vi.fn(async () => session), findByEventId: vi.fn(async () => session === null ? [] : [session]), findLatestByEventId: vi.fn(async () => session), createDraft: vi.fn(), attachSnapshotsAndTransitionToDrawing: vi.fn(), transitionStatus: vi.fn() },
    participants: { findById: vi.fn(), findByTicketNumber: vi.fn(), findByEventId: vi.fn(async () => participants), countByEventId: vi.fn(async () => participants.length), createBatch: vi.fn(), updateOperationalFields: vi.fn(), deleteDraftEventParticipants: vi.fn() },
    winners: { findByEventId: vi.fn(async () => []), findByDrawSessionId: vi.fn(), findConfirmedByEventId: vi.fn(), findConfirmedByEventAndCategory: vi.fn(), append: vi.fn(), appendBatch: vi.fn(), transitionStatus: vi.fn() },
    command: { execute },
  } as unknown as DrawSetupProductionServices
  return { services, execute }
}

function renderDrawSetup(services: DrawSetupProductionServices, path = '/draw/setup?mode=practice') {
  return render(<MemoryRouter initialEntries={[path]}><DrawSetupPage services={services} /></MemoryRouter>)
}

describe('Draw Setup production integration', () => {
  it('renders loading and no active Event without fixture data', async () => {
    const { services } = makeServices({ event: null })
    renderDrawSetup(services)
    expect(screen.getByText(/Loading authoritative Event/i)).toBeInTheDocument()
    expect(await screen.findByText('Select or create an Event first')).toBeInTheDocument()
    expect(screen.queryByText('Nusantara Tech Gala 2026')).not.toBeInTheDocument()
  })

  it('renders authoritative readiness and exact requested/eligible values', async () => {
    const { services } = makeServices()
    renderDrawSetup(services)
    expect(await screen.findByText('Eligibility and capacity are ready')).toBeInTheDocument()
    expect(screen.getByText('Persisted Gala')).toBeInTheDocument()
    expect(screen.getByText('Grand Prize · Luxury Electric Vehicle')).toBeInTheDocument()
    expect(screen.getByText('Eligible candidates')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Practice' })).toBeEnabled()
  })

  it('confirms Practice, calls the command once, and preserves exact tickets', async () => {
    const user = userEvent.setup()
    const { services, execute } = makeServices()
    renderDrawSetup(services)
    await user.click(await screen.findByRole('button', { name: 'Run Practice' }))
    expect(screen.getByRole('dialog', { name: 'Run practice rehearsal' })).toBeInTheDocument()
    expect(screen.getAllByText(/rehearsal only/i).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Run practice' }))
    expect(execute).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Practice result')).toBeInTheDocument()
    expect(screen.getByText('00042')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('requires Live confirmation and blocks duplicate submission', async () => {
    const user = userEvent.setup()
    const { services, execute } = makeServices()
    renderDrawSetup(services, '/draw/setup?mode=live')
    await user.click(await screen.findByRole('button', { name: 'Start Live draw' }))
    expect(screen.getByRole('dialog', { name: 'Confirm live draw start' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm live draw' }))
    expect(execute).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Live draw started')).toBeInTheDocument()
  })

  it('blocks insufficient capacity before the command', async () => {
    const user = userEvent.setup()
    const { services, execute } = makeServices({ configuration: { id: 'configuration-1', eventId: 'event-1', prizeCategoryId: 'category-1', requestedWinners: 100, winningRule: 'once-per-event', requireCheckIn: true, eligibleGroupFilter: null, createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:00.000Z' } as DrawConfiguration, participants: [{ id: 'participant-1', eventId: 'event-1', ticketNumber: '00042', isCheckedIn: true, createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:00.000Z' }, { id: 'participant-2', eventId: 'event-1', ticketNumber: '00043', isCheckedIn: true, createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:00.000Z' }] as Participant[] })
    renderDrawSetup(services)
    expect(await screen.findByText('Draw cannot start from the current persisted state')).toBeInTheDocument()
    expect(screen.getByText(/smaller than the requested winner count/i)).toBeInTheDocument()
    expect(execute).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Run Practice' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Refresh readiness' }))
  })

  it('blocks missing configuration and invalid category relationships', async () => {
    const noConfiguration = makeServices({ configuration: null })
    renderDrawSetup(noConfiguration.services)
    expect(await screen.findByText('Complete Draw Setup configuration')).toBeInTheDocument()

    const invalidCategory = makeServices({ category: null })
    renderDrawSetup(invalidCategory.services)
    expect(await screen.findByText('The selected prize category is unavailable')).toBeInTheDocument()
  })

  it('blocks an Event with no Participants', async () => {
    const { services } = makeServices({ participants: [] })
    renderDrawSetup(services)
    expect(await screen.findByText('Import valid Participants for this Event')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Import Participants' })).toHaveAttribute('href', '/participants')
  })

  it('blocks a stale or already-running DrawSession', async () => {
    const { services } = makeServices({ session: { id: 'session-1', eventId: 'event-1', configurationId: 'configuration-1', mode: 'practice', status: 'pending-confirmation', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:00.000Z' } as DrawSession })
    renderDrawSetup(services)
    expect(await screen.findByText(/cannot start another draw/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run Practice' })).not.toBeInTheDocument()
  })

  it('returns to ready on cancellation and exposes safe retry copy on load failure', async () => {
    const user = userEvent.setup()
    const { services } = makeServices()
    renderDrawSetup(services)
    await user.click(await screen.findByRole('button', { name: 'Run Practice' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Run Practice' })).toBeVisible()

    const failed = makeServices()
    failed.services.participants.countByEventId = vi.fn(async () => { throw new Error('private diagnostic') })
    renderDrawSetup(failed.services)
    expect(await screen.findByText('Draw Setup could not be loaded')).toBeInTheDocument()
    expect(screen.getByText(/Authoritative draw setup data could not be loaded/i)).toBeInTheDocument()
    expect(screen.queryByText('private diagnostic')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })
})
