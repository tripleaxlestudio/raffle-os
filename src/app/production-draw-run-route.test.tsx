import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { savePracticeResult } from '../application/draw/practice-result-storage.ts'
import type { DrawReadinessResult } from '../application/draw/draw-readiness.types.ts'
import type { DrawSession } from '../domain/draws/draw-session.types.ts'
import type { DrawConfiguration } from '../domain/draws/draw-configuration.types.ts'
import type { Event } from '../domain/events/event.types.ts'
import type { PrizeCategory } from '../domain/prizes/prize.types.ts'
import type { DrawSessionId } from '../domain/shared/identifiers.ts'
import { appRoutes } from './router.tsx'

const mocks = vi.hoisted(() => {
  const sessionId = '00000000-0000-4000-8000-000000000001' as DrawSessionId
  const practiceSessionId = '00000000-0000-4000-8000-000000000006' as DrawSessionId
  const event = { id: '00000000-0000-4000-8000-000000000002', name: 'Persisted Event', status: 'live' } as Event
  const category = { id: '00000000-0000-4000-8000-000000000003', eventId: event.id, name: 'Gold', prizeName: 'Prize' } as PrizeCategory
  const configuration = { id: '00000000-0000-4000-8000-000000000004', eventId: event.id, prizeCategoryId: category.id, requestedWinners: 1, winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null } as DrawConfiguration
  const session = { id: sessionId, eventId: event.id, configurationId: configuration.id, mode: 'live', status: 'ready', configurationSnapshot: null, candidatePoolSnapshot: null } as DrawSession
  const readiness = (id: string): DrawReadinessResult => id === sessionId
    ? { state: 'ready', retryable: false, data: { event, category, configuration, session, authoritativeEligibleCount: 1, totalParticipantCount: 2, checkedInParticipantCount: 1, previousWinnerExcludedCount: 0, requestedWinnerCount: 1, mode: 'live' } }
    : id === practiceSessionId
      ? { state: 'ready', retryable: false, data: { event, category, configuration: { ...configuration, requestedWinners: 2 }, session: { ...session, id: practiceSessionId, mode: 'practice' }, authoritativeEligibleCount: 5, totalParticipantCount: 6, checkedInParticipantCount: 5, previousWinnerExcludedCount: 0, requestedWinnerCount: 2, mode: 'practice' } }
      : { state: 'missing-session', retryable: false, reason: 'This DrawSession no longer exists.', errorCode: 'session-not-found' }
  const command = vi.fn()
  return { sessionId, practiceSessionId, readiness, command, event }
})

vi.mock('../application/draw/draw-readiness-query.ts', () => ({ queryDrawReadiness: vi.fn(async (id: string) => mocks.readiness(id)) }))
vi.mock('../infrastructure/composition/draw-command-production.ts', () => ({
  createDrawSetupProductionServices: () => ({
    open: vi.fn(async () => undefined),
    checkStorage: vi.fn(async () => ({ ok: true as const })),
    checkCrypto: vi.fn(async () => ({ ok: true as const })),
    command: { execute: mocks.command },
    events: { findById: vi.fn(async () => mocks.event) },
    configurations: { findById: vi.fn() },
    categories: { findById: vi.fn() },
    sessions: { findById: vi.fn(async () => null), findByEventId: vi.fn() },
    participants: { countByEventId: vi.fn(), findByEventId: vi.fn() },
    winners: { findByEventId: vi.fn(), findByDrawSessionId: vi.fn(async () => []) },
    preferences: { get: vi.fn() },
  }),
}))
vi.mock('../application/participant-import/participant-import-production-services.ts', () => ({
  createParticipantImportProductionServices: () => ({
    database: { openSupported: vi.fn(async () => undefined) },
    preferences: { get: vi.fn(async () => null) },
    events: { findById: vi.fn(async () => mocks.event) },
  }),
}))

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  return { router, ...render(<RouterProvider router={router} />) }
}

