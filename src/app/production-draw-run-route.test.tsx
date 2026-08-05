import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { DrawReadinessResult } from '../application/draw/draw-readiness.types.ts'
import type { DrawSession } from '../domain/draws/draw-session.types.ts'
import type { DrawConfiguration } from '../domain/draws/draw-configuration.types.ts'
import type { Event } from '../domain/events/event.types.ts'
import type { PrizeCategory } from '../domain/prizes/prize.types.ts'
import type { DrawSessionId } from '../domain/shared/identifiers.ts'
import { appRoutes } from './router.tsx'

const mocks = vi.hoisted(() => {
  const sessionId = '00000000-0000-4000-8000-000000000001' as DrawSessionId
  const event = { id: '00000000-0000-4000-8000-000000000002', name: 'Persisted Event', status: 'live' } as Event
  const category = { id: '00000000-0000-4000-8000-000000000003', eventId: event.id, name: 'Gold', prizeName: 'Prize' } as PrizeCategory
  const configuration = { id: '00000000-0000-4000-8000-000000000004', eventId: event.id, prizeCategoryId: category.id, requestedWinners: 1, winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null } as DrawConfiguration
  const session = { id: sessionId, eventId: event.id, configurationId: configuration.id, mode: 'live', status: 'ready', configurationSnapshot: null, candidatePoolSnapshot: null } as DrawSession
  const readiness = (id: string): DrawReadinessResult => id === sessionId
    ? { state: 'ready', retryable: false, data: { event, category, configuration, session, authoritativeEligibleCount: 1, requestedWinnerCount: 1, mode: 'live' } }
    : { state: 'missing-session', retryable: false, reason: 'This DrawSession no longer exists.', errorCode: 'session-not-found' }
  const command = vi.fn()
  return { sessionId, readiness, command, event }
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
  it('uses production chrome without prototype controls or status bars', async () => {
    renderRoute(`/draw/run/${mocks.sessionId}`)
    expect(await screen.findByRole('heading', { name: 'Review Before Start' })).toBeInTheDocument()
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
})
