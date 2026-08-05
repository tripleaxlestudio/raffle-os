import { describe, expect, it, vi } from 'vitest'
import { queryDrawReadiness } from './draw-readiness-query.ts'
import { ACCEPTANCE_SEED_IDS, getAcceptanceSeedDrawConfigurations, getAcceptanceSeedDrawSessions, getAcceptanceSeedEvents, getAcceptanceSeedParticipants, getAcceptanceSeedPrizeCategories } from '../../infrastructure/persistence/seed/dev-seed-fixtures.ts'

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
    expect(result.data?.requestedWinnerCount).toBe(2)
    expect(result.data).not.toHaveProperty('participants')
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
})
