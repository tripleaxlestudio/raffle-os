import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { RaffleOSDatabase } from '../db.ts'
import { ValidationError } from '../errors/persistence-errors.ts'
import { PHASE8_SETUP_DATASETS, readPhase8Setup, resetPhase8Setup, seedPhase8Setup } from './phase8-setup.ts'

describe('Phase 8 product setup datasets', () => {
  let counter = 0
  function database() {
    counter += 1
    return new RaffleOSDatabase(`RaffleOS_Phase8Setup_${Date.now()}_${counter}`, { indexedDB, IDBKeyRange })
  }

  it('publishes the named deterministic dataset contract', () => {
    expect(PHASE8_SETUP_DATASETS.map((item) => item.id)).toEqual(['empty-workspace', 'ready-basic', 'winner-count-matrix', 'lifecycle-history'])
  })

  it('loads ready-basic with exact distinct ticket strings and a display', async () => {
    const db = database()
    const result = await seedPhase8Setup(db, 'ready-basic')
    const tickets = (await db.participants.toArray()).map((participant) => participant.ticketNumber)
    expect(tickets).toContain('00042')
    expect(tickets).toContain('42')
    expect(result.activeEventId).toBe(result.eventIds[0])
    expect(result.displayConfigurationIds).toHaveLength(1)
    db.close()
  })

  it('loads every required winner-count session with enough participants', async () => {
    const db = database()
    const result = await seedPhase8Setup(db, 'winner-count-matrix')
    expect(result.sessionIds).toHaveLength(5)
    expect(result.counts.participants).toBe(60)
    expect((await db.draw_configurations.toArray()).map((item) => item.requestedWinners).sort((left, right) => left - right)).toEqual([1, 6, 10, 20, 50])
    db.close()
  })

  it('loads official lifecycle/history records through validated persistence', async () => {
    const db = database()
    const result = await seedPhase8Setup(db, 'lifecycle-history')
    expect(result.counts.events).toBe(2)
    expect(result.counts.winner_records).toBe(3)
    expect(result.counts.redraw_records).toBe(1)
    expect(result.activeEventId).toBe('22222222-2222-4222-8222-222222222222')
    db.close()
  })

  it('requires exact reset confirmation and supports an empty readback', async () => {
    const db = database()
    await db.openSupported()
    await expect(resetPhase8Setup(db, { databaseName: db.name, acknowledgePermanentDataLoss: false, confirmationText: `DELETE ${db.name}` })).rejects.toBeInstanceOf(ValidationError)
    await resetPhase8Setup(db, { databaseName: db.name, acknowledgePermanentDataLoss: true, confirmationText: `DELETE ${db.name}` })
    const emptyDb = new RaffleOSDatabase(db.name, { indexedDB, IDBKeyRange })
    const result = await readPhase8Setup(emptyDb, 'empty-workspace')
    expect(result.eventIds).toEqual([])
    expect(result.activeEventId).toBeNull()
    emptyDb.close()
  })

  it('does not allow replacing a loaded dataset without reset', async () => {
    const db = database()
    await seedPhase8Setup(db, 'ready-basic')
    await expect(seedPhase8Setup(db, 'winner-count-matrix')).rejects.toThrow('Reset the development database')
    db.close()
  })
})
