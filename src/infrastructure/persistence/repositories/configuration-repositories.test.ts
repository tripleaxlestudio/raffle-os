// @vitest-environment node

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
  vi,
} from 'vitest'
import type { DisplayConfiguration } from '../../../domain/display/display-configuration.types.ts'
import type { DrawConfiguration } from '../../../domain/draws/draw-configuration.types.ts'
import type {
  DrawSession,
  DrawSessionStatus,
} from '../../../domain/draws/draw-session.types.ts'
import type { Event } from '../../../domain/events/event.types.ts'
import type {
  ApplicationPreferenceKey,
} from '../../../domain/preferences/application-preference.types.ts'
import type { PrizeCategory } from '../../../domain/prizes/prize.types.ts'
import {
  createDisplayConfigurationId,
  createDrawConfigurationId,
  createDrawSessionId,
  createEventId,
  createPrizeCategoryId,
  parseDrawConfigurationId,
  parsePrizeCategoryId,
} from '../../../domain/shared/identifiers.ts'
import type { Result } from '../../../domain/shared/result.ts'
import {
  parseIsoTimestamp,
  type IsoTimestamp,
} from '../../../domain/shared/timestamps.ts'
import {
  DEFAULT_DATABASE_NAME,
  RaffleOSDatabase,
} from '../db.ts'
import {
  DuplicateRecordError,
  ImmutableRecordError,
  PERSISTENCE_ERROR_CODES,
  RecordNotFoundError,
  RelationshipMismatchError,
  ValidationError,
} from '../errors/persistence-errors.ts'
import { DexieDisplayConfigurationRepository } from './display-configuration.repository.ts'
import { DexieDrawConfigurationRepository } from './draw-configuration.repository.ts'
import { DexiePreferenceRepository } from './preference.repository.ts'
import { DexiePrizeCategoryRepository } from './prize-category.repository.ts'

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.value
}

const timestamp = unwrap(
  parseIsoTimestamp('2026-07-31T04:00:00.000Z'),
)
const laterTimestamp = unwrap(
  parseIsoTimestamp('2026-07-31T05:00:00.000Z'),
)

const openedDatabases = new Set<Dexie>()
const testDatabaseNames = new Set<string>()

function uniqueDatabaseName(label: string): string {
  return `raffle-os-configuration-repositories-${label}-${crypto.randomUUID()}`
}

function trackDatabase<T extends Dexie>(database: T): T {
  openedDatabases.add(database)
  testDatabaseNames.add(database.name)
  return database
}

function createClosedDatabase(
  label = 'closed',
): RaffleOSDatabase {
  return trackDatabase(
    new RaffleOSDatabase(uniqueDatabaseName(label), {
      IDBKeyRange,
      indexedDB,
    }),
  )
}

async function createOpenDatabase(
  label = 'test',
): Promise<RaffleOSDatabase> {
  const database = createClosedDatabase(label)
  await database.openSupported()
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
  vi.restoreAllMocks()
})

function makeEvent(changes: Partial<Event> = {}): Event {
  return {
    createdAt: timestamp,
    id: createEventId(),
    name: 'Nusantara Tech Gala',
    status: 'draft',
    updatedAt: timestamp,
    ...changes,
  }
}

function makeCategory(
  event: Event,
  changes: Partial<PrizeCategory> = {},
): PrizeCategory {
  return {
    createdAt: timestamp,
    displayOrder: 0,
    eventId: event.id,
    id: createPrizeCategoryId(),
    name: 'Grand Prize',
    prizeName: 'Electric Scooter',
    ...changes,
  }
}

function makeConfiguration(
  event: Event,
  category: PrizeCategory,
  changes: Partial<DrawConfiguration> = {},
): DrawConfiguration {
  return {
    createdAt: timestamp,
    eligibleGroupFilter: null,
    eventId: event.id,
    id: createDrawConfigurationId(),
    prizeCategoryId: category.id,
    requestedWinners: 1,
    requireCheckIn: false,
    updatedAt: timestamp,
    winningRule: 'once-per-event',
    ...changes,
  }
}

