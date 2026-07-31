import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import {
  RaffleOSDatabase,
} from '../db.ts'
import {
  DatabaseUnavailableError,
  ImmutableRecordError,
  RelationshipMismatchError,
  ValidationError,
} from '../errors/persistence-errors.ts'
import {
  getStandardSeedAuditRecords,
  getStandardSeedDisplayConfigurations,
  getStandardSeedDrawConfigurations,
  getStandardSeedDrawSession,
  getStandardSeedEvents,
  getStandardSeedParticipants,
  getStandardSeedPrizeCategories,
  getStandardSeedRedrawRecord,
  getStandardSeedWinners,
  SEED_EVENT_IDS,
  SEED_ISO_TIMESTAMPS,
} from './dev-seed-fixtures.ts'
import {
  DEFAULT_CAPACITY_PARTICIPANT_COUNT,
  seedDevelopmentDatabase,
} from './dev-seed.ts'
import { resetDatabase } from './reset-db.ts'
import { writeValidatedSeedDataset } from './seed-transaction-writer.ts'
import type { Participant } from '../../../domain/participants/participant.types.ts'
import type {
  DrawConfigurationId,
  DrawSessionId,
  EventId,
  ParticipantId,
  RedrawRecordId,
  WinnerRecordId,
} from '../../../domain/shared/identifiers.ts'

