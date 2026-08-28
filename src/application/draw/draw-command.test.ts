import { afterEach, describe, expect, it, vi } from 'vitest'
import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { createAuditRecordId, createWinnerRecordId } from '../../domain/shared/identifiers.ts'
import { DexieDrawConfigurationRepository } from '../../infrastructure/persistence/repositories/draw-configuration.repository.ts'
import { DexieDrawSessionRepository } from '../../infrastructure/persistence/repositories/draw-session.repository.ts'
import { DexieEventRepository } from '../../infrastructure/persistence/repositories/event.repository.ts'
import { DexieParticipantRepository } from '../../infrastructure/persistence/repositories/participant.repository.ts'
import { DexiePrizeCategoryRepository } from '../../infrastructure/persistence/repositories/prize-category.repository.ts'
import { DexieWinnerRepository } from '../../infrastructure/persistence/repositories/winner.repository.ts'
import { DexieDrawPersistenceUnitOfWork } from '../../infrastructure/persistence/transactions/dexie-draw-persistence-unit-of-work.ts'
import {
  cleanupTestDatabases,
  makeDrawHistoryFixture,
  openTestDatabase,
  seedReadyFixture,
  TIME_3,
} from '../../infrastructure/persistence/test/draw-history-test-helpers.ts'
import type { RandomSource } from './random-source.ts'
import { executeDraw } from './draw-command.ts'
import type { DrawCommandDependencies } from './draw-command.types.ts'
import { RaffleOSDatabase } from '../../infrastructure/persistence/db.ts'
import { DexieDrawAuthoringUnitOfWork } from '../../infrastructure/persistence/transactions/dexie-draw-authoring-unit-of-work.ts'

afterEach(cleanupTestDatabases)

function source(): RandomSource {
  return { nextUint32: () => 0 }
}

function dependencies(database: Awaited<ReturnType<typeof openTestDatabase>>): DrawCommandDependencies {
  return {
    events: new DexieEventRepository(database),
    configurations: new DexieDrawConfigurationRepository(database),
    categories: new DexiePrizeCategoryRepository(database),
    sessions: new DexieDrawSessionRepository(database),
    participants: new DexieParticipantRepository(database),
    winners: new DexieWinnerRepository(database),
    randomSource: source(),
    persistence: new DexieDrawPersistenceUnitOfWork(database),
    now: () => TIME_3,
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
  } as const
}

