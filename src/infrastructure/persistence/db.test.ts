import Dexie from 'dexie'
import {
  IDBKeyRange,
  indexedDB,
} from 'fake-indexeddb'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import {
  createMemoryRouter,
  RouterProvider,
} from 'react-router'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type {
  CandidatePoolSnapshot,
  DrawConfigurationSnapshot,
  DrawSession,
} from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import {
  parseTicketNumber,
} from '../../domain/participants/participant.invariants.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { ApplicationPreference } from '../../domain/preferences/application-preference.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import {
  createAuditRecordId,
  createDisplayConfigurationId,
  createDrawConfigurationId,
  createDrawSessionId,
  createEventId,
  createParticipantId,
  createPrizeCategoryId,
  createRedrawRecordId,
  createWinnerRecordId,
} from '../../domain/shared/identifiers.ts'
import type { Result } from '../../domain/shared/result.ts'
import {
  parseIsoTimestamp,
} from '../../domain/shared/timestamps.ts'
import type { RedrawRecord } from '../../domain/winners/redraw.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import {
  DatabaseUnavailableError,
  DuplicateRecordError,
  ImmutableRecordError,
  isUniqueConstraintError,
  normalizeDatabaseOpenError,
  PERSISTENCE_ERROR_CODES,
  PersistenceError,
  RecordNotFoundError,
  RelationshipMismatchError,
  SchemaMigrationError,
  StorageQuotaError,
  TransactionError,
  UnsupportedSchemaVersionError,
  ValidationError,
} from './errors/persistence-errors.ts'
import {
  APPLICATION_SCHEMA_VERSION,
  DEFAULT_DATABASE_NAME,
  RaffleOSDatabase,
} from './db.ts'
import {
  SCHEMA_V1,
  SCHEMA_V1_STORE_NAMES,
  SCHEMA_V2,
  SCHEMA_V3,
} from './schema/schema-v1.ts'

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.value
}

const timestamp = unwrap(
  parseIsoTimestamp('2026-07-30T12:30:45.000Z'),
)
const laterTimestamp = unwrap(
  parseIsoTimestamp('2026-07-30T12:31:45.000Z'),
)

const openedDatabases = new Set<Dexie>()
const testDatabaseNames = new Set<string>()

function uniqueDatabaseName(label: string): string {
  return `raffle-os-${label}-${crypto.randomUUID()}`
}

function trackDatabase<T extends Dexie>(database: T): T {
  openedDatabases.add(database)
  testDatabaseNames.add(database.name)
  return database
}

