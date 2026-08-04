import Dexie from 'dexie'
import {
  IDBKeyRange,
  indexedDB,
} from 'fake-indexeddb'
import type { AuditRecord } from '../../../domain/audit/audit.types.ts'
import type { DrawConfiguration } from '../../../domain/draws/draw-configuration.types.ts'
import type {
  DrawSession,
  DrawSessionStatus,
  DrawStartSnapshots,
} from '../../../domain/draws/draw-session.types.ts'
import type { Event } from '../../../domain/events/event.types.ts'
import { parseTicketNumber } from '../../../domain/participants/participant.invariants.ts'
import type {
  Participant,
  TicketNumber,
} from '../../../domain/participants/participant.types.ts'
import type { PrizeCategory } from '../../../domain/prizes/prize.types.ts'
import type { Result } from '../../../domain/shared/result.ts'
import {
  createAuditRecordId,
  createDrawConfigurationId,
  createDrawSessionId,
  createEventId,
  createParticipantId,
  createPrizeCategoryId,
  createRedrawRecordId,
  createWinnerRecordId,
} from '../../../domain/shared/identifiers.ts'
import { parseIsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { RedrawRecord } from '../../../domain/winners/redraw.types.ts'
import type {
  WinnerRecord,
  WinnerStatus,
} from '../../../domain/winners/winner.types.ts'
import { RaffleOSDatabase } from '../db.ts'

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message)
  }
  return result.value
}

export const TIME_1 = unwrap(
  parseIsoTimestamp('2026-07-31T01:00:00.000Z'),
)
export const TIME_2 = unwrap(
  parseIsoTimestamp('2026-07-31T02:00:00.000Z'),
)
export const TIME_3 = unwrap(
  parseIsoTimestamp('2026-07-31T03:00:00.000Z'),
)
export const TIME_4 = unwrap(
  parseIsoTimestamp('2026-07-31T04:00:00.000Z'),
)

const databaseNames = new Set<string>()
const databases = new Set<RaffleOSDatabase>()

export async function openTestDatabase(
  label: string,
): Promise<RaffleOSDatabase> {
  const name = `raffle-os-${label}-${crypto.randomUUID()}`
  const database = new RaffleOSDatabase(name, {
    IDBKeyRange,
    indexedDB,
  })
  databaseNames.add(name)
  databases.add(database)
  await database.openSupported()
  return database
}

export async function cleanupTestDatabases(): Promise<void> {
  for (const database of databases) {
    database.close()
  }
  databases.clear()
  for (const name of databaseNames) {
    const cleanupDatabase = new Dexie(name, {
      autoOpen: false,
      IDBKeyRange,
      indexedDB,
    })
    await cleanupDatabase.delete()
    cleanupDatabase.close()
  }
  databaseNames.clear()
}

export function ticket(value: string): TicketNumber {
  return unwrap(parseTicketNumber(value))
}

export interface DrawHistoryFixture {
  readonly event: Event
  readonly otherEvent: Event
  readonly category: PrizeCategory
  readonly configuration: DrawConfiguration
  readonly participants: readonly Participant[]
  readonly session: DrawSession
  readonly snapshots: DrawStartSnapshots
}

