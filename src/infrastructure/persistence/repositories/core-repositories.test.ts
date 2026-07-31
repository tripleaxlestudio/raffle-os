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
import type { AuditRecord } from '../../../domain/audit/audit.types.ts'
import type { DrawConfiguration } from '../../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../../domain/draws/draw-session.types.ts'
import type { Event } from '../../../domain/events/event.types.ts'
import { parseTicketNumber } from '../../../domain/participants/participant.invariants.ts'
import type {
  Participant,
  ParticipantOperationalChanges,
  TicketNumber,
} from '../../../domain/participants/participant.types.ts'
import type { ApplicationPreference } from '../../../domain/preferences/application-preference.types.ts'
import type { PrizeCategory } from '../../../domain/prizes/prize.types.ts'
import {
  createAuditRecordId,
  createDrawConfigurationId,
  createDrawSessionId,
  createEventId,
  createParticipantId,
  createPrizeCategoryId,
  parseEventId,
} from '../../../domain/shared/identifiers.ts'
import type { Result } from '../../../domain/shared/result.ts'
import { parseIsoTimestamp } from '../../../domain/shared/timestamps.ts'
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
import { DexieEventRepository } from './event.repository.ts'
import { DexieParticipantRepository } from './participant.repository.ts'

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.value
}

const timestamp = unwrap(
  parseIsoTimestamp('2026-07-31T01:00:00.000Z'),
)
const laterTimestamp = unwrap(
  parseIsoTimestamp('2026-07-31T02:00:00.000Z'),
)
const latestTimestamp = unwrap(
  parseIsoTimestamp('2026-07-31T03:00:00.000Z'),
)

const openedDatabases = new Set<Dexie>()
const testDatabaseNames = new Set<string>()

function uniqueDatabaseName(label: string): string {
  return `raffle-os-core-repositories-${label}-${crypto.randomUUID()}`
}

function trackDatabase<T extends Dexie>(database: T): T {
  openedDatabases.add(database)
  testDatabaseNames.add(database.name)
  return database
}