function makeSession(
  configuration: DrawConfiguration,
  status: DrawSessionStatus,
): DrawSession {
  return {
    candidatePoolSnapshot: null,
    configurationId: configuration.id,
    configurationSnapshot: null,
    createdAt: timestamp,
    eventId: configuration.eventId,
    id: createDrawSessionId(),
    mode: 'live',
    status,
    updatedAt: timestamp,
  }
}

function makeDisplay(
  event: Event,
  changes: Partial<DisplayConfiguration> = {},
): DisplayConfiguration {
  return {
    blackoutAppearance: 'pure-black',
    createdAt: timestamp,
    eventId: event.id,
    id: createDisplayConfigurationId(),
    safeAreaMargin: 48,
    targetResolution: { height: 1080, width: 1920 },
    updatedAt: timestamp,
    ...changes,
  }
}

function withRuntimeValue<T extends object>(
  value: T,
  key: string,
  replacement: unknown,
): T {
  const changed = { ...value }
  Object.defineProperty(changed, key, {
    enumerable: true,
    value: replacement,
  })
  return changed
}

async function captureError(
  promise: Promise<unknown>,
): Promise<unknown> {
  try {
    await promise
    return null
  } catch (error: unknown) {
    return error
  }
}

describe('configuration repository construction and isolation', () => {
  it('imports repository modules without opening IndexedDB', async () => {
    vi.resetModules()
    const openSpy = vi.spyOn(indexedDB, 'open')

    await Promise.all([
      import('./prize-category.repository.ts'),
      import('./draw-configuration.repository.ts'),
      import('./display-configuration.repository.ts'),
      import('./preference.repository.ts'),
    ])

    expect(openSpy).not.toHaveBeenCalled()
  })

  it('uses one explicitly injected database and does not open on construction', () => {
    const openSpy = vi.spyOn(indexedDB, 'open')
    const database = createClosedDatabase()

    new DexiePrizeCategoryRepository(database)
    new DexieDrawConfigurationRepository(database)
    new DexieDisplayConfigurationRepository(database)
    new DexiePreferenceRepository(database)

    expect(database.isOpen()).toBe(false)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('keeps custom database names isolated and leaves RaffleOS_DB unused', async () => {
    const firstDatabase = await createOpenDatabase('first')
    const secondDatabase = await createOpenDatabase('second')
    const firstRepository = new DexiePrizeCategoryRepository(
      firstDatabase,
    )
    const secondRepository = new DexiePrizeCategoryRepository(
      secondDatabase,
    )
    const event = makeEvent()
    const category = makeCategory(event)
    await firstDatabase.events.add(event)
    await firstRepository.create(category)

    expect(await firstRepository.findById(category.id)).toEqual(
      category,
    )
    expect(await secondRepository.findById(category.id)).toBeNull()
    expect(firstDatabase.name).not.toBe(DEFAULT_DATABASE_NAME)
    expect(secondDatabase.name).not.toBe(DEFAULT_DATABASE_NAME)
    expect(await indexedDB.databases()).not.toContainEqual(
      expect.objectContaining({ name: DEFAULT_DATABASE_NAME }),
    )
  })
})

describe('DexiePrizeCategoryRepository reads and ordering', () => {
  it('finds by ID, returns null for a miss, and isolates Event queries', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePrizeCategoryRepository(database)
    const target = makeEvent()
    const other = makeEvent()
    const targetCategory = makeCategory(target)
    const otherCategory = makeCategory(other)
    await database.events.bulkAdd([target, other])
    await database.prize_categories.bulkAdd([
      targetCategory,
      otherCategory,
    ])

    expect(await repository.findById(targetCategory.id)).toEqual(
      targetCategory,
    )
    expect(await repository.findById(createPrizeCategoryId())).toBeNull()
    expect(await repository.findByEventId(target.id)).toEqual([
      targetCategory,
    ])
  })

  it('orders by displayOrder and uses ID as the stable tie-breaker', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePrizeCategoryRepository(database)
    const event = makeEvent()
    const firstId = unwrap(
      parsePrizeCategoryId(
        '10000000-0000-4000-8000-000000000001',
      ),
    )
    const secondId = unwrap(
      parsePrizeCategoryId(
        '20000000-0000-4000-8000-000000000001',
      ),
    )
    const categories = [
      makeCategory(event, {
        displayOrder: 1,
        id: createPrizeCategoryId(),
      }),
      makeCategory(event, { displayOrder: 0, id: secondId }),
      makeCategory(event, { displayOrder: 0, id: firstId }),
    ]
    await database.events.add(event)
    await database.prize_categories.bulkAdd(categories)
    const fullTableRead = vi.spyOn(
      database.prize_categories,
      'toArray',
    )

    const result = await repository.findByEventId(event.id)

    expect(result.map((category) => category.id)).toEqual([
      firstId,
      secondId,
      categories[0]?.id,
    ])
    expect(fullTableRead).not.toHaveBeenCalled()
  })
})