export function makeDrawHistoryFixture(
  candidateTickets: readonly string[] = ['00042', '00043', '00044'],
): DrawHistoryFixture {
  const event: Event = {
    id: createEventId(),
    name: 'Raffle Night',
    status: 'ready',
    createdAt: TIME_1,
    updatedAt: TIME_1,
  }
  const otherEvent: Event = {
    id: createEventId(),
    name: 'Other Event',
    status: 'ready',
    createdAt: TIME_1,
    updatedAt: TIME_1,
  }
  const category: PrizeCategory = {
    id: createPrizeCategoryId(),
    eventId: event.id,
    name: 'Grand Prize',
    prizeName: 'Electric Bicycle',
    displayOrder: 0,
    createdAt: TIME_1,
  }
  const configuration: DrawConfiguration = {
    id: createDrawConfigurationId(),
    eventId: event.id,
    prizeCategoryId: category.id,
    requestedWinners: 2,
    winningRule: 'once-per-event',
    requireCheckIn: true,
    eligibleGroupFilter: 'VIP',
    createdAt: TIME_1,
    updatedAt: TIME_1,
  }
  const participants = candidateTickets.map<Participant>(
    (ticketValue) => ({
      id: createParticipantId(),
      eventId: event.id,
      ticketNumber: ticket(ticketValue),
      isCheckedIn: true,
      group: 'VIP',
      createdAt: TIME_1,
      updatedAt: TIME_1,
    }),
  )
  const snapshots: DrawStartSnapshots = {
    configurationSnapshot: {
      snapshotFormatVersion: 1,
      configurationId: configuration.id,
      prizeCategoryId: category.id,
      categoryName: category.name,
      prizeName: category.prizeName,
      requestedWinners: configuration.requestedWinners,
      winningRule: configuration.winningRule,
      requireCheckIn: configuration.requireCheckIn,
      eligibleGroupFilter: configuration.eligibleGroupFilter,
      capturedAt: TIME_2,
    },
    candidatePoolSnapshot: {
      configurationId: configuration.id,
      snapshotFormatVersion: 1,
      capturedAt: TIME_2,
      eventId: event.id,
      mode: 'live',
      prizeCategoryId: category.id,
      winningRule: configuration.winningRule,
      requireCheckIn: configuration.requireCheckIn,
      eligibleGroupFilter: configuration.eligibleGroupFilter,
      candidateEntries: participants.map((participant) => ({
        participantId: participant.id,
        ticketNumber: participant.ticketNumber,
      })),
      eligibleSnapshotCount: participants.length,
    },
  }
  const session: DrawSession = {
    id: createDrawSessionId(),
    eventId: event.id,
    configurationId: configuration.id,
    mode: 'live',
    status: 'ready',
    configurationSnapshot: null,
    candidatePoolSnapshot: null,
    createdAt: TIME_1,
    updatedAt: TIME_1,
  }

  return {
    event,
    otherEvent,
    category,
    configuration,
    participants,
    session,
    snapshots,
  }
}

export async function seedFixtureParents(
  database: RaffleOSDatabase,
  fixture: DrawHistoryFixture,
): Promise<void> {
  await database.events.bulkAdd([fixture.event, fixture.otherEvent])
  await database.prize_categories.add(fixture.category)
  await database.draw_configurations.add(fixture.configuration)
  await database.participants.bulkAdd([...fixture.participants])
}

export async function seedReadyFixture(
  database: RaffleOSDatabase,
  fixture: DrawHistoryFixture,
): Promise<void> {
  await seedFixtureParents(database, fixture)
  await database.draw_sessions.add(fixture.session)
}

export async function seedStartedFixture(
  database: RaffleOSDatabase,
  fixture: DrawHistoryFixture,
  status: DrawSessionStatus = 'pending-confirmation',
): Promise<DrawSession> {
  await seedFixtureParents(database, fixture)
  const session: DrawSession = {
    ...fixture.session,
    status,
    configurationSnapshot: fixture.snapshots.configurationSnapshot,
    candidatePoolSnapshot: fixture.snapshots.candidatePoolSnapshot,
    updatedAt: TIME_2,
  }
  await database.draw_sessions.add(session)
  return session
}

export function makeWinner(
  fixture: DrawHistoryFixture,
  participantIndex: number,
  sequenceNumber: number,
  changes: Partial<WinnerRecord> = {},
): WinnerRecord {
  const participant = fixture.participants[participantIndex]
  if (participant === undefined) {
    throw new Error('Fixture participant does not exist.')
  }
  const status: WinnerStatus = changes.status ?? 'pending'
  return {
    id: createWinnerRecordId(),
    eventId: fixture.event.id,
    prizeCategoryId: fixture.category.id,
    drawSessionId: fixture.session.id,
    participantId: participant.id,
    ticketNumber: participant.ticketNumber,
    sequenceNumber,
    status,
    createdAt: TIME_2,
    updatedAt: TIME_2,
    ...(status === 'confirmed' ? { confirmedAt: TIME_2 } : {}),
    ...(status === 'cancelled' ? { cancelledAt: TIME_2 } : {}),
    ...changes,
  }
}

export function makeAudit(
  fixture: DrawHistoryFixture,
  action: AuditRecord['action'] = 'draw-session-started',
  changes: Partial<AuditRecord> = {},
): AuditRecord {
  return {
    id: createAuditRecordId(),
    eventId: fixture.event.id,
    action,
    actor: { type: 'system' },
    detail: {},
    timestamp: TIME_2,
    ...changes,
  }
}

export function makeRedraw(
  fixture: DrawHistoryFixture,
  original: WinnerRecord,
  replacement: WinnerRecord,
  changes: Partial<RedrawRecord> = {},
): RedrawRecord {
  return {
    id: createRedrawRecordId(),
    eventId: fixture.event.id,
    drawSessionId: fixture.session.id,
    originalWinnerRecordId: original.id,
    replacementWinnerRecordId: replacement.id,
    reason: 'absent',
    createdAt: TIME_3,
    ...changes,
  }
}