async function createOpenDatabase(
  label = 'test',
): Promise<RaffleOSDatabase> {
  const database = trackDatabase(
    new RaffleOSDatabase(uniqueDatabaseName(label), {
      IDBKeyRange,
      indexedDB,
    }),
  )
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

function makeEvent(
  changes: Partial<Event> = {},
): Event {
  return {
    createdAt: timestamp,
    id: createEventId(),
    name: 'Nusantara Tech Gala',
    status: 'draft',
    updatedAt: timestamp,
    ...changes,
  }
}

function ticket(value: string): TicketNumber {
  return unwrap(parseTicketNumber(value))
}

function makeParticipant(
  event: Event,
  ticketNumber: string,
  changes: Partial<Participant> = {},
): Participant {
  return {
    createdAt: timestamp,
    eventId: event.id,
    id: createParticipantId(),
    isCheckedIn: false,
    ticketNumber: ticket(ticketNumber),
    updatedAt: timestamp,
    ...changes,
  }
}

function withInvalidUpdatedAt(
  participant: Participant,
): Participant {
  const invalid = { ...participant }
  Object.defineProperty(invalid, 'updatedAt', {
    enumerable: true,
    value: 'not-an-iso-timestamp',
  })
  return invalid
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

function makePrizeCategory(event: Event): PrizeCategory {
  return {
    createdAt: timestamp,
    displayOrder: 0,
    eventId: event.id,
    id: createPrizeCategoryId(),
    name: 'Grand Prize',
    prizeName: 'Electric Scooter',
  }
}

function makeDrawConfiguration(
  event: Event,
  category: PrizeCategory,
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
  }
}

function makeDraftDrawSession(event: Event): DrawSession {
  return {
    candidatePoolSnapshot: null,
    configurationId: createDrawConfigurationId(),
    configurationSnapshot: null,
    createdAt: timestamp,
    eventId: event.id,
    id: createDrawSessionId(),
    mode: 'live',
    status: 'draft',
    updatedAt: timestamp,
  }
}

function makeAudit(
  event: Event,
  action: AuditRecord['action'],
): AuditRecord {
  return {
    action,
    actor: { type: 'system' },
    detail: {},
    eventId: event.id,
    id: createAuditRecordId(),
    timestamp,
  }
}

describe('repository construction and database isolation', () => {
  it('uses an explicitly injected database without opening it', () => {
    const openSpy = vi.spyOn(indexedDB, 'open')
    const database = trackDatabase(
      new RaffleOSDatabase(uniqueDatabaseName('construction'), {
        IDBKeyRange,
        indexedDB,
      }),
    )

    new DexieEventRepository(database)
    new DexieParticipantRepository(database)

    expect(database.isOpen()).toBe(false)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('keeps repository data isolated by the injected database', async () => {
    const firstDatabase = await createOpenDatabase('first')
    const secondDatabase = await createOpenDatabase('second')
    const firstRepository = new DexieEventRepository(firstDatabase)
    const secondRepository = new DexieEventRepository(secondDatabase)
    const event = makeEvent()

    await firstRepository.create(event)

    expect(await firstRepository.findById(event.id)).toEqual(event)
    expect(await secondRepository.findById(event.id)).toBeNull()
    expect(firstDatabase.name).not.toBe(DEFAULT_DATABASE_NAME)
    expect(secondDatabase.name).not.toBe(DEFAULT_DATABASE_NAME)
  })
})

describe('DexieEventRepository reads and create', () => {
  it('finds an Event by ID and returns null for a read miss', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const event = makeEvent()
    await database.events.add(event)

    expect(await repository.findById(event.id)).toEqual(event)
    expect(await repository.findById(createEventId())).toBeNull()
  })

  it('orders all Events by createdAt and then ID', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const firstId = unwrap(
      parseEventId('10000000-0000-4000-8000-000000000001'),
    )
    const secondId = unwrap(
      parseEventId('20000000-0000-4000-8000-000000000001'),
    )
    const thirdId = unwrap(
      parseEventId('30000000-0000-4000-8000-000000000001'),
    )
    const events = [
      makeEvent({
        createdAt: laterTimestamp,
        id: thirdId,
        name: 'Later',
        updatedAt: laterTimestamp,
      }),
      makeEvent({ id: secondId, name: 'Second' }),
      makeEvent({ id: firstId, name: 'First' }),
    ]
    await database.events.bulkAdd(events)

    expect((await repository.findAll()).map((event) => event.id)).toEqual([
      firstId,
      secondId,
      thirdId,
    ])
  })

  it('creates a valid Event', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const event = makeEvent()

    await repository.create(event)

    expect(await database.events.get(event.id)).toEqual(event)
  })

  it('normalizes a duplicate ID and preserves the original Event', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const original = makeEvent()
    await repository.create(original)

    const error = await captureError(
      repository.create({ ...original, name: 'Overwrite Attempt' }),
    )

    expect(error).toBeInstanceOf(DuplicateRecordError)
    expect(error).toMatchObject({
      code: PERSISTENCE_ERROR_CODES.duplicateRecord,
    })
    if (!(error instanceof DuplicateRecordError)) {
      throw new Error('Expected a normalized duplicate error.')
    }
    expect(error.cause).toMatchObject({ name: 'ConstraintError' })
    expect(await database.events.get(original.id)).toEqual(original)
  })

  it('rejects an invalid Event before writing', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const invalid = makeEvent({ name: '   ' })

    await expect(repository.create(invalid)).rejects.toBeInstanceOf(
      ValidationError,
    )
    expect(await database.events.count()).toBe(0)
  })
})

