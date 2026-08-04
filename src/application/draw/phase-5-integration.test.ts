import { afterEach, describe, expect, it } from 'vitest'
import { executeDraw } from './draw-command.ts'
import type { RandomSource } from './random-source.ts'
import { createAuditRecordId, createWinnerRecordId } from '../../domain/shared/identifiers.ts'
import { DexieDrawConfigurationRepository } from '../../infrastructure/persistence/repositories/draw-configuration.repository.ts'
import { DexieDrawSessionRepository } from '../../infrastructure/persistence/repositories/draw-session.repository.ts'
import { DexieEventRepository } from '../../infrastructure/persistence/repositories/event.repository.ts'
import { DexieParticipantRepository } from '../../infrastructure/persistence/repositories/participant.repository.ts'
import { DexiePrizeCategoryRepository } from '../../infrastructure/persistence/repositories/prize-category.repository.ts'
import { DexieWinnerRepository } from '../../infrastructure/persistence/repositories/winner.repository.ts'
import { DexieDrawPersistenceUnitOfWork } from '../../infrastructure/persistence/transactions/dexie-draw-persistence-unit-of-work.ts'
import { cleanupTestDatabases, makeDrawHistoryFixture, seedReadyFixture, TIME_2, openTestDatabase } from '../../infrastructure/persistence/test/draw-history-test-helpers.ts'
import type { RaffleOSDatabase } from '../../infrastructure/persistence/db.ts'

const deterministicRandom: RandomSource = { nextUint32: () => 0 }

function dependencies(database: RaffleOSDatabase, randomSource: RandomSource = deterministicRandom) {
  return {
    events: new DexieEventRepository(database),
    configurations: new DexieDrawConfigurationRepository(database),
    categories: new DexiePrizeCategoryRepository(database),
    sessions: new DexieDrawSessionRepository(database),
    participants: new DexieParticipantRepository(database),
    winners: new DexieWinnerRepository(database),
    persistence: new DexieDrawPersistenceUnitOfWork(database),
    randomSource,
    now: () => TIME_2,
    createWinnerRecordId,
    createAuditRecordId,
  }
}

function input(fixture: ReturnType<typeof makeDrawHistoryFixture>, mode: 'live' | 'practice' = 'live') {
  return {
    eventId: fixture.event.id,
    drawSessionId: fixture.session.id,
    configurationId: fixture.configuration.id,
    prizeCategoryId: fixture.category.id,
    mode,
    expectedStatus: 'ready' as const,
  }
}

describe('Phase 5 persisted production flow', () => {
  afterEach(async () => { await cleanupTestDatabases() })

  it('executes Live from persisted records, reopens safely, and rejects duplicate execution', async () => {
    const database = await openTestDatabase('phase-5-live')
    const fixture = makeDrawHistoryFixture(['00042', '42', '100'])
    await seedReadyFixture(database, fixture)

    const result = await executeDraw(input(fixture), dependencies(database))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.candidatePoolSnapshot.candidateEntries.map((entry) => entry.ticketNumber)).toEqual(['00042', '100', '42'])
    expect(new Set(result.value.pendingWinners.map((winner) => winner.ticketNumber))).toEqual(new Set(['100', '42']))

    const sessionAfterWrite = await database.draw_sessions.get(fixture.session.id)
    expect(sessionAfterWrite?.status).toBe('pending-confirmation')
    expect(sessionAfterWrite?.configurationSnapshot).not.toBeNull()
    expect(sessionAfterWrite?.candidatePoolSnapshot?.candidateEntries).toHaveLength(3)
    expect(await database.winner_records.count()).toBe(2)
    expect(await database.audit_records.count()).toBe(1)

    database.close()
    await database.openSupported()
    const reopenedWinners = await database.winner_records.toArray()
    expect(new Set(reopenedWinners.map((winner) => winner.ticketNumber))).toEqual(new Set(['100', '42']))
    expect(typeof reopenedWinners[0]?.ticketNumber).toBe('string')
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('pending-confirmation')
    expect((await executeDraw(input(fixture), dependencies(database))).ok).toBe(false)
  })

  it('keeps Practice in memory and leaves a ready official session and history untouched', async () => {
    const database = await openTestDatabase('phase-5-practice')
    const baseFixture = makeDrawHistoryFixture(['00042', '42', '100'])
    const fixture = { ...baseFixture, session: { ...baseFixture.session, mode: 'practice' as const } }
    await seedReadyFixture(database, fixture)
    const before = await database.draw_sessions.get(fixture.session.id)

    const result = await executeDraw(input(fixture, 'practice'), dependencies(database))
    expect(result.ok).toBe(true)
    expect(await database.winner_records.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
    expect(await database.draw_sessions.get(fixture.session.id)).toEqual(before)
  })

  it('rolls back all official state when the random source fails', async () => {
    const database = await openTestDatabase('phase-5-rollback')
    const fixture = makeDrawHistoryFixture(['00042', '42', '100'])
    await seedReadyFixture(database, fixture)
    const failingRandom: RandomSource = { nextUint32: () => { throw new Error('test random failure') } }

    const result = await executeDraw(input(fixture), dependencies(database, failingRandom))
    expect(result.ok).toBe(false)
    expect(await database.draw_sessions.get(fixture.session.id)).toEqual(fixture.session)
    expect(await database.winner_records.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
    expect((await database.draw_sessions.get(fixture.session.id))?.configurationSnapshot).toBeNull()
  })
})
