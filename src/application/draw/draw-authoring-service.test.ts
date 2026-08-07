import { describe, expect, it, vi } from 'vitest'
import { createDrawAuthoringService } from './draw-authoring-service.ts'
import type { DrawAuthoringRepositories } from './draw-authoring.types.ts'

const event = { id: 'event-a', name: 'Event A', status: 'draft', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }
const category = { id: 'category-a', eventId: 'event-a', name: 'Prize', prizeName: 'Prize name', displayOrder: 1, createdAt: event.createdAt }
const participant = { id: 'participant-a', eventId: 'event-a', ticketNumber: '00042', isCheckedIn: true, createdAt: event.createdAt, updatedAt: event.updatedAt }

function makeRepositories(overrides: Partial<DrawAuthoringRepositories> = {}) {
  const repositories = {
    events: { findById: vi.fn(async () => event), findAll: vi.fn(async () => [event]) },
    categories: { findById: vi.fn(async () => category), findByEventId: vi.fn(async () => [category]) },
    configurations: { findById: vi.fn(async () => null), findByEventId: vi.fn(async () => []) },
    sessions: { findById: vi.fn(async () => null), findByEventId: vi.fn(async () => []) },
    participants: { countByEventId: vi.fn(async () => 1), findByEventId: vi.fn(async () => [participant]) },
    winners: { findByEventId: vi.fn(async () => []) },
    authoring: { persistReadyAuthoring: vi.fn(async () => undefined) },
    ...overrides,
  } as unknown as DrawAuthoringRepositories
  return repositories
}

const validDraft = { eventId: 'event-a', prizeCategoryId: 'category-a', requestedWinners: '1', winningRule: 'once-per-event', requireCheckIn: true, eligibleGroupFilter: null, mode: 'practice' } as const

describe('draw authoring service', () => {
  it.each([1, 100])('accepts winner count boundary %s and persists ready data', async (count) => {
    const participants = Array.from({ length: count }, (_, index) => ({ ...participant, id: `participant-${index}`, ticketNumber: String(index + 1).padStart(5, '0') }))
    const repositories = makeRepositories({ participants: { countByEventId: vi.fn(async () => count), findByEventId: vi.fn(async () => participants) } as never })
    const result = await createDrawAuthoringService(repositories).save({ ...validDraft, requestedWinners: count })
    expect(result.ok).toBe(true)
    expect(repositories.authoring?.persistReadyAuthoring).toHaveBeenCalledTimes(1)
    expect((result as { ok: true; record: { session: { status: string; mode: string } } }).record.session).toMatchObject({ status: 'ready', mode: 'practice' })
  })

  it('persists a valid per-draw Random Number Roll configuration', async () => {
    const result = await createDrawAuthoringService(makeRepositories()).save({
      ...validDraft,
      presentation: {
        presentationMode: 'random-number-roll',
        rollStopMode: 'timed',
        rollDurationSeconds: 5,
        rollSpeedPerSecond: 20,
        revealMode: 'all-together',
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record.configuration.presentation).toEqual({
      presentationMode: 'random-number-roll',
      rollStopMode: 'timed',
      rollDurationSeconds: 5,
      rollSpeedPerSecond: 20,
      revealMode: 'all-together',
    })
  })

  it.each(['completed', 'cancelled'] as const)('creates a new ready session after a terminal %s session', async (status) => {
    const configuration = { id: 'configuration-a', eventId: event.id, prizeCategoryId: category.id, requestedWinners: 1, winningRule: 'once-per-event', requireCheckIn: true, eligibleGroupFilter: null, createdAt: event.createdAt, updatedAt: event.updatedAt }
    const session = { id: 'old-session', eventId: event.id, configurationId: configuration.id, mode: 'practice', status, configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: event.createdAt, updatedAt: event.updatedAt }
    const persistReadyAuthoring = vi.fn(async (input: unknown) => input === undefined ? undefined : undefined)
    const repositories = makeRepositories({
      configurations: { findById: vi.fn(async () => configuration), findByEventId: vi.fn(async () => [configuration]) } as never,
      sessions: { findById: vi.fn(async () => session), findByEventId: vi.fn(async () => [session]) } as never,
      authoring: { persistReadyAuthoring } as never,
    })
    const result = await createDrawAuthoringService(repositories).save({ ...validDraft, configurationId: configuration.id, sessionId: session.id, presentation: { presentationMode: 'random-number-roll', rollStopMode: 'timed', rollDurationSeconds: 12, rollSpeedPerSecond: 20, revealMode: 'sequential' } })
    expect(result.ok).toBe(true)
    expect(persistReadyAuthoring).toHaveBeenCalledWith(expect.objectContaining({ existingConfigurationId: configuration.id, existingSessionId: undefined, session: expect.objectContaining({ status: 'ready', mode: 'practice' }) }))
    const persisted = persistReadyAuthoring.mock.calls[0]?.[0] as { session: { id: string } } | undefined
    expect(persisted?.session.id).not.toBe(session.id)
  })

  it.each(['', 0, 101, 1.5, 'not-a-number'])('rejects invalid winner count %s', async (requestedWinners) => {
    const result = await createDrawAuthoringService(makeRepositories()).save({ ...validDraft, requestedWinners })
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid-winner-count' } })
  })

  it('rejects cross-event category and insufficient capacity without writing', async () => {
    const repositories = makeRepositories({ categories: { findById: vi.fn(async () => ({ ...category, eventId: 'event-b' })), findByEventId: vi.fn(async () => [{ ...category, eventId: 'event-b' }]) } as never })
    const result = await createDrawAuthoringService(repositories).save(validDraft)
    expect(result).toMatchObject({ ok: false, error: { code: 'cross-event-relationship' } })
    expect(repositories.authoring?.persistReadyAuthoring).not.toHaveBeenCalled()

    const insufficient = await createDrawAuthoringService(makeRepositories()).save({ ...validDraft, requestedWinners: 2 })
    expect(insufficient).toMatchObject({ ok: false, error: { code: 'insufficient-eligible-capacity' } })
  })
})