describe('DexieEventRepository draft updates and transitions', () => {
  it('updates only draft metadata and preserves ID and createdAt', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const event = makeEvent()
    await database.events.add(event)

    await repository.updateDraft({
      ...event,
      description: 'Annual team celebration',
      name: 'Updated Gala',
      scheduledAt: latestTimestamp,
      updatedAt: laterTimestamp,
    })

    expect(await database.events.get(event.id)).toEqual({
      ...event,
      description: 'Annual team celebration',
      name: 'Updated Gala',
      scheduledAt: latestTimestamp,
      updatedAt: laterTimestamp,
    })
  })

  it('rejects status and creation-time changes through updateDraft', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const event = makeEvent()
    await database.events.add(event)

    await expect(
      repository.updateDraft({ ...event, status: 'ready' }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    await expect(
      repository.updateDraft({ ...event, createdAt: laterTimestamp }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(await database.events.get(event.id)).toEqual(event)
  })

  it('rejects a non-draft or missing Event update', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const ready = makeEvent({ status: 'ready' })
    await database.events.add(ready)

    await expect(
      repository.updateDraft({ ...ready, name: 'Changed' }),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    await expect(
      repository.updateDraft(makeEvent()),
    ).rejects.toBeInstanceOf(RecordNotFoundError)
  })

  it('applies a valid transition and the supplied timestamp exactly', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const event = makeEvent()
    await database.events.add(event)

    await repository.transitionStatus(
      event.id,
      'draft',
      'ready',
      laterTimestamp,
    )

    expect(await database.events.get(event.id)).toMatchObject({
      status: 'ready',
      updatedAt: laterTimestamp,
    })
  })

  it('rejects invalid, stale, and terminal status transitions', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const draft = makeEvent()
    const archived = makeEvent({ status: 'archived' })
    await database.events.bulkAdd([draft, archived])

    await expect(
      repository.transitionStatus(
        draft.id,
        'draft',
        'live',
        laterTimestamp,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      repository.transitionStatus(
        draft.id,
        'ready',
        'live',
        laterTimestamp,
      ),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    await expect(
      repository.transitionStatus(
        archived.id,
        'archived',
        'completed',
        laterTimestamp,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await database.events.get(draft.id)).toEqual(draft)
    expect(await database.events.get(archived.id)).toEqual(archived)
  })
})

describe('DexieEventRepository protected deletion', () => {
  it('deletes an empty draft Event', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const event = makeEvent()
    await database.events.add(event)

    await repository.deleteDraft(event.id)

    expect(await database.events.get(event.id)).toBeUndefined()
  })

  it('rejects deletion of a non-draft Event', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const event = makeEvent({ status: 'ready' })
    await database.events.add(event)

    await expect(repository.deleteDraft(event.id)).rejects.toBeInstanceOf(
      ImmutableRecordError,
    )
    expect(await database.events.get(event.id)).toEqual(event)
  })

  it('rejects a Participant dependency without cascading any data', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const target = makeEvent()
    const other = makeEvent({ name: 'Other Event' })
    const targetParticipant = makeParticipant(target, '00042')
    const otherParticipant = makeParticipant(other, '90001')
    await database.events.bulkAdd([target, other])
    await database.participants.bulkAdd([
      targetParticipant,
      otherParticipant,
    ])

    await expect(repository.deleteDraft(target.id)).rejects.toBeInstanceOf(
      ImmutableRecordError,
    )
    expect(await database.events.get(target.id)).toEqual(target)
    expect(await database.participants.toArray()).toHaveLength(2)
    expect(await database.participants.get(otherParticipant.id)).toEqual(
      otherParticipant,
    )
  })

  it('rejects configuration and history dependencies', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const configurationEvent = makeEvent({
      name: 'Configuration Event',
    })
    const historyEvent = makeEvent({ name: 'History Event' })
    const category = makePrizeCategory(configurationEvent)
    await database.events.bulkAdd([configurationEvent, historyEvent])
    await database.draw_configurations.add(
      makeDrawConfiguration(configurationEvent, category),
    )
    await database.audit_records.add(
      makeAudit(historyEvent, 'event-created'),
    )

    await expect(
      repository.deleteDraft(configurationEvent.id),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    await expect(
      repository.deleteDraft(historyEvent.id),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(await database.events.count()).toBe(2)
    expect(await database.draw_configurations.count()).toBe(1)
    expect(await database.audit_records.count()).toBe(1)
  })

  it('rejects deletion while the typed activeEventId preference references the Event', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieEventRepository(database)
    const event = makeEvent()
    const preference: ApplicationPreference<'activeEventId'> = {
      key: 'activeEventId',
      updatedAt: timestamp,
      value: event.id,
    }
    await database.events.add(event)
    await database.preferences.add(preference)

    await expect(repository.deleteDraft(event.id)).rejects.toBeInstanceOf(
      ImmutableRecordError,
    )
    expect(await database.events.get(event.id)).toEqual(event)
    expect(await database.preferences.get('activeEventId')).toEqual(
      preference,
    )
  })
})