describe('Development Seed and Guarded Reset', () => {
  let dbCounter = 0

  function createTestDb(): RaffleOSDatabase {
    dbCounter += 1
    return new RaffleOSDatabase(`RaffleOS_TestSeed_${Date.now()}_${dbCounter}`, {
      IDBKeyRange,
      indexedDB,
    })
  }

  async function expectAllVersionOneStoresEmpty(
    database: RaffleOSDatabase,
  ): Promise<void> {
    const counts = await Promise.all([
      database.events.count(),
      database.participants.count(),
      database.prize_categories.count(),
      database.draw_configurations.count(),
      database.display_configurations.count(),
      database.draw_sessions.count(),
      database.winner_records.count(),
      database.redraw_records.count(),
      database.audit_records.count(),
      database.preferences.count(),
    ])

    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  }
  describe('Import and Startup Isolation', () => {
    it('importing dev-seed or reset-db does not instantiate or open RaffleOS_DB', async () => {
      const databases = await indexedDB.databases()
      expect(databases.find((d) => d.name === 'RaffleOS_DB')).toBeUndefined()
    })
  })

  describe('Standard Seed', () => {
    it('seeds an empty database with representative records across all ten Version 1 stores', async () => {
      const db = createTestDb()
      await db.openSupported()

      const result = await seedDevelopmentDatabase({ database: db })

      expect(result.profile).toBe('standard')
      expect(result.counts).toEqual({
        audit_records: 2,
        display_configurations: 2,
        draw_configurations: 1,
        draw_sessions: 1,
        events: 2,
        participants: 20,
        preferences: 2,
        prize_categories: 2,
        redraw_records: 1,
        winner_records: 3,
      })

      // Verify store counts directly
      expect(await db.events.count()).toBe(2)
      expect(await db.participants.count()).toBe(20)
      expect(await db.prize_categories.count()).toBe(2)
      expect(await db.draw_configurations.count()).toBe(1)
      expect(await db.display_configurations.count()).toBe(2)
      expect(await db.draw_sessions.count()).toBe(1)
      expect(await db.winner_records.count()).toBe(3)
      expect(await db.redraw_records.count()).toBe(1)
      expect(await db.audit_records.count()).toBe(2)
      expect(await db.preferences.count()).toBe(2)

      // Verify string ticket numbers with exact leading zeroes
      const participant1 = await db.participants.get('66666666-6666-4666-8666-000000000001' as ParticipantId)
      expect(participant1?.ticketNumber).toBe('000001')
      expect(typeof participant1?.ticketNumber).toBe('string')

      // Verify DisplayConfigurations are pure-black
      const displays = await db.display_configurations.toArray()
      for (const display of displays) {
        expect(display.blackoutAppearance).toBe('pure-black')
      }

      // Verify DrawSession immutable snapshots
      const session = await db.draw_sessions.get('77777777-7777-4777-8777-777777777777' as DrawSessionId)
      expect(session?.configurationSnapshot?.winningRule).toBe('once-per-event')
      expect(session?.candidatePoolSnapshot?.candidateEntries.length).toBe(20)

      // Verify RedrawRecord lineage
      const redraw = await db.redraw_records.get('99999999-9999-4999-8999-999999999999' as RedrawRecordId)
      expect(redraw?.originalWinnerRecordId).toBe('88888888-8888-4888-8888-888888888882')
      expect(redraw?.replacementWinnerRecordId).toBe('88888888-8888-4888-8888-888888888883')

      db.close()
    })

    it('refuses to seed when any store already contains data', async () => {
      const db = createTestDb()
      await db.openSupported()

      // Insert one event first
      await db.events.add({
        createdAt: SEED_ISO_TIMESTAMPS.t0,
        description: 'Existing event',
        id: SEED_EVENT_IDS.draft,
        name: 'Existing Event',
        status: 'draft',
        updatedAt: SEED_ISO_TIMESTAMPS.t0,
      })

      await expect(seedDevelopmentDatabase({ database: db })).rejects.toThrow(
        ImmutableRecordError,
      )

      // Ensure no other store was mutated
      expect(await db.events.count()).toBe(1)
      expect(await db.participants.count()).toBe(0)
      expect(await db.prize_categories.count()).toBe(0)

      db.close()
    })

    it('produces deterministic output across multiple separate empty databases', async () => {
      const db1 = createTestDb()
      const db2 = createTestDb()
      await db1.openSupported()
      await db2.openSupported()

      const res1 = await seedDevelopmentDatabase({ database: db1 })
      const res2 = await seedDevelopmentDatabase({ database: db2 })

      expect(res1.counts).toEqual(res2.counts)

      const events1 = await db1.events.toArray()
      const events2 = await db2.events.toArray()
      expect(events1).toEqual(events2)

      db1.close()
      db2.close()
    })
  })

  describe('Capacity Seed', () => {
    it('seeds capacity profile generating exact leading-zero ticket strings up to target count', async () => {
      const db = createTestDb()
      await db.openSupported()

      const res = await seedDevelopmentDatabase({
        database: db,
        participantCount: 50,
        profile: 'capacity',
      })

      expect(res.profile).toBe('capacity')
      expect(res.counts.participants).toBe(50)
      expect(res.counts.events).toBe(1)

      const firstParticipant = await db.participants.get('c0000000-0000-4000-8000-000000000001' as ParticipantId)
      expect(firstParticipant?.ticketNumber).toBe('000001')

      const lastParticipant = await db.participants.get('c0000000-0000-4000-8000-000000000050' as ParticipantId)
      expect(lastParticipant?.ticketNumber).toBe('000050')

      db.close()
    })

    it('has default capacity target constant set to 10,000', () => {
      expect(DEFAULT_CAPACITY_PARTICIPANT_COUNT).toBe(10000)
    })
  })

  describe('Official History Relationship & Invariant Rejection Tests', () => {
    it('rolls back all ten stores when configuration snapshot source ID mismatches configuration', async () => {
      const db = createTestDb()
      await db.openSupported()

      const events = getStandardSeedEvents()
      const prizeCategories = getStandardSeedPrizeCategories()
      const drawConfigurations = getStandardSeedDrawConfigurations()
      const displayConfigurations = getStandardSeedDisplayConfigurations()
      const participants = getStandardSeedParticipants()
      const drawSession = getStandardSeedDrawSession()
      const winners = getStandardSeedWinners()
      const redrawRecord = getStandardSeedRedrawRecord()
      const auditRecords = getStandardSeedAuditRecords()

      // Corrupt snapshot source ID
      const invalidDrawSession = {
        ...drawSession,
        configurationSnapshot: {
          ...drawSession.configurationSnapshot!,
          configurationId: '99999999-9999-4999-8999-999999999999' as DrawConfigurationId,
        },
      }

      await expect(
        db.transaction(
          'rw',
          [
            db.events,
            db.participants,
            db.prize_categories,
            db.draw_configurations,
            db.display_configurations,
            db.draw_sessions,
            db.winner_records,
            db.redraw_records,
            db.audit_records,
            db.preferences,
          ],
          async () => {
            await writeValidatedSeedDataset(db, {
              auditRecords,
              displayConfigurations,
              drawConfigurations,
              drawSession: invalidDrawSession,
              events,
              participants,
              prizeCategories,
              redrawRecord,
              winners,
            })
          },
        ),
      ).rejects.toThrow(RelationshipMismatchError)

      await expectAllVersionOneStoresEmpty(db)

      db.close()
    })

    it('rolls back all ten stores when candidate pool ticket mismatches Participant ticket', async () => {
      const db = createTestDb()
      await db.openSupported()

      const events = getStandardSeedEvents()
      const prizeCategories = getStandardSeedPrizeCategories()
      const drawConfigurations = getStandardSeedDrawConfigurations()
      const displayConfigurations = getStandardSeedDisplayConfigurations()
      const participants = getStandardSeedParticipants()
      const drawSession = getStandardSeedDrawSession()

      const invalidDrawSession = {
        ...drawSession,
        candidatePoolSnapshot: {
          ...drawSession.candidatePoolSnapshot!,
          candidateEntries:
            drawSession.candidatePoolSnapshot!.candidateEntries.map(
              (candidate, index) =>
                index === 0
                  ? {
                      ...candidate,
                      ticketNumber:
                        'MISMATCH_TICKET' as Participant['ticketNumber'],
                    }
                  : candidate,
            ),
        },
      }

      await expect(
        db.transaction(
          'rw',
          [
            db.events,
            db.participants,
            db.prize_categories,
            db.draw_configurations,
            db.display_configurations,
            db.draw_sessions,
            db.winner_records,
            db.redraw_records,
            db.audit_records,
            db.preferences,
          ],
          async () => {
            await writeValidatedSeedDataset(db, {
              displayConfigurations,
              drawConfigurations,
              drawSession: invalidDrawSession,
              events,
              participants,
              prizeCategories,
            })
          },
        ),
      ).rejects.toThrow(RelationshipMismatchError)

      await expectAllVersionOneStoresEmpty(db)

      db.close()
    })

    it('rolls back all ten stores when WinnerRecord is absent from candidate pool snapshot', async () => {
      const db = createTestDb()
      await db.openSupported()

      const events = getStandardSeedEvents()
      const prizeCategories = getStandardSeedPrizeCategories()
      const drawConfigurations = getStandardSeedDrawConfigurations()
      const displayConfigurations = getStandardSeedDisplayConfigurations()
      const participants = getStandardSeedParticipants()
      const drawSession = getStandardSeedDrawSession()
      const winners = getStandardSeedWinners()

      const candidateEntries =
        drawSession.candidatePoolSnapshot!.candidateEntries.filter(
          (candidate) =>
            candidate.participantId !== winners[0].participantId,
        )
      const invalidDrawSession = {
        ...drawSession,
        candidatePoolSnapshot: {
          ...drawSession.candidatePoolSnapshot!,
          candidateEntries,
          eligibleSnapshotCount: candidateEntries.length,
        },
      }

      await expect(
        db.transaction(
          'rw',
          [
            db.events,
            db.participants,
            db.prize_categories,
            db.draw_configurations,
            db.display_configurations,
            db.draw_sessions,
            db.winner_records,
            db.redraw_records,
            db.audit_records,
            db.preferences,
          ],
          async () => {
            await writeValidatedSeedDataset(db, {
              displayConfigurations,
              drawConfigurations,
              drawSession: invalidDrawSession,
              events,
              participants,
              prizeCategories,
              winners,
            })
          },
        ),
      ).rejects.toThrow(RelationshipMismatchError)

      await expectAllVersionOneStoresEmpty(db)

      db.close()
    })

    it('rolls back all ten stores when RedrawRecord lineage is invalid', async () => {
      const db = createTestDb()
      await db.openSupported()

      const events = getStandardSeedEvents()
      const prizeCategories = getStandardSeedPrizeCategories()
      const drawConfigurations = getStandardSeedDrawConfigurations()
      const displayConfigurations = getStandardSeedDisplayConfigurations()
      const participants = getStandardSeedParticipants()
      const drawSession = getStandardSeedDrawSession()
      const winners = getStandardSeedWinners()
      const redrawRecord = getStandardSeedRedrawRecord()

      const invalidRedraw = {
        ...redrawRecord,
        originalWinnerRecordId: '00000000-0000-4000-8000-000000000000' as WinnerRecordId, // Invalid ID
      }

      await expect(
        db.transaction(
          'rw',
          [
            db.events,
            db.participants,
            db.prize_categories,
            db.draw_configurations,
            db.display_configurations,
            db.draw_sessions,
            db.winner_records,
            db.redraw_records,
            db.audit_records,
            db.preferences,
          ],
          async () => {
            await writeValidatedSeedDataset(db, {
              displayConfigurations,
              drawConfigurations,
              drawSession,
              events,
              participants,
              prizeCategories,
              redrawRecord: invalidRedraw,
              winners,
            })
          },
        ),
      ).rejects.toThrow(RelationshipMismatchError)

      await expectAllVersionOneStoresEmpty(db)

      db.close()
    })

    it('rolls back all ten stores when AuditRecord belongs to another Event', async () => {
      const db = createTestDb()
      await db.openSupported()

      const events = getStandardSeedEvents()
      const prizeCategories = getStandardSeedPrizeCategories()
      const drawConfigurations = getStandardSeedDrawConfigurations()
      const displayConfigurations = getStandardSeedDisplayConfigurations()
      const participants = getStandardSeedParticipants()
      const auditRecords = getStandardSeedAuditRecords()

      const invalidAuditRecords = [
        {
          ...auditRecords[0],
          eventId: '00000000-0000-4000-8000-000000000000' as EventId,
        },
      ]

      await expect(
        db.transaction(
          'rw',
          [
            db.events,
            db.participants,
            db.prize_categories,
            db.draw_configurations,
            db.display_configurations,
            db.draw_sessions,
            db.winner_records,
            db.redraw_records,
            db.audit_records,
            db.preferences,
          ],
          async () => {
            await writeValidatedSeedDataset(db, {
              auditRecords: invalidAuditRecords,
              displayConfigurations,
              drawConfigurations,
              events,
              participants,
              prizeCategories,
            })
          },
        ),
      ).rejects.toThrow(RelationshipMismatchError)

      await expectAllVersionOneStoresEmpty(db)

      db.close()
    })
  })

  describe('Guarded Database Reset', () => {
    it('deletes the exact named database when confirmation is valid', async () => {
      const db = createTestDb()
      await db.openSupported()
      await seedDevelopmentDatabase({ database: db })

      const result = await resetDatabase({
        confirmation: {
          acknowledgePermanentDataLoss: true,
          confirmationText: `DELETE ${db.name}`,
          databaseName: db.name,
        },
        database: db,
      })

      expect(result).toEqual({
        databaseName: db.name,
        status: 'deleted',
      })
    })

    it('rejects confirmation with wrong database name', async () => {
      const db = createTestDb()
      await db.openSupported()

      await expect(
        resetDatabase({
          confirmation: {
            acknowledgePermanentDataLoss: true,
            confirmationText: `DELETE ${db.name}`,
            databaseName: 'Wrong_DB_Name',
          },
          database: db,
        }),
      ).rejects.toThrow(ValidationError)

      db.close()
    })

    it('rejects confirmation with false acknowledgement', async () => {
      const db = createTestDb()
      await db.openSupported()

      await expect(
        resetDatabase({
          confirmation: {
            acknowledgePermanentDataLoss: false,
            confirmationText: `DELETE ${db.name}`,
            databaseName: db.name,
          },
          database: db,
        }),
      ).rejects.toThrow(ValidationError)

      db.close()
    })

    it('rejects confirmation with wrong case confirmation text', async () => {
      const db = createTestDb()
      await db.openSupported()

      await expect(
        resetDatabase({
          confirmation: {
            acknowledgePermanentDataLoss: true,
            confirmationText: `delete ${db.name}`,
            databaseName: db.name,
          },
          database: db,
        }),
      ).rejects.toThrow(ValidationError)

      db.close()
    })

    it('normalizes blocked deletion safely into DatabaseUnavailableError', async () => {
      const db = createTestDb()
      await db.openSupported()

      // Mock db.delete to throw an unexpected error
      db.delete = (() =>
        Promise.reject(
          new Error('IDB delete blocked'),
        )) as unknown as RaffleOSDatabase['delete']

      await expect(
        resetDatabase({
          confirmation: {
            acknowledgePermanentDataLoss: true,
            confirmationText: `DELETE ${db.name}`,
            databaseName: db.name,
          },
          database: db,
        }),
      ).rejects.toThrow(DatabaseUnavailableError)
    })
  })
})