describe('executeDraw', () => {
  it('does not select winners when the Live storage preflight is unsafe', async () => {
    const database = await openTestDatabase('command-storage-preflight-failure')
    const fixture = makeDrawHistoryFixture(['00001', '00002'])
    await seedReadyFixture(database, fixture)
    const selectWinners = vi.fn(() => { throw new Error('selection must not run') })

    const result = await executeDraw(input(fixture), {
      ...dependencies(database),
      checkStorageHealth: async () => ({ ok: false as const, code: 'storage-quota-exceeded', reason: 'Storage is full.' }),
      selectWinners,
    })

    expect(result).toMatchObject({ ok: false, error: { kind: 'persistence', code: 'persistence-failed' } })
    expect(selectWinners).not.toHaveBeenCalled()
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('ready')
  })

  it.each([1, 3, 6, 10])('runs a fresh 100-participant Practice Event with %s winner(s)', async (requestedWinners) => {
    const database = await openTestDatabase(`command-fresh-practice-${requestedWinners}`)
    const base = makeDrawHistoryFixture(Array.from({ length: 100 }, (_, index) => String(index + 1).padStart(5, '0')))
    const fixture = {
      ...base,
      event: { ...base.event, status: 'draft' as const },
      configuration: { ...base.configuration, requestedWinners },
      session: { ...base.session, mode: 'practice' as const },
    }
    await seedReadyFixture(database, fixture)
    await new DexieDrawAuthoringUnitOfWork(database).persistReadyAuthoring({ configuration: fixture.configuration, session: fixture.session, existingConfigurationId: fixture.configuration.id, existingSessionId: fixture.session.id })

    const result = await executeDraw(input(fixture, 'practice'), dependencies(database))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.pendingWinners).toHaveLength(requestedWinners)
    expect(result.value.candidatePoolSnapshot.eligibleSnapshotCount).toBe(100)
    expect(result.value.pendingWinners.every((winner) => winner.ticketNumber.length === 5)).toBe(true)
    expect((await database.events.get(fixture.event.id))?.status).toBe('ready')
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('ready')
  })

  it('captures per-draw presentation configuration without changing selection semantics', async () => {
    const database = await openTestDatabase('command-presentation-snapshot')
    const base = makeDrawHistoryFixture(['00042', '42'])
    const fixture = {
      ...base,
      configuration: {
        ...base.configuration,
        presentation: {
          presentationMode: 'random-number-roll' as const,
          rollStopMode: 'timed' as const,
          rollDurationSeconds: 12 as const,
          rollSpeedPerSecond: 18,
          revealMode: 'sequential' as const,
        },
      },
    }
    await seedReadyFixture(database, fixture)

    const result = await executeDraw(input(fixture), dependencies(database))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.configurationSnapshot.presentation).toEqual(fixture.configuration.presentation)
    expect(Object.isFrozen(result.value.configurationSnapshot.presentation)).toBe(true)
    expect(result.value.pendingWinners.map((winner) => winner.ticketNumber)).toEqual(['42', '00042'])
  })

  it('persists one complete Live draw and preserves exact tickets after reopen', async () => {
    const database = await openTestDatabase('command-live')
    const fixture = makeDrawHistoryFixture(['00042', '42'])
    await seedReadyFixture(database, fixture)

    const result = await executeDraw(input(fixture), dependencies(database))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.pendingWinners).toHaveLength(2)
    expect(result.value.pendingWinners.every((winner) => winner.status === 'pending')).toBe(true)
    expect(result.value.pendingWinners.map((winner) => winner.sequenceNumber)).toEqual([1, 2])
    expect(result.value.pendingWinners.map((winner) => winner.ticketNumber)).toEqual(['42', '00042'])

    const session = await database.draw_sessions.get(fixture.session.id)
    const winners = await database.winner_records.where('drawSessionId').equals(fixture.session.id).sortBy('sequenceNumber')
    const audits = await database.audit_records.where('eventId').equals(fixture.event.id).toArray()
    expect(session?.status).toBe('pending-confirmation')
    expect(session?.configurationSnapshot?.requestedWinners).toBe(2)
    expect(session?.candidatePoolSnapshot?.candidateEntries.map((entry) => entry.ticketNumber)).toEqual(['00042', '42'])
    expect(winners.map((winner) => winner.ticketNumber)).toEqual(['42', '00042'])
    expect(audits).toHaveLength(1)
  })

  it('preserves the complete Live draw across a real database reopen', async () => {
    const database = await openTestDatabase('command-reopen')
    const fixture = makeDrawHistoryFixture(['00042', '42'])
    await seedReadyFixture(database, fixture)

    const result = await executeDraw(input(fixture), dependencies(database))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const databaseName = database.name
    database.close()
    const reopened = new RaffleOSDatabase(databaseName, { IDBKeyRange, indexedDB })
    await reopened.openSupported()
    try {
      expect((await reopened.draw_sessions.get(fixture.session.id))?.status).toBe('pending-confirmation')
      expect((await reopened.draw_sessions.get(fixture.session.id))?.configurationSnapshot).toEqual(
        result.value.configurationSnapshot,
      )
      expect((await reopened.draw_sessions.get(fixture.session.id))?.candidatePoolSnapshot?.candidateEntries.map((entry) => entry.ticketNumber)).toEqual(
        ['00042', '42'],
      )
      expect((await reopened.winner_records.where('drawSessionId').equals(fixture.session.id).sortBy('sequenceNumber')).map((winner) => ({
        ticketNumber: winner.ticketNumber,
        status: winner.status,
      }))).toEqual([
        { ticketNumber: '42', status: 'pending' },
        { ticketNumber: '00042', status: 'pending' },
      ])
      expect(await reopened.audit_records.where('eventId').equals(fixture.event.id).count()).toBe(1)
    } finally {
      reopened.close()
    }
  })

  it('returns an in-memory Practice result without official writes', async () => {
    const database = await openTestDatabase('command-practice')
    const fixture = makeDrawHistoryFixture()
    const practiceFixture = { ...fixture, session: { ...fixture.session, mode: 'practice' as const } }
    await seedReadyFixture(database, practiceFixture)
    const deps = dependencies(database)
    const persist = vi.spyOn(deps.persistence, 'persistStartedDraw')

    const result = await executeDraw(input(practiceFixture, 'practice'), deps)

    expect(result.ok).toBe(true)
    expect(persist).not.toHaveBeenCalled()
    expect((await database.draw_sessions.get(practiceFixture.session.id))?.status).toBe('ready')
    expect(await database.winner_records.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
  })

  it('fails duplicate execution without another selection or audit', async () => {
    const database = await openTestDatabase('command-duplicate')
    const fixture = makeDrawHistoryFixture()
    await seedReadyFixture(database, fixture)
    const deps = dependencies(database)

    const first = await executeDraw(input(fixture), deps)
    const second = await executeDraw(input(fixture), deps)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.error.code).toBe('session-not-ready')
    expect(await database.winner_records.count()).toBe(2)
    expect(await database.audit_records.count()).toBe(1)
  })

  it('returns a typed selection failure and does not persist when randomness fails', async () => {
    const database = await openTestDatabase('command-random-fail')
    const fixture = makeDrawHistoryFixture()
    await seedReadyFixture(database, fixture)
    const deps = dependencies(database)
    deps.randomSource.nextUint32 = () => { throw new Error('random unavailable') }
    const persist = vi.spyOn(deps.persistence, 'persistStartedDraw')

    const result = await executeDraw(input(fixture), deps)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('selection')
    expect(persist).not.toHaveBeenCalled()
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('ready')
    expect(await database.winner_records.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
  })
})