describe('DexieParticipantRepository exact ticket behavior', () => {
  it('round-trips "00042" exactly and keeps it distinct from "42"', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    const leadingZero = makeParticipant(event, '00042')
    const plain = makeParticipant(event, '42')
    await database.events.add(event)

    await repository.createBatch([leadingZero, plain])

    expect(
      await repository.findByTicketNumber(event.id, ticket('00042')),
    ).toEqual(leadingZero)
    expect(
      await repository.findByTicketNumber(event.id, ticket('42')),
    ).toEqual(plain)
    expect(typeof leadingZero.ticketNumber).toBe('string')
  })

  it('allows the same exact ticket in different Events', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const firstEvent = makeEvent()
    const secondEvent = makeEvent()
    const first = makeParticipant(firstEvent, '00042')
    const second = makeParticipant(secondEvent, '00042')
    await database.events.bulkAdd([firstEvent, secondEvent])

    await repository.createBatch([first])
    await repository.createBatch([second])

    expect(
      await repository.findByTicketNumber(
        firstEvent.id,
        ticket('00042'),
      ),
    ).toEqual(first)
    expect(
      await repository.findByTicketNumber(
        secondEvent.id,
        ticket('00042'),
      ),
    ).toEqual(second)
  })

  it('returns null for missing Participant reads', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)

    expect(await repository.findById(createParticipantId())).toBeNull()
    expect(
      await repository.findByTicketNumber(
        createEventId(),
        ticket('00042'),
      ),
    ).toBeNull()
  })
})

