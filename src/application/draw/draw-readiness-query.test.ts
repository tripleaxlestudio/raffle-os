import { describe, expect, it, vi } from 'vitest'
import { queryDrawReadiness } from './draw-readiness-query.ts'
import { ACCEPTANCE_SEED_IDS, getAcceptanceSeedDrawConfigurations, getAcceptanceSeedDrawSessions, getAcceptanceSeedEvents, getAcceptanceSeedParticipants, getAcceptanceSeedPrizeCategories } from '../../infrastructure/persistence/seed/dev-seed-fixtures.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'

function dependencies(overrides: Record<string, unknown> = {}) {
  const event = getAcceptanceSeedEvents()[0]
  const category = getAcceptanceSeedPrizeCategories()[0]
  const configuration = getAcceptanceSeedDrawConfigurations()[0]
  const sessions = getAcceptanceSeedDrawSessions()
  const participants = getAcceptanceSeedParticipants()
  return {
    checkStorage: vi.fn(async () => ({ ok: true as const })),
    checkCrypto: vi.fn(async () => ({ ok: true as const })),
    events: { findById: vi.fn(async () => event) },
    configurations: { findById: vi.fn(async () => configuration) },
    categories: { findById: vi.fn(async () => category) },
    sessions: { findById: vi.fn(async (id: string) => sessions.find((value) => value.id === id) ?? null), findByEventId: vi.fn(async () => sessions) },
    participants: { countByEventId: vi.fn(async () => participants.length), findByEventId: vi.fn(async () => participants) },
    winners: { findByEventId: vi.fn(async () => []) },
    ...overrides,
  } as never
}

describe('queryDrawReadiness', () => {
  it('uses authoritative eligibility and permits an exact-capacity Practice handoff', async () => {
    const result = await queryDrawReadiness(ACCEPTANCE_SEED_IDS.practiceSession, dependencies())
    expect(result.state).toBe('ready')
    expect(result.data?.authoritativeEligibleCount).toBe(4)
    expect(result.data?.totalParticipantCount).toBe(6)
    expect(result.data?.checkedInParticipantCount).toBe(4)
    expect(result.data?.previousWinnerExcludedCount).toBe(0)
    expect(result.data?.requestedWinnerCount).toBe(2)
    expect(result.data).not.toHaveProperty('participants')
  })

  it('reports authoritative group and previous-winner exclusions', async () => {
    const event = getAcceptanceSeedEvents()[0]
    const category = getAcceptanceSeedPrizeCategories()[0]
    const configuration = { ...getAcceptanceSeedDrawConfigurations()[0], eligibleGroupFilter: 'VIP', requireCheckIn: false }
    const participants = getAcceptanceSeedParticipants()
    const previousWinner = {
      id: 'aaaaaaa5-0000-4000-8000-000000000090',
      eventId: event.id,
      prizeCategoryId: category.id,
      drawSessionId: ACCEPTANCE_SEED_IDS.liveSession,
      participantId: participants[0].id,
      ticketNumber: participants[0].ticketNumber,
      sequenceNumber: 1,
      status: 'confirmed',
      confirmedAt: '2026-07-31T08:45:00.000Z',
      createdAt: '2026-07-31T08:30:00.000Z',
      updatedAt: '2026-07-31T08:45:00.000Z',
    } as unknown as WinnerRecord
    const result = await queryDrawReadiness(ACCEPTANCE_SEED_IDS.liveSession, dependencies({ configurations: { findById: vi.fn(async () => configuration) }, categories: { findById: vi.fn(async () => category) }, events: { findById: vi.fn(async () => event) }, participants: { countByEventId: vi.fn(async () => participants.length), findByEventId: vi.fn(async () => participants) }, winners: { findByEventId: vi.fn(async () => [previousWinner]) } }))
    expect(result.state).toBe('ready')
    expect(result.data?.checkedInParticipantCount).toBe(4)
    expect(result.data?.previousWinnerExcludedCount).toBe(1)
    expect(result.data?.authoritativeEligibleCount).toBe(2)
  })

  it('blocks insufficient capacity without invoking a draw command', async () => {
    const configuration = { ...getAcceptanceSeedDrawConfigurations()[0], requestedWinners: 5 }
    const result = await queryDrawReadiness(ACCEPTANCE_SEED_IDS.practiceSession, dependencies({ configurations: { findById: vi.fn(async () => configuration) } }))
    expect(result.state).toBe('insufficient-capacity')
    expect(result.reason).toMatch(/reduce the winner count/i)
  })

  it('distinguishes unavailable secure randomness and active session conflicts', async () => {
    const cryptoResult = await queryDrawReadiness(ACCEPTANCE_SEED_IDS.liveSession, dependencies({ checkCrypto: vi.fn(async () => ({ ok: false as const, reason: 'Secure Web Crypto is unavailable.' })) }))
    expect(cryptoResult.state).toBe('crypto-unavailable')
    const active = { ...getAcceptanceSeedDrawSessions()[1], id: 'active-session', status: 'drawing' as const }
    const conflictResult = await queryDrawReadiness(ACCEPTANCE_SEED_IDS.liveSession, dependencies({ sessions: { findById: vi.fn(async () => getAcceptanceSeedDrawSessions()[1]), findByEventId: vi.fn(async () => [...getAcceptanceSeedDrawSessions(), active]) } }))
    expect(conflictResult.state).toBe('session-conflict')
  })

  it('resolves historical Live sessions from their own configurations', async () => {
    const event = getAcceptanceSeedEvents()[0]
    const currentCategory = getAcceptanceSeedPrizeCategories()[0]
    const historicalCategory = { ...currentCategory, id: 'historical-category' as typeof currentCategory.id }
    const currentConfiguration = { ...getAcceptanceSeedDrawConfigurations()[0], prizeCategoryId: currentCategory.id }
    const historicalConfiguration = { ...currentConfiguration, id: 'historical-configuration' as typeof currentConfiguration.id, prizeCategoryId: historicalCategory.id }
    const currentSession = { ...getAcceptanceSeedDrawSessions()[1], configurationId: currentConfiguration.id }
    const historicalSession = { ...currentSession, id: 'historical-session' as typeof currentSession.id, configurationId: historicalConfiguration.id, createdAt: '2026-07-31T08:10:00.000Z' as never }
    const participant = getAcceptanceSeedParticipants()[0]
    const confirmed = { id: 'historical-winner', eventId: event.id, prizeCategoryId: historicalCategory.id, drawSessionId: historicalSession.id, participantId: participant.id, ticketNumber: participant.ticketNumber, sequenceNumber: 1, status: 'confirmed', confirmedAt: '2026-07-31T08:45:00.000Z', createdAt: '2026-07-31T08:30:00.000Z', updatedAt: '2026-07-31T08:45:00.000Z' } as unknown as WinnerRecord
    const result = await queryDrawReadiness(currentSession.id, dependencies({
      configurations: { findById: vi.fn(async (id: string) => id === historicalConfiguration.id ? historicalConfiguration : currentConfiguration) },
      categories: { findById: vi.fn(async (id: string) => id === historicalCategory.id ? historicalCategory : currentCategory) },
      sessions: { findById: vi.fn(async () => currentSession), findByEventId: vi.fn(async () => [historicalSession, currentSession]) },
      winners: { findByEventId: vi.fn(async () => [confirmed]) },
    }))
    expect(result.state).toBe('ready')
    expect(result.data?.authoritativeEligibleCount).toBe(3)
    expect(result.data?.previousWinnerExcludedCount).toBe(1)
  })
})