describe('production Draw Run route shell', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mocks.command.mockReset()
  })
  it('uses production chrome without prototype controls or status bars', async () => {
    renderRoute(`/draw/run/${mocks.sessionId}`)
    expect(await screen.findByRole('heading', { name: 'Ready to start' })).toBeInTheDocument()
    expect(screen.getByText('Production workspace')).toBeInTheDocument()
    expect(screen.queryByText('Prototype navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Prototype scenario' })).not.toBeInTheDocument()
    expect(screen.queryByText('Practice Mode')).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /Audience Display:/i })).not.toBeInTheDocument()
    expect(screen.queryByText('STATIC PROTOTYPE')).not.toBeInTheDocument()
    expect(screen.queryByText(/Static prototype/i)).not.toBeInTheDocument()
  })

  it('keeps an unknown session safe and never starts the command', async () => {
    renderRoute('/draw/run/unknown-session')
    expect(await screen.findByText('This DrawSession no longer exists.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Draw Setup' })).toBeInTheDocument()
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it('renders the persisted start gate without invoking the command on route load', async () => {
    renderRoute(`/draw/run/${mocks.sessionId}`)
    expect(await screen.findByText('Persisted Event')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hold to start official Live draw' })).toBeInTheDocument()
    await waitFor(() => expect(mocks.command).not.toHaveBeenCalled())
  })

  it('hydrates a valid Practice projection on initial mount and does not show start controls', async () => {
    savePracticeResult({
      drawSessionId: mocks.practiceSessionId,
      winners: [
        { winnerId: '00000000-0000-4000-8000-000000000010' as never, sequence: 1, ticketNumber: '00042' as never },
        { winnerId: '00000000-0000-4000-8000-000000000011' as never, sequence: 2, ticketNumber: '42' as never },
      ],
      createdAt: '2026-08-05T00:00:00.000Z',
      policyVersion: 1,
    })
    renderRoute(`/draw/run/${mocks.practiceSessionId}`)
    expect(await screen.findByRole('heading', { name: 'Result Locked' })).toBeInTheDocument()
    expect(screen.getByText('Practice projection restored for this tab; ticket reveal remains deferred.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '2 winners selected' })).toHaveTextContent('2 winners selected')
    expect(screen.queryByRole('button', { name: 'Hold to start Practice draw' })).not.toBeInTheDocument()
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it('uses the same projection after remount without reselection', async () => {
    savePracticeResult({
      drawSessionId: mocks.practiceSessionId,
      winners: [
        { winnerId: '00000000-0000-4000-8000-000000000010' as never, sequence: 1, ticketNumber: '00042' as never },
        { winnerId: '00000000-0000-4000-8000-000000000011' as never, sequence: 2, ticketNumber: '42' as never },
      ],
      createdAt: '2026-08-05T00:00:00.000Z',
      policyVersion: 1,
    })
    const first = renderRoute(`/draw/run/${mocks.practiceSessionId}`)
    await screen.findByRole('heading', { name: 'Result Locked' })
    first.unmount()
    renderRoute(`/draw/run/${mocks.practiceSessionId}`)
    expect(await screen.findByRole('heading', { name: 'Result Locked' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '2 winners selected' })).toHaveTextContent('2 winners selected')
    expect(JSON.parse(sessionStorage.getItem(`raffle-os:practice-result:v1:${mocks.practiceSessionId}`)!).winners.map((winner: { ticketNumber: string }) => winner.ticketNumber)).toEqual(['00042', '42'])
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it('does not read Practice storage for a Live session', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    savePracticeResult({
      drawSessionId: mocks.practiceSessionId,
      winners: [{ winnerId: '00000000-0000-4000-8000-000000000010' as never, sequence: 1, ticketNumber: '00042' as never }],
      createdAt: '2026-08-05T00:00:00.000Z',
      policyVersion: 1,
    })
    renderRoute(`/draw/run/${mocks.sessionId}`)
    expect(await screen.findByRole('heading', { name: 'Ready to start' })).toBeInTheDocument()
    expect(getItem).not.toHaveBeenCalledWith(`raffle-os:practice-result:v1:${mocks.sessionId}`)
    getItem.mockRestore()
  })

  it('surfaces a corrupt Practice projection as a typed bootstrap error without invoking selection', async () => {
    sessionStorage.setItem(`raffle-os:practice-result:v1:${mocks.practiceSessionId}`, '{bad-json}')
    const { router } = renderRoute(`/draw/run/${mocks.practiceSessionId}`)
    const dialog = await screen.findByRole('dialog', { name: 'Presentation needs attention' })
    expect(dialog).toHaveClass('ui-modal--production-surface')
    expect(screen.getByRole('heading', { name: 'Presentation recovery' })).toBeInTheDocument()
    expect(screen.getByText('Draw Run workspace')).toBeInTheDocument()
    expect(document.querySelector('.production-draw-run-shell')).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('SAFE STATE')).toBeInTheDocument()
    expect(screen.getByText('Your locked winner result is preserved.')).toBeInTheDocument()
    expect(screen.getByText('The presentation stage transition could not continue.')).toBeInTheDocument()
    expect(screen.getByText('You can retry the presentation from the same result or return to Draw Setup.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Draw Setup' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry presentation' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Audience publisher diagnostics' })).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Presentation needs attention' })).toBeInTheDocument()
    expect(sessionStorage.getItem(`raffle-os:practice-result:v1:${mocks.practiceSessionId}`)).toBe('{bad-json}')
    fireEvent.click(screen.getByRole('button', { name: 'Back to Draw Setup' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/draw/setup'))
    expect(sessionStorage.getItem(`raffle-os:practice-result:v1:${mocks.practiceSessionId}`)).toBe('{bad-json}')
    expect(mocks.command).not.toHaveBeenCalled()
  })
})