describe('DexieParticipantRepository batch atomicity', () => {
  it('inserts a valid batch completely and rejects an empty batch', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    const participants = [
      makeParticipant(event, '00001'),
      makeParticipant(event, '00002'),
    ]
    await database.events.add(event)

    await repository.createBatch(participants)
    await expect(repository.createBatch([])).rejects.toBeInstanceOf(
      ValidationError,
    )

    expect(await database.participants.toArray()).toEqual(
      expect.arrayContaining(participants),
    )
    expect(await database.participants.count()).toBe(2)
  })

  it('rejects duplicate submitted IDs without a partial insert', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    const first = makeParticipant(event, '00001')
    const duplicateId = makeParticipant(event, '00002', {
      id: first.id,
    })
    await database.events.add(event)

    await expect(
      repository.createBatch([first, duplicateId]),
    ).rejects.toBeInstanceOf(DuplicateRecordError)
    expect(await database.participants.count()).toBe(0)
  })

  it('rejects duplicate submitted tickets without a partial insert', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    const first = makeParticipant(event, '00001')
    const duplicateTicket = makeParticipant(event, '00001')
    await database.events.add(event)

    await expect(
      repository.createBatch([first, duplicateTicket]),
    ).rejects.toBeInstanceOf(DuplicateRecordError)
    expect(await database.participants.count()).toBe(0)
  })

  it('rolls back the whole batch on a stored ticket conflict and hides raw Dexie errors', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    const stored = makeParticipant(event, '00001')
    const newParticipant = makeParticipant(event, '00002')
    const conflict = makeParticipant(event, '00001')
    await database.events.add(event)
    await database.participants.add(stored)

    const error = await captureError(
      repository.createBatch([newParticipant, conflict]),
    )

    expect(error).toBeInstanceOf(DuplicateRecordError)
    expect(error).toMatchObject({ code: 'duplicate-record' })
    if (!(error instanceof DuplicateRecordError)) {
      throw new Error('Expected a normalized duplicate error.')
    }
    expect(error.name).not.toBe('ConstraintError')
    expect(error.cause).toBeDefined()
    expect(await database.participants.toArray()).toEqual([stored])
  })

  it('rejects one invalid Participant before any write', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    const valid = makeParticipant(event, '00001')
    const invalid = withInvalidUpdatedAt(
      makeParticipant(event, '00002'),
    )
    await database.events.add(event)

    await expect(
      repository.createBatch([valid, invalid]),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await database.participants.count()).toBe(0)
  })

  it('rejects a mixed-Event batch before any write', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const firstEvent = makeEvent()
    const secondEvent = makeEvent()
    await database.events.bulkAdd([firstEvent, secondEvent])

    await expect(
      repository.createBatch([
        makeParticipant(firstEvent, '00001'),
        makeParticipant(secondEvent, '00002'),
      ]),
    ).rejects.toBeInstanceOf(RelationshipMismatchError)
    expect(await database.participants.count()).toBe(0)
  })

  it('rejects a missing parent Event before any write', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const missingParent = makeEvent()

    await expect(
      repository.createBatch([
        makeParticipant(missingParent, '00001'),
      ]),
    ).rejects.toBeInstanceOf(RecordNotFoundError)
    expect(await database.participants.count()).toBe(0)
  })
})

describe('DexieParticipantRepository bounded indexed reads', () => {
  it('returns deterministic limit/offset pages scoped to one Event', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const target = makeEvent()
    const other = makeEvent()
    const targetParticipants = [
      makeParticipant(target, '00003'),
      makeParticipant(target, '00001'),
      makeParticipant(target, '00004'),
      makeParticipant(target, '00002'),
    ]
    const otherParticipant = makeParticipant(other, '90001')
    await database.events.bulkAdd([target, other])
    await database.participants.bulkAdd([
      ...targetParticipants,
      otherParticipant,
    ])
    const expected = [...targetParticipants].sort((left, right) =>
      left.id.localeCompare(right.id),
    )

    expect(
      await repository.findByEventId(target.id, {
        limit: 2,
        offset: 1,
      }),
    ).toEqual(expected.slice(1, 3))
    expect(await repository.countByEventId(target.id)).toBe(4)
    expect(await repository.countByEventId(other.id)).toBe(1)
  })

  it.each([
    { limit: 0, offset: 0 },
    { limit: -1, offset: 0 },
    { limit: 1.5, offset: 0 },
    { limit: 1, offset: -1 },
    { limit: 1, offset: 0.5 },
  ])('rejects invalid pagination: $limit/$offset', async (page) => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)

    await expect(
      repository.findByEventId(createEventId(), page),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('uses indexed collection access rather than full-table reads', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    await database.events.add(event)
    await database.participants.bulkAdd([
      makeParticipant(event, '00001'),
      makeParticipant(event, '00002'),
    ])
    const fullTableRead = vi.spyOn(database.participants, 'toArray')

    await repository.findByEventId(event.id, {
      limit: 1,
      offset: 0,
    })
    await repository.countByEventId(event.id)

    expect(fullTableRead).not.toHaveBeenCalled()
  })
})

