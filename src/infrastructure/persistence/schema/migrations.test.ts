import Dexie from 'dexie'
import {
  IDBKeyRange,
  indexedDB,
} from 'fake-indexeddb'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import { SchemaMigrationError } from '../errors/persistence-errors.ts'
import {
  CURRENT_SUPPORTED_SCHEMA_VERSION,
  PERSISTENCE_MIGRATIONS,
  registerPersistenceMigrations,
  type PersistenceMigration,
} from './migrations.ts'
import {
  SCHEMA_V1,
  SCHEMA_V1_STORE_NAMES,
  SCHEMA_VERSION_1,
  SCHEMA_V2,
  SCHEMA_VERSION_2,
  SCHEMA_V3,
  SCHEMA_VERSION_3,
  SCHEMA_V4,
  SCHEMA_VERSION_4,
  SCHEMA_V5,
  SCHEMA_VERSION_5,
} from './schema-v1.ts'

const openedDatabases = new Set<Dexie>()
const testDatabaseNames = new Set<string>()

function uniqueDatabaseName(label: string): string {
  return `raffle-os-migration-${label}-${crypto.randomUUID()}`
}

function createDexie(name: string): Dexie {
  const database = new Dexie(name, {
    autoOpen: false,
    IDBKeyRange,
    indexedDB,
  })
  openedDatabases.add(database)
  testDatabaseNames.add(name)
  return database
}

afterEach(async () => {
  for (const database of openedDatabases) {
    database.close()
  }

  for (const name of testDatabaseNames) {
    const cleanupDatabase = new Dexie(name, {
      autoOpen: false,
      IDBKeyRange,
      indexedDB,
    })
    await cleanupDatabase.delete()
    cleanupDatabase.close()
  }

  openedDatabases.clear()
  testDatabaseNames.clear()
})

describe('centralized persistence migrations', () => {
  it('defines the current supported application schema as Version 2', () => {
    expect(SCHEMA_VERSION_1).toBe(1)
    expect(SCHEMA_VERSION_2).toBe(2)
    expect(SCHEMA_VERSION_3).toBe(3)
    expect(SCHEMA_VERSION_4).toBe(4)
    expect(SCHEMA_VERSION_5).toBe(5)
    expect(CURRENT_SUPPORTED_SCHEMA_VERSION).toBe(5)
  })

  it('centralizes the exact Version 1 store contract', () => {
    expect(PERSISTENCE_MIGRATIONS).toHaveLength(5)
    expect(PERSISTENCE_MIGRATIONS[0]).toEqual({
      stores: SCHEMA_V1,
      version: 1,
    })
    expect(PERSISTENCE_MIGRATIONS[1]).toEqual({ stores: SCHEMA_V2, version: 2 })
    expect(PERSISTENCE_MIGRATIONS[2]).toEqual({ stores: SCHEMA_V3, version: 3 })
    expect(PERSISTENCE_MIGRATIONS[3]).toEqual({ stores: SCHEMA_V4, version: 4 })
    expect(PERSISTENCE_MIGRATIONS[4]?.stores).toEqual(SCHEMA_V5)
    expect(PERSISTENCE_MIGRATIONS[4]?.version).toBe(5)
    expect(Object.keys(SCHEMA_V1).sort()).toEqual(
      [...SCHEMA_V1_STORE_NAMES].sort(),
    )
    expect(SCHEMA_V1).toEqual({
      audit_records:
        'id, eventId, action, timestamp, [eventId+timestamp]',
      display_configurations: 'id, &eventId',
      draw_configurations: 'id, eventId, prizeCategoryId',
      draw_sessions:
        'id, eventId, configurationId, mode, status, createdAt',
      events: 'id, name, status, createdAt',
      participants:
        'id, eventId, ticketNumber, &[eventId+ticketNumber], isCheckedIn, group',
      preferences: 'key',
      prize_categories: 'id, eventId, displayOrder',
      redraw_records:
        'id, eventId, drawSessionId, &originalWinnerRecordId, replacementWinnerRecordId, createdAt',
      winner_records:
        'id, eventId, prizeCategoryId, drawSessionId, participantId, ticketNumber, status, sequenceNumber, &[drawSessionId+sequenceNumber], [eventId+status], [eventId+prizeCategoryId+status]',
    })
  })

  it('registers Version 2 without inventing a Version 0 data migration', async () => {
    const database = createDexie(uniqueDatabaseName('version-one'))

    registerPersistenceMigrations(database)

    expect(
      PERSISTENCE_MIGRATIONS.some(
        (migration) => migration.version === 0,
      ),
    ).toBe(false)
    expect(PERSISTENCE_MIGRATIONS[0]?.upgrade).toBeUndefined()

    await database.open()
    expect(database.verno).toBe(5)
    expect(database.tables.map((table) => table.name).sort()).toEqual(
      [...SCHEMA_V1_STORE_NAMES, 'presentation_checkpoints', 'command_receipts', 'event_settings'].sort(),
    )
  })

  it('provides an explicit tested boundary for a future forward migration', async () => {
    const name = uniqueDatabaseName('future-boundary')
    const versionOneDatabase = createDexie(name)
    registerPersistenceMigrations(versionOneDatabase)
    await versionOneDatabase.open()
    await versionOneDatabase.table('events').add({
      createdAt: '2026-07-30T12:30:45.000Z',
      id: '40000000-0000-4000-8000-000000000001',
      name: 'Preserved Event',
      status: 'draft',
      updatedAt: '2026-07-30T12:30:45.000Z',
    })
    versionOneDatabase.close()

    let upgradeCalls = 0
    const futureMigrations: readonly PersistenceMigration[] = [
      ...PERSISTENCE_MIGRATIONS,
      {
        stores: {
          ...SCHEMA_V1,
          ...SCHEMA_V2,
          ...SCHEMA_V3,
          ...SCHEMA_V4,
          migration_test_sentinel: 'id',
        },
        upgrade: async (transaction) => {
          upgradeCalls += 1
          await transaction.table('migration_test_sentinel').add({
            id: 'v2-upgrade-ran',
          })
        },
        version: 6,
      },
    ]
    const versionTwoDatabase = createDexie(name)
    registerPersistenceMigrations(
      versionTwoDatabase,
      futureMigrations,
    )

    await versionTwoDatabase.open()

    expect(versionTwoDatabase.verno).toBe(6)
    expect(upgradeCalls).toBe(1)
    expect(
      await versionTwoDatabase.table('events').get(
        '40000000-0000-4000-8000-000000000001',
      ),
    ).toMatchObject({ name: 'Preserved Event' })
    expect(
      await versionTwoDatabase
        .table('migration_test_sentinel')
        .get('v2-upgrade-ran'),
    ).toEqual({ id: 'v2-upgrade-ran' })
  })

  it('rejects unordered or non-positive migration registrations', () => {
    const database = createDexie(uniqueDatabaseName('invalid-order'))
    const invalidMigrations: readonly PersistenceMigration[] = [
      { stores: SCHEMA_V1, version: 1 },
      { stores: SCHEMA_V1, version: 1 },
    ]

    expect(() =>
      registerPersistenceMigrations(database, invalidMigrations),
    ).toThrow(SchemaMigrationError)
  })
})