describe('DexiePrizeCategoryRepository lifecycle protection', () => {
  it('creates a valid category only for an existing draft Event', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePrizeCategoryRepository(database)
    const draft = makeEvent()
    const ready = makeEvent({ status: 'ready' })
    const missing = makeEvent()
    const category = makeCategory(draft)
    await database.events.bulkAdd([draft, ready])

    await repository.create(category)

    await expect(
      repository.create(makeCategory(ready)),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    await expect(
      repository.create(makeCategory(missing)),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    await expect(
      repository.create(
        withRuntimeValue(makeCategory(draft), 'name', '   '),
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await database.prize_categories.toArray()).toEqual([
      category,
    ])
  })

  it('normalizes a duplicate ID, preserves the original, and retains the cause', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePrizeCategoryRepository(database)
    const event = makeEvent()
    const original = makeCategory(event)
    await database.events.add(event)
    await repository.create(original)

    const error = await captureError(
      repository.create({
        ...original,
        name: 'Overwrite Attempt',
      }),
    )

    expect(error).toBeInstanceOf(DuplicateRecordError)
    expect(error).toMatchObject({
      code: PERSISTENCE_ERROR_CODES.duplicateRecord,
    })
    if (!(error instanceof DuplicateRecordError)) {
      throw new Error('Expected a normalized duplicate error.')
    }
    expect(error.name).not.toBe('ConstraintError')
    expect(error.cause).toMatchObject({ name: 'ConstraintError' })
    expect(await database.prize_categories.get(original.id)).toEqual(
      original,
    )
  })

  it('updates an unused category while preserving identity and ownership', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePrizeCategoryRepository(database)
    const event = makeEvent()
    const category = makeCategory(event)
    const configuration = makeConfiguration(event, category)
    await database.events.add(event)
    await database.prize_categories.add(category)
    await database.draw_configurations.add(configuration)

    const updated = {
      ...category,
      displayOrder: 2,
      name: 'Updated Prize',
    }
    await repository.updateDraft(updated)

    expect(await database.prize_categories.get(category.id)).toEqual(
      updated,
    )
  })

  it('rejects Event reassignment, creation-time replacement, and non-draft mutation', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePrizeCategoryRepository(database)
    const draft = makeEvent()
    const other = makeEvent()
    const category = makeCategory(draft)
    await database.events.bulkAdd([draft, other])
    await database.prize_categories.add(category)

    await expect(
      repository.updateDraft({ ...category, eventId: other.id }),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    await expect(
      repository.updateDraft({
        ...category,
        createdAt: laterTimestamp,
      }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)

    await database.events.update(draft.id, { status: 'ready' })
    await expect(
      repository.updateDraft({ ...category, name: 'Changed' }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(await database.prize_categories.get(category.id)).toEqual(
      category,
    )
  })

  it.each<DrawSessionStatus>([
    'drawing',
    'pending-confirmation',
    'completed',
    'cancelled',
  ])('blocks updates after a referencing session reaches %s', async (status) => {
    const database = await createOpenDatabase()
    const repository = new DexiePrizeCategoryRepository(database)
    const event = makeEvent()
    const category = makeCategory(event)
    const configuration = makeConfiguration(event, category)
    await database.events.add(event)
    await database.prize_categories.add(category)
    await database.draw_configurations.add(configuration)
    await database.draw_sessions.add(
      makeSession(configuration, status),
    )

    await expect(
      repository.updateDraft({
        ...category,
        name: 'Forbidden Change',
      }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(await database.prize_categories.get(category.id)).toEqual(
      category,
    )
  })

  it('rejects referenced deletion without cascading and deletes an unreferenced draft category', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePrizeCategoryRepository(database)
    const event = makeEvent()
    const referenced = makeCategory(event)
    const unreferenced = makeCategory(event)
    const configuration = makeConfiguration(event, referenced)
    await database.events.add(event)
    await database.prize_categories.bulkAdd([
      referenced,
      unreferenced,
    ])
    await database.draw_configurations.add(configuration)

    await expect(
      repository.deleteDraft(referenced.id),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    await repository.deleteDraft(unreferenced.id)

    expect(
      await database.prize_categories.get(referenced.id),
    ).toEqual(referenced)
    expect(
      await database.prize_categories.get(unreferenced.id),
    ).toBeUndefined()
    expect(
      await database.draw_configurations.get(configuration.id),
    ).toEqual(configuration)
  })
})

describe('DexieDrawConfigurationRepository reads and creation', () => {
  it('finds by ID, returns null, isolates Events, and orders by createdAt then ID', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieDrawConfigurationRepository(database)
    const event = makeEvent()
    const other = makeEvent()
    const category = makeCategory(event)
    const otherCategory = makeCategory(other)
    const firstId = unwrap(
      parseDrawConfigurationId(
        '10000000-0000-4000-8000-000000000001',
      ),
    )
    const secondId = unwrap(
      parseDrawConfigurationId(
        '20000000-0000-4000-8000-000000000001',
      ),
    )
    const first = makeConfiguration(event, category, {
      id: firstId,
    })
    const second = makeConfiguration(event, category, {
      id: secondId,
    })
    const later = makeConfiguration(event, category, {
      createdAt: laterTimestamp,
      updatedAt: laterTimestamp,
    })
    const otherConfiguration = makeConfiguration(
      other,
      otherCategory,
    )
    await database.events.bulkAdd([event, other])
    await database.prize_categories.bulkAdd([
      category,
      otherCategory,
    ])
    await database.draw_configurations.bulkAdd([
      later,
      second,
      otherConfiguration,
      first,
    ])
    const fullTableRead = vi.spyOn(
      database.draw_configurations,
      'toArray',
    )

    expect(await repository.findById(first.id)).toEqual(first)
    expect(
      await repository.findById(createDrawConfigurationId()),
    ).toBeNull()
    expect(
      (await repository.findByEventId(event.id)).map(
        (configuration) => configuration.id,
      ),
    ).toEqual([first.id, second.id, later.id])
    expect(fullTableRead).not.toHaveBeenCalled()
  })

  it('creates a valid configuration and rejects invalid winner counts', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieDrawConfigurationRepository(database)
    const event = makeEvent()
    const category = makeCategory(event)
    const configuration = makeConfiguration(event, category)
    await database.events.add(event)
    await database.prize_categories.add(category)

    await repository.createDraft(configuration)
    await expect(
      repository.createDraft({
        ...makeConfiguration(event, category),
        requestedWinners: 101,
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await database.draw_configurations.toArray()).toEqual([
      configuration,
    ])
  })

  it('rejects missing and cross-Event categories without writing', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieDrawConfigurationRepository(database)
    const target = makeEvent()
    const other = makeEvent()
    const missingCategory = makeCategory(target)
    const otherCategory = makeCategory(other)
    await database.events.bulkAdd([target, other])
    await database.prize_categories.add(otherCategory)

    await expect(
      repository.createDraft(
        makeConfiguration(target, missingCategory),
      ),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    await expect(
      repository.createDraft(
        makeConfiguration(target, otherCategory),
      ),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    expect(await database.draw_configurations.count()).toBe(0)
  })

  it('requires a draft parent and rejects duplicate IDs without overwrite', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieDrawConfigurationRepository(database)
    const draft = makeEvent()
    const ready = makeEvent({ status: 'ready' })
    const draftCategory = makeCategory(draft)
    const readyCategory = makeCategory(ready)
    const original = makeConfiguration(draft, draftCategory)
    await database.events.bulkAdd([draft, ready])
    await database.prize_categories.bulkAdd([
      draftCategory,
      readyCategory,
    ])
    await repository.createDraft(original)

    await expect(
      repository.createDraft(
        makeConfiguration(ready, readyCategory),
      ),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    await expect(
      repository.createDraft({
        ...original,
        requestedWinners: 20,
      }),
    ).rejects.toBeInstanceOf(DuplicateRecordError)
    expect(
      await database.draw_configurations.get(original.id),
    ).toEqual(original)
  })
})

describe('DexieDrawConfigurationRepository update and deletion', () => {
  it('updates an unused draft and permits valid same-Event category reassignment', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieDrawConfigurationRepository(database)
    const event = makeEvent()
    const firstCategory = makeCategory(event)
    const secondCategory = makeCategory(event)
    const configuration = makeConfiguration(event, firstCategory)
    await database.events.add(event)
    await database.prize_categories.bulkAdd([
      firstCategory,
      secondCategory,
    ])
    await database.draw_configurations.add(configuration)

    const updated = {
      ...configuration,
      prizeCategoryId: secondCategory.id,
      requestedWinners: 6,
      updatedAt: laterTimestamp,
    }
    await repository.updateDraft(updated)

    expect(
      await database.draw_configurations.get(configuration.id),
    ).toEqual(updated)
  })

  it.each<DrawSessionStatus>(['draft', 'ready'])(
    'allows updates while a referencing session remains %s',
    async (status) => {
      const database = await createOpenDatabase()
      const repository =
        new DexieDrawConfigurationRepository(database)
      const event = makeEvent()
      const category = makeCategory(event)
      const configuration = makeConfiguration(event, category)
      await database.events.add(event)
      await database.prize_categories.add(category)
      await database.draw_configurations.add(configuration)
      await database.draw_sessions.add(
        makeSession(configuration, status),
      )

      await repository.updateDraft({
        ...configuration,
        requestedWinners: 3,
        updatedAt: laterTimestamp,
      })

      expect(
        await database.draw_configurations.get(configuration.id),
      ).toMatchObject({
        requestedWinners: 3,
        updatedAt: laterTimestamp,
      })
    },
  )

  it.each<DrawSessionStatus>([
    'drawing',
    'pending-confirmation',
    'completed',
    'cancelled',
  ])('blocks updates once a session reaches %s', async (status) => {
    const database = await createOpenDatabase()
    const repository = new DexieDrawConfigurationRepository(database)
    const event = makeEvent()
    const category = makeCategory(event)
    const configuration = makeConfiguration(event, category)
    await database.events.add(event)
    await database.prize_categories.add(category)
    await database.draw_configurations.add(configuration)
    await database.draw_sessions.add(
      makeSession(configuration, status),
    )

    await expect(
      repository.updateDraft({
        ...configuration,
        requestedWinners: 3,
      }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(
      await database.draw_configurations.get(configuration.id),
    ).toEqual(configuration)
  })

  it('rejects missing targets, immutable fields, and cross-Event categories', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieDrawConfigurationRepository(database)
    const event = makeEvent()
    const other = makeEvent()
    const category = makeCategory(event)
    const otherCategory = makeCategory(other)
    const configuration = makeConfiguration(event, category)
    await database.events.bulkAdd([event, other])
    await database.prize_categories.bulkAdd([
      category,
      otherCategory,
    ])
    await database.draw_configurations.add(configuration)

    await expect(
      repository.updateDraft(
        makeConfiguration(event, category),
      ),
    ).rejects.toBeInstanceOf(RecordNotFoundError)
    await expect(
      repository.updateDraft({
        ...configuration,
        createdAt: laterTimestamp,
      }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    await expect(
      repository.updateDraft({
        ...configuration,
        eventId: other.id,
      }),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    await expect(
      repository.updateDraft({
        ...configuration,
        prizeCategoryId: otherCategory.id,
      }),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    expect(
      await database.draw_configurations.get(configuration.id),
    ).toEqual(configuration)
  })

  it('deletes an unused draft configuration without deleting its category', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieDrawConfigurationRepository(database)
    const event = makeEvent()
    const category = makeCategory(event)
    const configuration = makeConfiguration(event, category)
    await database.events.add(event)
    await database.prize_categories.add(category)
    await database.draw_configurations.add(configuration)

    await repository.deleteUnused(configuration.id)

    expect(
      await database.draw_configurations.get(configuration.id),
    ).toBeUndefined()
    expect(await database.prize_categories.get(category.id)).toEqual(
      category,
    )
  })

  it.each<DrawSessionStatus>([
    'draft',
    'ready',
    'drawing',
    'pending-confirmation',
    'completed',
    'cancelled',
  ])('blocks deletion for a %s session without cascading', async (status) => {
    const database = await createOpenDatabase()
    const repository = new DexieDrawConfigurationRepository(database)
    const event = makeEvent()
    const category = makeCategory(event)
    const configuration = makeConfiguration(event, category)
    const session = makeSession(configuration, status)
    await database.events.add(event)
    await database.prize_categories.add(category)
    await database.draw_configurations.add(configuration)
    await database.draw_sessions.add(session)

    await expect(
      repository.deleteUnused(configuration.id),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(
      await database.draw_configurations.get(configuration.id),
    ).toEqual(configuration)
    expect(await database.draw_sessions.get(session.id)).toEqual(
      session,
    )
  })

  it('blocks deletion after the parent Event leaves draft', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieDrawConfigurationRepository(database)
    const event = makeEvent({ status: 'ready' })
    const category = makeCategory(event)
    const configuration = makeConfiguration(event, category)
    await database.events.add(event)
    await database.prize_categories.add(category)
    await database.draw_configurations.add(configuration)

    await expect(
      repository.deleteUnused(configuration.id),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(
      await database.draw_configurations.get(configuration.id),
    ).toEqual(configuration)
  })
})

describe('DexieDisplayConfigurationRepository', () => {
  it('creates and retrieves one pure-black configuration for an Event in any status', async () => {
    const database = await createOpenDatabase()
    const repository =
      new DexieDisplayConfigurationRepository(database)
    const event = makeEvent({ status: 'live' })
    const configuration = makeDisplay(event)
    await database.events.add(event)

    await repository.create(configuration)

    expect(await repository.findByEventId(event.id)).toEqual(
      configuration,
    )
    expect(configuration.blackoutAppearance).toBe('pure-black')
    expect(
      await repository.findByEventId(createEventId()),
    ).toBeNull()
  })

  it('normalizes duplicate IDs and second configurations per Event', async () => {
    const database = await createOpenDatabase()
    const repository =
      new DexieDisplayConfigurationRepository(database)
    const firstEvent = makeEvent()
    const secondEvent = makeEvent()
    const original = makeDisplay(firstEvent)
    await database.events.bulkAdd([firstEvent, secondEvent])
    await repository.create(original)

    const idError = await captureError(
      repository.create({
        ...makeDisplay(secondEvent),
        id: original.id,
      }),
    )
    const eventError = await captureError(
      repository.create(makeDisplay(firstEvent)),
    )

    expect(idError).toBeInstanceOf(DuplicateRecordError)
    expect(eventError).toBeInstanceOf(DuplicateRecordError)
    if (!(eventError instanceof DuplicateRecordError)) {
      throw new Error('Expected a normalized duplicate error.')
    }
    expect(eventError.cause).toMatchObject({
      name: 'ConstraintError',
    })
    expect(
      await database.display_configurations.get(original.id),
    ).toEqual(original)
    expect(await database.display_configurations.count()).toBe(1)
  })

  it('rejects invalid blackout, safe area, resolution, and missing parent values', async () => {
    const database = await createOpenDatabase()
    const repository =
      new DexieDisplayConfigurationRepository(database)
    const event = makeEvent()
    await database.events.add(event)

    await expect(
      repository.create(
        withRuntimeValue(
          makeDisplay(event),
          'blackoutAppearance',
          'branded',
        ),
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      repository.create(makeDisplay(event, { safeAreaMargin: -1 })),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      repository.create(
        makeDisplay(event, {
          targetResolution: { height: 0, width: 1920 },
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      repository.create(makeDisplay(makeEvent())),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    expect(await database.display_configurations.count()).toBe(0)
  })

  it('updates operational values and preserves ID, Event, createdAt, and supplied updatedAt', async () => {
    const database = await createOpenDatabase()
    const repository =
      new DexieDisplayConfigurationRepository(database)
    const event = makeEvent()
    const configuration = makeDisplay(event)
    await database.events.add(event)
    await database.display_configurations.add(configuration)

    const updated = {
      ...configuration,
      safeAreaMargin: 64,
      targetResolution: { height: 2160, width: 3840 },
      updatedAt: laterTimestamp,
    }
    await repository.updateForEvent(updated)

    expect(
      await database.display_configurations.get(configuration.id),
    ).toEqual(updated)
  })

  it('rejects missing updates, identity replacement, ownership change, and createdAt change', async () => {
    const database = await createOpenDatabase()
    const repository =
      new DexieDisplayConfigurationRepository(database)
    const event = makeEvent()
    const other = makeEvent()
    const configuration = makeDisplay(event)
    const otherConfiguration = makeDisplay(other)
    await database.events.bulkAdd([event, other])
    await database.display_configurations.bulkAdd([
      configuration,
      otherConfiguration,
    ])

    await expect(
      repository.updateForEvent(makeDisplay(makeEvent())),
    ).rejects.toBeInstanceOf(RecordNotFoundError)
    await expect(
      repository.updateForEvent({
        ...configuration,
        id: createDisplayConfigurationId(),
      }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    await expect(
      repository.updateForEvent({
        ...configuration,
        eventId: other.id,
      }),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    await expect(
      repository.updateForEvent({
        ...configuration,
        createdAt: laterTimestamp,
      }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(
      await database.display_configurations.get(configuration.id),
    ).toEqual(configuration)
  })

  it('survives database close and reopen with exact pure-black data', async () => {
    const name = uniqueDatabaseName('reopen')
    const database = trackDatabase(
      new RaffleOSDatabase(name, {
        IDBKeyRange,
        indexedDB,
      }),
    )
    const event = makeEvent()
    const configuration = makeDisplay(event)
    await database.openSupported()
    await database.events.add(event)
    await new DexieDisplayConfigurationRepository(database).create(
      configuration,
    )
    database.close()

    const reopened = trackDatabase(
      new RaffleOSDatabase(name, {
        IDBKeyRange,
        indexedDB,
      }),
    )
    await reopened.openSupported()

    expect(
      await new DexieDisplayConfigurationRepository(
        reopened,
      ).findByEventId(event.id),
    ).toEqual(configuration)
  })
})

describe('DexiePreferenceRepository typed behavior', () => {
  it('returns null for absent keys and round-trips null activeEventId', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePreferenceRepository(database)

    expect(await repository.get('activeEventId')).toBeNull()
    await repository.set('activeEventId', null, timestamp)

    expect(await repository.get('activeEventId')).toBeNull()
    expect(await database.preferences.get('activeEventId')).toEqual({
      key: 'activeEventId',
      updatedAt: timestamp,
      value: null,
    })
  })

  it('round-trips an existing active Event and preserves updatedAt exactly', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePreferenceRepository(database)
    const event = makeEvent()
    await database.events.add(event)

    await repository.set('activeEventId', event.id, laterTimestamp)

    expect(await repository.get('activeEventId')).toBe(event.id)
    expect(await database.preferences.get('activeEventId')).toEqual({
      key: 'activeEventId',
      updatedAt: laterTimestamp,
      value: event.id,
    })
  })

  it('rejects a missing active Event atomically', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePreferenceRepository(database)

    await expect(
      repository.set('activeEventId', createEventId(), timestamp),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    expect(await database.preferences.count()).toBe(0)
  })

  it.each(['practice', 'live'] as const)(
    'round-trips canonical operator mode %s',
    async (mode) => {
      const database = await createOpenDatabase()
      const repository = new DexiePreferenceRepository(database)

      await repository.set(
        'lastOperatorMode',
        mode,
        laterTimestamp,
      )

      expect(await repository.get('lastOperatorMode')).toBe(mode)
      expect(
        await database.preferences.get('lastOperatorMode'),
      ).toMatchObject({ updatedAt: laterTimestamp })
    },
  )

  it('rejects runtime-invalid keys, values, and timestamps', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePreferenceRepository(database)
    const invalidKey =
      'theme' as ApplicationPreferenceKey
    const invalidTimestamp =
      'now' as IsoTimestamp

    await expect(
      repository.get(invalidKey),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      repository.set(
        'lastOperatorMode',
        'official' as 'live',
        timestamp,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      repository.set(
        'lastOperatorMode',
        'practice',
        invalidTimestamp,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await database.preferences.count()).toBe(0)
  })

  it.each([
    {
      key: 'lastOperatorMode',
      updatedAt: timestamp,
      value: 'official',
    },
    {
      key: 'lastOperatorMode',
      updatedAt: 'not-a-timestamp',
      value: 'live',
    },
  ])('rejects malformed persisted preference %#', async (malformed) => {
    const database = await createOpenDatabase()
    const repository = new DexiePreferenceRepository(database)
    await database.table('preferences').put(malformed)

    await expect(
      repository.get('lastOperatorMode'),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('replaces only the selected typed key', async () => {
    const database = await createOpenDatabase()
    const repository = new DexiePreferenceRepository(database)

    await repository.set('activeEventId', null, timestamp)
    await repository.set('lastOperatorMode', 'practice', timestamp)
    await repository.set(
      'lastOperatorMode',
      'live',
      laterTimestamp,
    )

    expect(await database.preferences.toArray()).toEqual(
      expect.arrayContaining([
        {
          key: 'activeEventId',
          updatedAt: timestamp,
          value: null,
        },
        {
          key: 'lastOperatorMode',
          updatedAt: laterTimestamp,
          value: 'live',
        },
      ]),
    )
    expect(await database.preferences.count()).toBe(2)
  })
})

describe('Slice 4 source and scope boundaries', () => {
  const interfaceSources = import.meta.glob(
    '../../../application/persistence/repositories/*.ts',
    {
      eager: true,
      import: 'default',
      query: '?raw',
    },
  )
  const implementationSources = import.meta.glob(
    [
      './prize-category.repository.ts',
      './draw-configuration.repository.ts',
      './display-configuration.repository.ts',
      './preference.repository.ts',
      './repository-helpers.ts',
    ],
    {
      eager: true,
      import: 'default',
      query: '?raw',
    },
  )
  const applicationSources = import.meta.glob(
    [
      '../../../main.tsx',
      '../../../app/**/*.{ts,tsx}',
      '../../../pages/**/*.{ts,tsx}',
      '../../../prototype/**/*.{ts,tsx}',
      '../../../shared/**/*.{ts,tsx}',
      '../../../ui/**/*.{ts,tsx}',
    ],
    {
      eager: true,
      import: 'default',
      query: '?raw',
    },
  )
  it('keeps all repository interfaces domain-only', () => {
    for (const [path, source] of Object.entries(interfaceSources)) {
      expect(source, path).toEqual(expect.any(String))
      if (typeof source !== 'string') {
        continue
      }

      expect(source, path).not.toMatch(
        /dexie|indexedDB|react|prototype/i,
      )
      const imports = source.matchAll(/from\s+['"]([^'"]+)['"]/g)
      for (const match of imports) {
        expect(match[1], path).toContain('/domain/')
      }
    }
  })

  it('keeps implementations free of lifecycle, React, and prototype side effects', () => {
    for (const [path, source] of Object.entries(
      implementationSources,
    )) {
      expect(source, path).toEqual(expect.any(String))
      if (typeof source !== 'string') {
        continue
      }

      expect(source, path).not.toMatch(/from\s+['"]react/)
      expect(source, path).not.toMatch(
        /from\s+['"][^'"]*prototype/,
      )
      expect(source, path).not.toContain('new RaffleOSDatabase')
      expect(source, path).not.toMatch(
        /database\.open(?:Supported)?\s*\(/,
      )
      expect(source, path).not.toMatch(
        /localStorage|sessionStorage/,
      )
    }
  })

  it('keeps pages, routes, UI, and prototype disconnected', () => {
    for (const [path, source] of Object.entries(
      applicationSources,
    )) {
      if (typeof source !== 'string') {
        continue
      }

      expect(source, path).not.toMatch(
        /(?:from\s+|import\s*\()['"][^'"]*persistence\/repositories/,
      )
    }
  })

  it('does not implement future product behavior', () => {
    for (const [path, source] of Object.entries(
      implementationSources,
    )) {
      if (typeof source !== 'string') {
        continue
      }

      expect(source, path).not.toMatch(
        /csv|xlsx|Math\.random|crypto\.getRandomValues|BroadcastChannel|Fisher.Yates/i,
      )
    }
  })
})