describe('DexieParticipantRepository operational updates', () => {
  it('updates allowed fields and preserves immutable identity and ticket fields', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    const participant = makeParticipant(event, '00042')
    await database.events.add(event)
    await database.participants.add(participant)

    await repository.updateOperationalFields(participant.id, {
      group: 'VIP',
      isCheckedIn: true,
      name: 'Ayu',
      notes: 'Front row',
      updatedAt: laterTimestamp,
    })

    expect(await database.participants.get(participant.id)).toEqual({
      ...participant,
      group: 'VIP',
      isCheckedIn: true,
      name: 'Ayu',
      notes: 'Front row',
      updatedAt: laterTimestamp,
    })
    expect(
      (await database.participants.get(participant.id))?.ticketNumber,
    ).toBe('00042')
  })

  it('does not remove optional values when an undefined change is supplied', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    const participant = makeParticipant(event, '00042', {
      name: 'Ayu',
    })
    await database.events.add(event)
    await database.participants.add(participant)

    await repository.updateOperationalFields(participant.id, {
      name: undefined,
      updatedAt: laterTimestamp,
    })

    expect(await database.participants.get(participant.id)).toMatchObject({
      name: 'Ayu',
      updatedAt: laterTimestamp,
    })
  })

  it.each([
    'id',
    'eventId',
    'ticketNumber',
    'createdAt',
  ])('rejects a runtime attempt to change immutable field %s', async (field) => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    const participant = makeParticipant(event, '00042')
    await database.events.add(event)
    await database.participants.add(participant)
    const changes: ParticipantOperationalChanges = {
      updatedAt: laterTimestamp,
    }
    Object.defineProperty(changes, field, {
      enumerable: true,
      value: ticket('99999'),
    })

    await expect(
      repository.updateOperationalFields(participant.id, changes),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await database.participants.get(participant.id)).toEqual(
      participant,
    )
  })

  it('rejects a missing Participant and revalidates the resulting entity', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    const participant = makeParticipant(event, '00042')
    await database.events.add(event)
    await database.participants.add(participant)

    await expect(
      repository.updateOperationalFields(createParticipantId(), {
        updatedAt: laterTimestamp,
      }),
    ).rejects.toBeInstanceOf(RecordNotFoundError)

    const invalidChanges: ParticipantOperationalChanges = {
      updatedAt: latestTimestamp,
    }
    Object.defineProperty(invalidChanges, 'updatedAt', {
      enumerable: true,
      value: 'invalid',
    })
    await expect(
      repository.updateOperationalFields(
        participant.id,
        invalidChanges,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await database.participants.get(participant.id)).toEqual(
      participant,
    )
  })
})