function createTestDatabase(name = uniqueDatabaseName('db')) {
  return trackDatabase(
    new RaffleOSDatabase(name, {
      IDBKeyRange,
      indexedDB,
    }),
  )
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
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

interface FixtureSet {
  readonly audit: AuditRecord
  readonly configuration: DrawConfiguration
  readonly display: DisplayConfiguration
  readonly event: Event
  readonly originalWinner: WinnerRecord
  readonly participant: Participant
  readonly participantTwo: Participant
  readonly preference: ApplicationPreference<'activeEventId'>
  readonly prize: PrizeCategory
  readonly redraw: RedrawRecord
  readonly replacementWinner: WinnerRecord
  readonly session: DrawSession
}

function createFixtureSet(): FixtureSet {
  const eventId = createEventId()
  const participantId = createParticipantId()
  const participantTwoId = createParticipantId()
  const prizeCategoryId = createPrizeCategoryId()
  const configurationId = createDrawConfigurationId()
  const drawSessionId = createDrawSessionId()
  const originalWinnerId = createWinnerRecordId()
  const replacementWinnerId = createWinnerRecordId()
  const ticketNumber = unwrap(parseTicketNumber('00042'))
  const secondTicketNumber = unwrap(parseTicketNumber('00043'))

  const configurationSnapshot: DrawConfigurationSnapshot = {
    capturedAt: timestamp,
    categoryName: 'Grand Prize',
    configurationId,
    eligibleGroupFilter: null,
    prizeCategoryId,
    prizeName: 'Electric Scooter',
    requestedWinners: 1,
    requireCheckIn: true,
    snapshotFormatVersion: 1,
    winningRule: 'once-per-event',
  }
  const candidatePoolSnapshot: CandidatePoolSnapshot = {
    candidateEntries: [
      { participantId, ticketNumber },
      {
        participantId: participantTwoId,
        ticketNumber: secondTicketNumber,
      },
    ],
    configurationId,
    capturedAt: timestamp,
    eventId,
    eligibleGroupFilter: null,
    eligibleSnapshotCount: 2,
    mode: 'live',
    prizeCategoryId,
    requireCheckIn: true,
    snapshotFormatVersion: 1,
    winningRule: 'once-per-event',
  }
  const originalWinner: WinnerRecord = {
    cancelledAt: laterTimestamp,
    createdAt: timestamp,
    drawSessionId,
    eventId,
    id: originalWinnerId,
    participantId,
    prizeCategoryId,
    sequenceNumber: 1,
    status: 'cancelled',
    ticketNumber,
    updatedAt: laterTimestamp,
  }
  const replacementWinner: WinnerRecord = {
    createdAt: laterTimestamp,
    drawSessionId,
    eventId,
    id: replacementWinnerId,
    participantId: participantTwoId,
    prizeCategoryId,
    sequenceNumber: 2,
    status: 'pending',
    ticketNumber: secondTicketNumber,
    updatedAt: laterTimestamp,
  }

  return {
    audit: {
      action: 'redraw-recorded',
      actor: { type: 'system' },
      detail: {
        originalWinnerRecordId: originalWinner.id,
        replacementWinnerRecordId: replacementWinner.id,
      },
      eventId,
      id: createAuditRecordId(),
      timestamp: laterTimestamp,
    },
    configuration: {
      createdAt: timestamp,
      eligibleGroupFilter: null,
      eventId,
      id: configurationId,
      prizeCategoryId,
      requestedWinners: 1,
      requireCheckIn: true,
      updatedAt: timestamp,
      winningRule: 'once-per-event',
    },
    display: {
      blackoutAppearance: 'pure-black',
      createdAt: timestamp,
      eventId,
      id: createDisplayConfigurationId(),
      safeAreaMargin: 48,
      targetResolution: { height: 1080, width: 1920 },
      updatedAt: timestamp,
    },
    event: {
      createdAt: timestamp,
      id: eventId,
      name: 'Nusantara Tech Gala',
      status: 'live',
      updatedAt: timestamp,
    },
    originalWinner,
    participant: {
      createdAt: timestamp,
      eventId,
      id: participantId,
      isCheckedIn: true,
      ticketNumber,
      updatedAt: timestamp,
    },
    participantTwo: {
      createdAt: timestamp,
      eventId,
      id: participantTwoId,
      isCheckedIn: true,
      ticketNumber: secondTicketNumber,
      updatedAt: timestamp,
    },
    preference: {
      key: 'activeEventId',
      updatedAt: timestamp,
      value: eventId,
    },
    prize: {
      createdAt: timestamp,
      displayOrder: 0,
      eventId,
      id: prizeCategoryId,
      name: 'Grand Prize',
      prizeName: 'Electric Scooter',
    },
    redraw: {
      createdAt: laterTimestamp,
      drawSessionId,
      eventId,
      id: createRedrawRecordId(),
      originalWinnerRecordId: originalWinner.id,
      reason: 'absent',
      replacementWinnerRecordId: replacementWinner.id,
    },
    replacementWinner,
    session: {
      candidatePoolSnapshot,
      configurationId,
      configurationSnapshot,
      createdAt: timestamp,
      eventId,
      id: drawSessionId,
      mode: 'live',
      status: 'drawing',
      updatedAt: timestamp,
    },
  }
}

async function writeFixtureSet(
  database: RaffleOSDatabase,
  fixtures: FixtureSet,
) {
  await database.events.add(fixtures.event)
  await database.participants.bulkAdd([
    fixtures.participant,
    fixtures.participantTwo,
  ])
  await database.prize_categories.add(fixtures.prize)
  await database.draw_configurations.add(fixtures.configuration)
  await database.display_configurations.add(fixtures.display)
  await database.draw_sessions.add(fixtures.session)
  await database.winner_records.bulkAdd([
    fixtures.originalWinner,
    fixtures.replacementWinner,
  ])
  await database.redraw_records.add(fixtures.redraw)
  await database.audit_records.add(fixtures.audit)
  await database.preferences.add(fixtures.preference)
}

describe('RaffleOS database construction and Schema Version 1', () => {
  it('uses the production defaults without constructing a singleton', () => {
    expect(DEFAULT_DATABASE_NAME).toBe('RaffleOS_DB')
    expect(APPLICATION_SCHEMA_VERSION).toBe(3)
  })

  it('does not open on construction and accepts a custom database name', async () => {
    const openSpy = vi.spyOn(indexedDB, 'open')
    const name = uniqueDatabaseName('construction')
    const database = createTestDatabase(name)

    expect(database.name).toBe(name)
    expect(database.isOpen()).toBe(false)
    expect(openSpy).not.toHaveBeenCalled()

    await database.openSupported()

    expect(database.isOpen()).toBe(true)
    expect(openSpy).toHaveBeenCalledTimes(1)
  })

  it('uses available browser-style globals when no dependencies are injected', async () => {
    const originalDependencies = Dexie.dependencies
    const name = uniqueDatabaseName('browser-defaults')

    vi.stubGlobal('indexedDB', indexedDB)
    vi.stubGlobal('IDBKeyRange', IDBKeyRange)
    Dexie.dependencies = { indexedDB, IDBKeyRange }

    try {
      const database = trackDatabase(new RaffleOSDatabase(name))

      await database.openSupported()

      expect(database.isOpen()).toBe(true)
    } finally {
      Dexie.dependencies = originalDependencies
    }
  })

  it('reports a typed unavailable error when IndexedDB is missing', async () => {
    vi.stubGlobal('indexedDB', undefined)

    const database = trackDatabase(
      new RaffleOSDatabase(uniqueDatabaseName('missing-indexeddb')),
    )

    await expect(database.openSupported()).rejects.toBeInstanceOf(
      DatabaseUnavailableError,
    )
    expect(database.isOpen()).toBe(false)
  })

  it('opens with explicitly injected fake-indexeddb dependencies', async () => {
    const database = createTestDatabase(
      uniqueDatabaseName('explicit-dependencies'),
    )

    await expect(database.openSupported()).resolves.toBe(database)
    expect(database.isOpen()).toBe(true)
  })

  it('opens Version 2 with all Version 1 stores plus the checkpoint store', async () => {
    const database = createTestDatabase()
    await database.openSupported()

    const dexieStores = database.tables
      .map((table) => table.name)
      .sort()
    const nativeStores = Array.from(
      database.backendDB().objectStoreNames,
    ).sort()
    const expectedStores = [...SCHEMA_V1_STORE_NAMES, 'presentation_checkpoints', 'command_receipts'].sort()

    expect(database.verno).toBe(3)
    expect(dexieStores).toEqual(expectedStores)
    expect(nativeStores).toEqual(expectedStores)
  })

  it('registers every exact primary key, index name, and uniqueness flag', async () => {
    const database = createTestDatabase()
    await database.openSupported()

    const expected = {
      audit_records: [
        ['eventId', false],
        ['action', false],
        ['timestamp', false],
        ['[eventId+timestamp]', false],
      ],
      display_configurations: [['eventId', true]],
      draw_configurations: [
        ['eventId', false],
        ['prizeCategoryId', false],
      ],
      draw_sessions: [
        ['eventId', false],
        ['configurationId', false],
        ['mode', false],
        ['status', false],
        ['createdAt', false],
      ],
      events: [
        ['name', false],
        ['status', false],
        ['createdAt', false],
      ],
      participants: [
        ['eventId', false],
        ['ticketNumber', false],
        ['[eventId+ticketNumber]', true],
        ['isCheckedIn', false],
        ['group', false],
      ],
      preferences: [],
      prize_categories: [
        ['eventId', false],
        ['displayOrder', false],
      ],
      redraw_records: [
        ['eventId', false],
        ['drawSessionId', false],
        ['originalWinnerRecordId', true],
        ['replacementWinnerRecordId', false],
        ['createdAt', false],
      ],
      winner_records: [
        ['eventId', false],
        ['prizeCategoryId', false],
        ['drawSessionId', false],
        ['participantId', false],
        ['ticketNumber', false],
        ['status', false],
        ['sequenceNumber', false],
        ['[drawSessionId+sequenceNumber]', true],
        ['[eventId+status]', false],
        ['[eventId+prizeCategoryId+status]', false],
      ],
    } as const

    for (const storeName of SCHEMA_V1_STORE_NAMES) {
      const schema = database.table(storeName).schema
      const indexes = schema.indexes.map((index) => [
        index.name,
        index.unique === true,
      ])

      expect(schema.primKey.name, storeName).toBe(
        storeName === 'preferences' ? 'key' : 'id',
      )
      expect(indexes, storeName).toEqual(expected[storeName])
    }
  })

  it('closes and deletes an isolated database cleanly', async () => {
    const name = uniqueDatabaseName('cleanup')
    const database = createTestDatabase(name)
    await database.openSupported()
    database.close()

    await database.delete()

    expect(await indexedDB.databases()).not.toContainEqual(
      expect.objectContaining({ name }),
    )
  })
})

describe('Schema Version 1 uniqueness and round trips', () => {
  it('preserves "00042", scopes ticket uniqueness by Event, and supports compound lookup', async () => {
    const database = createTestDatabase()
    const fixtures = createFixtureSet()
    const secondEvent: Event = {
      ...fixtures.event,
      id: createEventId(),
      name: 'Second Event',
    }
    await database.openSupported()
    await database.events.bulkAdd([fixtures.event, secondEvent])
    await database.participants.add(fixtures.participant)

    let duplicateError: unknown
    try {
      await database.participants.add({
        ...fixtures.participant,
        id: createParticipantId(),
      })
    } catch (error: unknown) {
      duplicateError = error
    }

    expect(isUniqueConstraintError(duplicateError)).toBe(true)

    const otherEventParticipant: Participant = {
      ...fixtures.participant,
      eventId: secondEvent.id,
      id: createParticipantId(),
    }
    await database.participants.add(otherEventParticipant)

    const found = await database.participants
      .where('[eventId+ticketNumber]')
      .equals([
        fixtures.event.id,
        fixtures.participant.ticketNumber,
      ])
      .first()

    expect(found?.id).toBe(fixtures.participant.id)
    expect(found?.ticketNumber).toBe('00042')
    expect(typeof found?.ticketNumber).toBe('string')
    expect(
      await database.participants.get(otherEventParticipant.id),
    ).toMatchObject({ ticketNumber: '00042' })
  })

  it('keeps winner sequence positions unique only within a DrawSession', async () => {
    const database = createTestDatabase()
    const fixtures = createFixtureSet()
    await database.openSupported()

    const otherSessionWinner: WinnerRecord = {
      ...fixtures.originalWinner,
      drawSessionId: createDrawSessionId(),
      id: createWinnerRecordId(),
    }
    await database.winner_records.bulkAdd([
      fixtures.originalWinner,
      otherSessionWinner,
    ])

    let duplicateError: unknown
    try {
      await database.winner_records.add({
        ...fixtures.originalWinner,
        id: createWinnerRecordId(),
        participantId: createParticipantId(),
      })
    } catch (error: unknown) {
      duplicateError = error
    }

    expect(isUniqueConstraintError(duplicateError)).toBe(true)
    expect(
      await database.winner_records.get(fixtures.originalWinner.id),
    ).toEqual(fixtures.originalWinner)
    expect(await database.winner_records.count()).toBe(2)
  })

  it('allows one pure-black DisplayConfiguration per Event', async () => {
    const database = createTestDatabase()
    const fixtures = createFixtureSet()
    await database.openSupported()
    await database.display_configurations.add(fixtures.display)

    let duplicateError: unknown
    try {
      await database.display_configurations.add({
        ...fixtures.display,
        id: createDisplayConfigurationId(),
      })
    } catch (error: unknown) {
      duplicateError = error
    }

    expect(isUniqueConstraintError(duplicateError)).toBe(true)
    expect(
      await database.display_configurations.get(fixtures.display.id),
    ).toMatchObject({
      blackoutAppearance: 'pure-black',
      eventId: fixtures.event.id,
    })
  })

  it('survives close and reopen with every store and leading-zero ticket intact', async () => {
    const name = uniqueDatabaseName('reopen')
    const fixtures = createFixtureSet()
    const database = createTestDatabase(name)
    await database.openSupported()
    await writeFixtureSet(database, fixtures)
    database.close()

    const reopened = createTestDatabase(name)
    await reopened.openSupported()

    expect(
      await reopened.participants.get(fixtures.participant.id),
    ).toMatchObject({
      eventId: fixtures.event.id,
      ticketNumber: '00042',
    })
    expect(
      await reopened.display_configurations.get(fixtures.display.id),
    ).toMatchObject({ blackoutAppearance: 'pure-black' })
    expect(
      await reopened.draw_sessions.get(fixtures.session.id),
    ).toMatchObject({
      candidatePoolSnapshot: {
        candidateEntries: [
          expect.objectContaining({ ticketNumber: '00042' }),
          expect.objectContaining({ ticketNumber: '00043' }),
        ],
      },
    })

    for (const storeName of SCHEMA_V1_STORE_NAMES) {
      expect(
        await reopened.table(storeName).count(),
        storeName,
      ).toBeGreaterThan(0)
    }
  })
})

describe('safe open boundary and persistence errors', () => {
  it('normalizes a newer database VersionError without deleting, downgrading, or changing sentinel data', async () => {
    const name = uniqueDatabaseName('newer-version')
    const newerDatabase = trackDatabase(
      new Dexie(name, {
        autoOpen: false,
        IDBKeyRange,
        indexedDB,
      }),
    )
    newerDatabase.version(4).stores({
      ...SCHEMA_V1,
      ...SCHEMA_V2,
      ...SCHEMA_V3,
      newer_version_sentinel: 'id',
    })
    await newerDatabase.open()
    await newerDatabase.table('newer_version_sentinel').add({
      id: 'sentinel',
      value: 'preserve-me',
    })
    newerDatabase.close()

    const applicationDatabase = createTestDatabase(name)
    let openError: unknown
    try {
      await applicationDatabase.openSupported()
    } catch (error: unknown) {
      openError = error
    }

    expect(openError).toBeInstanceOf(
      UnsupportedSchemaVersionError,
    )
    expect(openError).toBeInstanceOf(PersistenceError)
    expect(openError).toMatchObject({
      code: PERSISTENCE_ERROR_CODES.unsupportedSchemaVersion,
      name: 'UnsupportedSchemaVersionError',
    })
    expect(applicationDatabase.isOpen()).toBe(false)
    if (!(openError instanceof UnsupportedSchemaVersionError)) {
      throw new Error('Expected a normalized unsupported schema error.')
    }
    expect(openError.cause).toMatchObject({
      name: 'VersionError',
    })

    const verificationDatabase = trackDatabase(
      new Dexie(name, {
        autoOpen: false,
        IDBKeyRange,
        indexedDB,
      }),
    )
    verificationDatabase.version(4).stores({
      ...SCHEMA_V1,
      ...SCHEMA_V2,
      ...SCHEMA_V3,
      newer_version_sentinel: 'id',
    })
    await verificationDatabase.open()

    expect(verificationDatabase.verno).toBe(4)
    expect(
      await verificationDatabase
        .table('newer_version_sentinel')
        .get('sentinel'),
    ).toEqual({
      id: 'sentinel',
      value: 'preserve-me',
    })
  })

  it('uses stable typed codes across the approved error model', () => {
    const errors = [
      new DatabaseUnavailableError(),
      new SchemaMigrationError(),
      new UnsupportedSchemaVersionError(),
      new RecordNotFoundError(),
      new DuplicateRecordError(),
      new RelationshipMismatchError(),
      new ValidationError(),
      new ImmutableRecordError(),
      new StorageQuotaError(),
      new TransactionError(),
    ]

    expect(errors.map((error) => error.code)).toEqual([
      'database-unavailable',
      'schema-migration-failed',
      'unsupported-schema-version',
      'record-not-found',
      'duplicate-record',
      'relationship-mismatch',
      'validation-failed',
      'immutable-record',
      'storage-quota-exceeded',
      'transaction-failed',
    ])
    expect(
      errors.every((error) => error instanceof PersistenceError),
    ).toBe(true)
  })

  it('preserves causes and safely narrows unknown values', () => {
    const cause = new Error('diagnostic only')
    const normalized = normalizeDatabaseOpenError({
      name: 'UpgradeError',
      cause,
    })
    const unknownNormalized = normalizeDatabaseOpenError(
      'not an Error object',
    )

    expect(normalized).toBeInstanceOf(SchemaMigrationError)
    expect(normalized.cause).toEqual({
      cause,
      name: 'UpgradeError',
    })
    expect(unknownNormalized).toBeInstanceOf(
      DatabaseUnavailableError,
    )
    expect(unknownNormalized.cause).toBe('not an Error object')
  })

  it('recognizes unique-constraint errors without over-normalizing repository context', () => {
    expect(
      isUniqueConstraintError(
        new DOMException('duplicate', 'ConstraintError'),
      ),
    ).toBe(true)
    expect(
      isUniqueConstraintError({ name: 'ConstraintError' }),
    ).toBe(true)
    expect(isUniqueConstraintError(new Error('other'))).toBe(false)
    expect(isUniqueConstraintError(null)).toBe(false)
  })
})

describe('prototype and application persistence isolation', () => {
  const applicationSources = import.meta.glob(
    [
      '../../main.tsx',
      '../../app/**/*.{ts,tsx}',
      '../../pages/**/*.{ts,tsx}',
      '../../prototype/**/*.{ts,tsx}',
      '../../shared/**/*.{ts,tsx}',
      '../../ui/**/*.{ts,tsx}',
    ],
    {
      eager: true,
      import: 'default',
      query: '?raw',
    },
  )
  const persistenceSources = import.meta.glob(
    [
      './db.ts',
      './errors/*.ts',
      './schema/*.ts',
      '!./schema/*.test.ts',
    ],
    {
      eager: true,
      import: 'default',
      query: '?raw',
    },
  )

  it('keeps application entrypoints, routes, pages, UI, and prototype disconnected', () => {
    for (const [path, source] of Object.entries(applicationSources)) {
      expect(source, path).toEqual(expect.any(String))
      if (typeof source !== 'string') {
        continue
      }

      expect(source, path).not.toMatch(
        /(?:from\s+|import\s*\()['"][^'"]*(?:infrastructure\/persistence|dexie)/,
      )
    }
  })

  it('keeps persistence free of React and prototype dependencies', () => {
    for (const [path, source] of Object.entries(persistenceSources)) {
      expect(source, path).toEqual(expect.any(String))
      if (typeof source !== 'string') {
        continue
      }

      expect(source, path).not.toMatch(/from\s+['"]react/)
      expect(source, path).not.toMatch(
        /from\s+['"][^'"]*prototype/,
      )
    }
  })

  it('has no production database instance or automatic application-render open path', () => {
    expect(DEFAULT_DATABASE_NAME).toBe('RaffleOS_DB')
    expect(
      Object.values(applicationSources).some(
        (source) =>
          typeof source === 'string' &&
          (source.includes('RaffleOSDatabase') ||
            source.includes('RaffleOS_DB')),
      ),
    ).toBe(false)
  })

  it('does not open IndexedDB during a normal application render', async () => {
    const indexedDbOpen = vi.fn()
    vi.stubGlobal('indexedDB', { open: indexedDbOpen })
    const { appRoutes } = await import('../../app/router.tsx')
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/dashboard'],
    })

    render(createElement(RouterProvider, { router }))

    expect(indexedDbOpen).not.toHaveBeenCalled()
  })
})
