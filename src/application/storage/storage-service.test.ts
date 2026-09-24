import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RaffleOSDatabase } from '../../infrastructure/persistence/db.ts'
import {
  createBackup,
  executeReset,
  executeRestore,
  formatBytes,
  generateBackupFilename,
  previewBackup,
  readStorageStatistics,
  validateBackupEnvelope,
} from './storage-service.ts'
import type { KocokanBackupEnvelope } from './storage-types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import type {
  DrawConfigurationId,
  DrawSessionId,
  EventId,
  ParticipantId,
  PrizeCategoryId,
  WinnerRecordId,
} from '../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'

describe('Storage Service (Backup, Restore, Reset, & Statistics)', () => {
  let dbCounter = 0

  function createTestDb(): RaffleOSDatabase {
    dbCounter += 1
    return new RaffleOSDatabase(`RaffleOS_StorageTest_${Date.now()}_${dbCounter}`, {
      IDBKeyRange,
      indexedDB,
    })
  }

  const sampleEvent: Event = {
    id: 'evt-test-1' as EventId,
    name: 'Panggung Seni 2026',
    status: 'ready',
    createdAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp,
    updatedAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp,
  }

  const sampleCategory: PrizeCategory = {
    id: 'cat-test-1' as PrizeCategoryId,
    eventId: sampleEvent.id,
    name: 'Sepeda Motor',
    prizeName: 'Honda Vario 125',
    displayOrder: 1,
    createdAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp,
  }

  const sampleConfig: DrawConfiguration = {
    id: 'cfg-test-1' as DrawConfigurationId,
    eventId: sampleEvent.id,
    prizeCategoryId: sampleCategory.id,
    requestedWinners: 1,
    winningRule: 'once-per-event',
    requireCheckIn: false,
    eligibleGroupFilter: null,
    createdAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp,
    updatedAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp,
  }

  const sampleDisplay: DisplayConfiguration = {
    id: 'disp-test-1' as import('../../domain/shared/identifiers.ts').DisplayConfigurationId,
    eventId: sampleEvent.id,
    targetResolution: { width: 1920, height: 1080 },
    safeAreaMargin: 0,
    blackoutAppearance: 'pure-black',
    createdAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp,
    updatedAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp,
  }

  const sampleParticipants: Participant[] = [
    {
      id: 'pt-1' as ParticipantId,
      eventId: sampleEvent.id,
      ticketNumber: '000123' as import('../../domain/participants/participant.types.ts').TicketNumber,
      name: 'Budi Santoso',
      isCheckedIn: true,
      createdAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp,
      updatedAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp,
    },
    {
      id: 'pt-2' as ParticipantId,
      eventId: sampleEvent.id,
      ticketNumber: '000456' as import('../../domain/participants/participant.types.ts').TicketNumber,
      name: 'Siti Aminah',
      isCheckedIn: false,
      createdAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp,
      updatedAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp,
    },
  ]

  const sampleLiveSession: DrawSession = {
    id: 'session-live-1' as DrawSessionId,
    eventId: sampleEvent.id,
    configurationId: sampleConfig.id,
    mode: 'live',
    status: 'completed',
    createdAt: '2026-09-01T12:00:00.000Z' as IsoTimestamp,
    updatedAt: '2026-09-01T12:05:00.000Z' as IsoTimestamp,
    configurationSnapshot: {
      snapshotFormatVersion: 1,
      configurationId: sampleConfig.id,
      prizeCategoryId: sampleCategory.id,
      categoryName: sampleCategory.name,
      prizeName: sampleCategory.prizeName,
      requestedWinners: 1,
      winningRule: 'once-per-event',
      requireCheckIn: false,
      eligibleGroupFilter: null,
      capturedAt: '2026-09-01T12:00:00.000Z' as IsoTimestamp,
    },
    candidatePoolSnapshot: {
      snapshotFormatVersion: 1,
      eventId: sampleEvent.id,
      configurationId: sampleConfig.id,
      prizeCategoryId: sampleCategory.id,
      mode: 'live',
      capturedAt: '2026-09-01T12:00:00.000Z' as IsoTimestamp,
      winningRule: 'once-per-event',
      requireCheckIn: false,
      eligibleGroupFilter: null,
      eligibleSnapshotCount: 1,
      candidateEntries: [
        { participantId: sampleParticipants[0].id, ticketNumber: sampleParticipants[0].ticketNumber },
      ],
    },
  }

  const samplePracticeSession: DrawSession = {
    id: 'session-practice-1' as DrawSessionId,
    eventId: sampleEvent.id,
    configurationId: sampleConfig.id,
    mode: 'practice',
    status: 'ready',
    createdAt: '2026-09-01T11:00:00.000Z' as IsoTimestamp,
    updatedAt: '2026-09-01T11:00:00.000Z' as IsoTimestamp,
    configurationSnapshot: null,
    candidatePoolSnapshot: null,
  }

  const sampleWinner: WinnerRecord = {
    id: 'win-1' as WinnerRecordId,
    eventId: sampleEvent.id,
    prizeCategoryId: sampleCategory.id,
    drawSessionId: sampleLiveSession.id,
    participantId: sampleParticipants[0].id,
    ticketNumber: '000123' as import('../../domain/participants/participant.types.ts').TicketNumber,
    status: 'confirmed',
    sequenceNumber: 1,
    createdAt: '2026-09-01T12:01:00.000Z' as IsoTimestamp,
    updatedAt: '2026-09-01T12:02:00.000Z' as IsoTimestamp,
    confirmedAt: '2026-09-01T12:02:00.000Z' as IsoTimestamp,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Storage Statistics Tests
  describe('Storage Statistics', () => {
    it('returns zeroes and Ready status on an empty database', async () => {
      const db = createTestDb()
      const stats = await readStorageStatistics(db)

      expect(stats.databaseStatus).toBe('ready')
      expect(stats.eventCount).toBe(0)
      expect(stats.participantCount).toBe(0)
      expect(stats.officialHistoryCount).toBe(0)
      expect(stats.storageBytes).toBe(0)
      expect(stats.formattedStorageSize).toBe('0 B')
    })

    it('accurately counts events, participants, and official Live history excluding Practice', async () => {
      const db = createTestDb()
      await db.openSupported()

      await db.events.add(sampleEvent)
      await db.participants.bulkAdd(sampleParticipants)
      await db.prize_categories.add(sampleCategory)
      await db.draw_configurations.add(sampleConfig)
      await db.draw_sessions.bulkAdd([sampleLiveSession, samplePracticeSession])
      await db.winner_records.add(sampleWinner)

      const stats = await readStorageStatistics(db)
      expect(stats.eventCount).toBe(1)
      expect(stats.participantCount).toBe(2)
      // Practice session must not count towards official history
      expect(stats.officialHistoryCount).toBe(1)
      expect(stats.storageBytes).toBeGreaterThan(100)
      expect(stats.formattedStorageSize).toMatch(/KB|B/)
    })

    it('formats bytes properly across units', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(512)).toBe('512 B')
      expect(formatBytes(1536)).toBe('1.5 KB')
      expect(formatBytes(1048576 * 2.5)).toBe('2.5 MB')
    })
  })

  // 2. Backup Creation Tests
  describe('Backup Creation', () => {
    it('creates versioned envelope preserving leading zero string tickets without mutating DB', async () => {
      const db = createTestDb()
      await db.openSupported()

      await db.events.add(sampleEvent)
      await db.participants.bulkAdd(sampleParticipants)
      await db.draw_sessions.add(sampleLiveSession)
      await db.winner_records.add(sampleWinner)

      const envelope = await createBackup(db, '0.1.0')

      expect(envelope.format).toBe('kocokan-backup')
      expect(envelope.version).toBe(1)
      expect(envelope.appVersion).toBe('0.1.0')
      expect(envelope.data.events).toHaveLength(1)
      expect(envelope.data.participants).toHaveLength(2)

      // Ticket numbers MUST remain string with exact leading zero
      expect(envelope.data.participants[0].ticketNumber).toBe('000123')
      expect(typeof envelope.data.participants[0].ticketNumber).toBe('string')
      expect(envelope.data.winnerRecords[0].ticketNumber).toBe('000123')
      expect(typeof envelope.data.winnerRecords[0].ticketNumber).toBe('string')

      // Verify database was NOT mutated
      expect(await db.events.count()).toBe(1)
      expect(await db.participants.count()).toBe(2)
    })

    it('generates a filesystem-safe backup filename', () => {
      const fixedDate = new Date('2026-09-03T15:45:00.000Z')
      const name = generateBackupFilename(fixedDate)
      expect(name).toMatch(/^Kocokan-Backup-\d{4}-\d{2}-\d{2}-\d{4}\.kocokan\.json$/)
    })
  })

  // 3. Validation Tests
  describe('Backup Envelope Validation', () => {
    it('rejects invalid JSON', () => {
      const result = validateBackupEnvelope('{ broken json')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('JSON')
      }
    })

    it('rejects unrecognized format or unsupported version', () => {
      const wrongFormat = JSON.stringify({ format: 'other', version: 1, createdAt: new Date().toISOString(), data: {} })
      expect(validateBackupEnvelope(wrongFormat).ok).toBe(false)

      const wrongVersion = JSON.stringify({ format: 'kocokan-backup', version: 99, createdAt: new Date().toISOString(), data: {} })
      expect(validateBackupEnvelope(wrongVersion).ok).toBe(false)
    })

    it('rejects numeric or invalid ticket number types', () => {
      const invalidTicketBackup = {
        format: 'kocokan-backup',
        version: 1,
        createdAt: new Date().toISOString(),
        appVersion: '0.1.0',
        data: {
          events: [sampleEvent],
          participants: [
            {
              id: 'pt-num',
              eventId: sampleEvent.id,
              ticketNumber: 123, // Invalid: numeric instead of string!
              name: 'Tester',
            },
          ],
          prizeCategories: [],
          drawConfigurations: [],
          displayConfigurations: [],
          drawSessions: [],
          winnerRecords: [],
          redrawRecords: [],
          auditRecords: [],
          preferences: [],
        },
      }

      const result = validateBackupEnvelope(JSON.stringify(invalidTicketBackup))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('string')
      }
    })

    it('rejects duplicate ticket numbers in the same event', () => {
      const duplicateTicketBackup = {
        format: 'kocokan-backup',
        version: 1,
        createdAt: new Date().toISOString(),
        appVersion: '0.1.0',
        data: {
          events: [sampleEvent],
          participants: [
            { id: 'pt-1', eventId: sampleEvent.id, ticketNumber: '000123' },
            { id: 'pt-2', eventId: sampleEvent.id, ticketNumber: '000123' }, // Duplicate!
          ],
          prizeCategories: [],
          drawConfigurations: [],
          displayConfigurations: [],
          drawSessions: [],
          winnerRecords: [],
          redrawRecords: [],
          auditRecords: [],
          preferences: [],
        },
      }

      const result = validateBackupEnvelope(JSON.stringify(duplicateTicketBackup))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('duplikat')
      }
    })
  })

  // 4. Restore Tests
  describe('Backup Restoration', () => {
    it('restores complete dataset, replacing previous dataset atomically while preserving exact string ticket numbers', async () => {
      const db = createTestDb()
      await db.openSupported()

      // Seed old initial data
      const oldEvent: Event = {
        id: 'evt-old' as EventId,
        name: 'Acara Lama',
        status: 'ready',
        createdAt: '2026-08-01T10:00:00.000Z' as IsoTimestamp,
        updatedAt: '2026-08-01T10:00:00.000Z' as IsoTimestamp,
      }
      await db.events.add(oldEvent)
      expect(await db.events.count()).toBe(1)

      // Create backup envelope with new dataset
      const backupEnvelope: KocokanBackupEnvelope = {
        format: 'kocokan-backup',
        version: 1,
        createdAt: '2026-09-02T10:00:00.000Z',
        appVersion: '0.1.0',
        data: {
          events: [sampleEvent],
          participants: sampleParticipants,
          prizeCategories: [sampleCategory],
          drawConfigurations: [sampleConfig],
          displayConfigurations: [sampleDisplay],
          eventSettings: [],
          drawSessions: [sampleLiveSession],
          winnerRecords: [sampleWinner],
          redrawRecords: [],
          auditRecords: [],
          preferences: [{ key: 'activeEventId', value: sampleEvent.id, updatedAt: '2026-09-02T10:00:00.000Z' as IsoTimestamp }],
          presentationCheckpoints: [],
          commandReceipts: [],
        },
      }

      // Preview summary
      const preview = previewBackup(backupEnvelope)
      expect(preview.eventCount).toBe(1)
      expect(preview.participantCount).toBe(2)
      expect(preview.officialHistoryCount).toBe(1)

      // Execute Restore
      await executeRestore(db, backupEnvelope)

      // Verify old event was replaced
      expect(await db.events.get(oldEvent.id)).toBeUndefined()

      // Verify restored dataset
      const restoredEvent = await db.events.get(sampleEvent.id)
      expect(restoredEvent?.name).toBe('Panggung Seni 2026')

      const restoredParticipants = await db.participants.toArray()
      expect(restoredParticipants).toHaveLength(2)
      expect(restoredParticipants[0].ticketNumber).toBe('000123')
      expect(restoredParticipants[1].ticketNumber).toBe('000456')

      const restoredPref = await db.preferences.get('activeEventId')
      expect(restoredPref?.value).toBe(sampleEvent.id)
    })
  })

  // 5. Reset Tests
  describe('Reset Seluruh Data', () => {
    it('clears all Kocokan domain tables and Kocokan preferences while leaving other keys untouched', async () => {
      const db = createTestDb()
      await db.openSupported()

      await db.events.add(sampleEvent)
      await db.participants.bulkAdd(sampleParticipants)
      await db.draw_sessions.add(sampleLiveSession)
      await db.winner_records.add(sampleWinner)
      await db.preferences.add({ key: 'activeEventId', value: sampleEvent.id, updatedAt: '2026-09-01T10:00:00.000Z' as IsoTimestamp })

      // Mock localStorage with unrelated and related keys
      const mockStorage: Record<string, string> = {
        'kocokan:dummy-cache': '123',
        'raffle-os:sidebar-state': 'open',
        'unrelated-app:auth-token': 'secret-xyz',
      }
      vi.stubGlobal('localStorage', {
        length: 3,
        key: (idx: number) => Object.keys(mockStorage)[idx] ?? null,
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => { mockStorage[k] = v },
        removeItem: (k: string) => { delete mockStorage[k] },
        clear: () => { /* no-op */ },
      })

      // Execute Reset
      await executeReset(db)

      // All tables must be 0
      expect(await db.events.count()).toBe(0)
      expect(await db.participants.count()).toBe(0)
      expect(await db.draw_sessions.count()).toBe(0)
      expect(await db.winner_records.count()).toBe(0)
      expect(await db.preferences.count()).toBe(0)

      // Storage statistics must show 0
      const stats = await readStorageStatistics(db)
      expect(stats.eventCount).toBe(0)
      expect(stats.participantCount).toBe(0)
      expect(stats.officialHistoryCount).toBe(0)

      // Kocokan localStorage keys cleared, unrelated key untouched!
      expect(mockStorage['kocokan:dummy-cache']).toBeUndefined()
      expect(mockStorage['raffle-os:sidebar-state']).toBeUndefined()
      expect(mockStorage['unrelated-app:auth-token']).toBe('secret-xyz')
    })
  })
})