describe('DexieParticipantRepository protected deletion', () => {
  it('deletes only Participants belonging to the target draft Event', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const target = makeEvent()
    const other = makeEvent()
    const targetParticipants = [
      makeParticipant(target, '00001'),
      makeParticipant(target, '00002'),
    ]
    const otherParticipant = makeParticipant(other, '90001')
    await database.events.bulkAdd([target, other])
    await database.participants.bulkAdd([
      ...targetParticipants,
      otherParticipant,
    ])

    await repository.deleteDraftEventParticipants(target.id)

    expect(await repository.countByEventId(target.id)).toBe(0)
    expect(await repository.countByEventId(other.id)).toBe(1)
    expect(await repository.findById(otherParticipant.id)).toEqual(
      otherParticipant,
    )
    expect(await database.events.get(target.id)).toEqual(target)
  })

  it('rejects a non-draft Event and leaves every Participant intact', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent({ status: 'ready' })
    const participant = makeParticipant(event, '00001')
    await database.events.add(event)
    await database.participants.add(participant)

    await expect(
      repository.deleteDraftEventParticipants(event.id),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(await database.participants.get(participant.id)).toEqual(
      participant,
    )
  })

  it('blocks deletion for draw-session history and preserves all Participants', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const event = makeEvent()
    const participants = [
      makeParticipant(event, '00001'),
      makeParticipant(event, '00002'),
    ]
    await database.events.add(event)
    await database.participants.bulkAdd(participants)
    await database.draw_sessions.add(makeDraftDrawSession(event))

    await expect(
      repository.deleteDraftEventParticipants(event.id),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    expect(await database.participants.count()).toBe(2)
  })

  it('blocks deletion for official audit history but not an event-created audit', async () => {
    const database = await createOpenDatabase()
    const repository = new DexieParticipantRepository(database)
    const officialEvent = makeEvent({ name: 'Official' })
    const setupOnlyEvent = makeEvent({ name: 'Setup only' })
    const officialParticipant = makeParticipant(
      officialEvent,
      '00001',
    )
    const setupParticipant = makeParticipant(setupOnlyEvent, '00002')
    await database.events.bulkAdd([officialEvent, setupOnlyEvent])
    await database.participants.bulkAdd([
      officialParticipant,
      setupParticipant,
    ])
    await database.audit_records.bulkAdd([
      makeAudit(officialEvent, 'winner-confirmed'),
      makeAudit(setupOnlyEvent, 'event-created'),
    ])

    await expect(
      repository.deleteDraftEventParticipants(officialEvent.id),
    ).rejects.toBeInstanceOf(ImmutableRecordError)
    await repository.deleteDraftEventParticipants(setupOnlyEvent.id)

    expect(
      await database.participants.get(officialParticipant.id),
    ).toEqual(officialParticipant)
    expect(
      await database.participants.get(setupParticipant.id),
    ).toBeUndefined()
    expect(await database.audit_records.count()).toBe(2)
  })
})

describe('Slice 3 source boundaries', () => {
  const interfaceSources = import.meta.glob(
    '../../../application/persistence/repositories/*.ts',
    {
      eager: true,
      import: 'default',
      query: '?raw',
    },
  )
  const implementationSources = import.meta.glob(
    ['./event.repository.ts', './participant.repository.ts'],
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

  it('keeps application interfaces domain-only', () => {
    for (const [path, source] of Object.entries(interfaceSources)) {
      expect(source, path).toEqual(expect.any(String))
      if (typeof source !== 'string') {
        continue
      }

      expect(source, path).not.toMatch(/dexie|indexedDB|react|prototype/i)
      const imports = source.matchAll(/from\s+['"]([^'"]+)['"]/g)
      for (const match of imports) {
        expect(match[1], path).toContain('/domain/')
      }
    }
  })

  it('keeps implementations free of React, prototype, and database lifecycle side effects', () => {
    for (const [path, source] of Object.entries(implementationSources)) {
      expect(source, path).toEqual(expect.any(String))
      if (typeof source !== 'string') {
        continue
      }

      expect(source, path).not.toMatch(/from\s+['"]react/)
      expect(source, path).not.toMatch(/from\s+['"][^'"]*prototype/)
      expect(source, path).not.toContain('new RaffleOSDatabase')
      expect(source, path).not.toMatch(/database\.open(?:Supported)?\s*\(/)
    }
  })

  it('keeps pages, routes, UI, and prototype disconnected from repositories', () => {
    for (const [path, source] of Object.entries(applicationSources)) {
      expect(source, path).toEqual(expect.any(String))
      if (typeof source !== 'string') {
        continue
      }

      expect(source, path).not.toMatch(
        /(?:from\s+|import\s*\()['"][^'"]*persistence\/repositories/,
      )
    }
  })

  it('contains no import parsing, eligibility, or draw-selection implementation', () => {
    for (const [path, source] of Object.entries(
      implementationSources,
    )) {
      if (typeof source !== 'string') {
        continue
      }

      expect(source, path).not.toMatch(
        /csv|xlsx|Math\.random|crypto\.getRandomValues|Fisher.Yates/i,
      )
    }
  })
})
