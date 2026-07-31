import type { WinnerRepository } from '../../../application/persistence/repositories/winner-repository.interface.ts'
import { validateDrawSession } from '../../../domain/draws/draw.invariants.ts'
import type { DrawSession } from '../../../domain/draws/draw-session.types.ts'
import type {
  DrawSessionId,
  EventId,
  PrizeCategoryId,
  WinnerRecordId,
} from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import {
  transitionWinnerStatus,
  validateWinnerRecord,
} from '../../../domain/winners/winner.invariants.ts'
import type {
  WinnerRecord,
  WinnerStatus,
} from '../../../domain/winners/winner.types.ts'
import type { RaffleOSDatabase } from '../db.ts'
import {
  DuplicateRecordError,
  ImmutableRecordError,
  RecordNotFoundError,
  RelationshipMismatchError,
  ValidationError,
} from '../errors/persistence-errors.ts'
import {
  normalizeRepositoryError,
  requireValid,
} from './repository-helpers.ts'

function assertWinnerTimestampState(winner: WinnerRecord): void {
  const hasConfirmedAt = winner.confirmedAt !== undefined
  const hasCancelledAt = winner.cancelledAt !== undefined

  if (
    (winner.status === 'pending' &&
      (hasConfirmedAt || hasCancelledAt)) ||
    (winner.status === 'confirmed' &&
      (!hasConfirmedAt || hasCancelledAt)) ||
    (winner.status === 'cancelled' && !hasCancelledAt)
  ) {
    throw new ValidationError(
      'Winner status timestamps conflict with the WinnerRecord status.',
    )
  }
}

function validateWinnerForPersistence(winner: WinnerRecord): void {
  requireValid(validateWinnerRecord(winner))
  assertWinnerTimestampState(winner)
}

function assertPendingWinner(winner: WinnerRecord): void {
  validateWinnerForPersistence(winner)
  if (winner.status !== 'pending') {
    throw new ValidationError(
      'A newly appended WinnerRecord must start pending.',
    )
  }
}

async function requireWinnerParentSession(
  database: RaffleOSDatabase,
  drawSessionId: DrawSessionId,
): Promise<DrawSession> {
  const session = await database.draw_sessions.get(drawSessionId)
  if (session === undefined) {
    throw new RelationshipMismatchError(
      'The parent DrawSession for the WinnerRecord was not found.',
    )
  }

  requireValid(validateDrawSession(session))
  if (
    session.configurationSnapshot === null ||
    session.candidatePoolSnapshot === null
  ) {
    throw new ImmutableRecordError(
      'WinnerRecords require a DrawSession with immutable snapshots.',
    )
  }
  if (
    session.status !== 'drawing' &&
    session.status !== 'pending-confirmation'
  ) {
    throw new ImmutableRecordError(
      'WinnerRecords can be written only while their DrawSession is drawing or pending confirmation.',
    )
  }

  const event = await database.events.get(session.eventId)
  if (event === undefined) {
    throw new RelationshipMismatchError(
      'The parent Event for the WinnerRecord DrawSession was not found.',
    )
  }

  return session
}

async function validateWinnerRelationships(
  database: RaffleOSDatabase,
  winner: WinnerRecord,
  session: DrawSession,
): Promise<void> {
  const configurationSnapshot = session.configurationSnapshot
  const candidateSnapshot = session.candidatePoolSnapshot
  if (
    configurationSnapshot === null ||
    candidateSnapshot === null
  ) {
    throw new ImmutableRecordError(
      'WinnerRecords require complete immutable DrawSession snapshots.',
    )
  }

  if (
    winner.drawSessionId !== session.id ||
    winner.eventId !== session.eventId ||
    winner.prizeCategoryId !==
      configurationSnapshot.prizeCategoryId
  ) {
    throw new RelationshipMismatchError(
      'WinnerRecord Event, DrawSession, and PrizeCategory relationships must match the parent snapshots.',
    )
  }

  const participant = await database.participants.get(
    winner.participantId,
  )
  if (
    participant === undefined ||
    participant.eventId !== winner.eventId ||
    participant.ticketNumber !== winner.ticketNumber
  ) {
    throw new RelationshipMismatchError(
      'WinnerRecord Participant and ticket must exactly match an existing Participant in the same Event.',
    )
  }

  const candidate = candidateSnapshot.candidateEntries.find(
    (entry) => entry.participantId === winner.participantId,
  )
  if (
    candidate === undefined ||
    candidate.ticketNumber !== winner.ticketNumber
  ) {
    throw new RelationshipMismatchError(
      'WinnerRecord Participant and ticket must exist together in the immutable CandidatePoolSnapshot.',
    )
  }
}

export async function appendWinnerBatchInTransaction(
  database: RaffleOSDatabase,
  winners: readonly WinnerRecord[],
): Promise<void> {
  if (winners.length === 0) {
    throw new ValidationError(
      'A WinnerRecord batch must contain at least one record.',
    )
  }

  const drawSessionId = winners[0]?.drawSessionId
  if (drawSessionId === undefined) {
    throw new ValidationError(
      'A WinnerRecord batch must contain at least one record.',
    )
  }

  const ids = new Set<string>()
  const sequences = new Set<number>()
  const participantIds = new Set<string>()
  const ticketNumbers = new Set<string>()

  for (const winner of winners) {
    assertPendingWinner(winner)
    if (winner.drawSessionId !== drawSessionId) {
      throw new RelationshipMismatchError(
        'Every submitted WinnerRecord must belong to one DrawSession.',
      )
    }
    if (ids.has(winner.id)) {
      throw new DuplicateRecordError(
        'A WinnerRecord ID appears more than once in the submitted batch.',
      )
    }
    if (sequences.has(winner.sequenceNumber)) {
      throw new DuplicateRecordError(
        'A winner sequence appears more than once in the submitted batch.',
      )
    }
    if (participantIds.has(winner.participantId)) {
      throw new DuplicateRecordError(
        'A Participant appears more than once in the submitted winner batch.',
      )
    }
    if (ticketNumbers.has(winner.ticketNumber)) {
      throw new DuplicateRecordError(
        'A ticket appears more than once in the submitted winner batch.',
      )
    }

    ids.add(winner.id)
    sequences.add(winner.sequenceNumber)
    participantIds.add(winner.participantId)
    ticketNumbers.add(winner.ticketNumber)
  }

  const session = await requireWinnerParentSession(
    database,
    drawSessionId,
  )
  for (const winner of winners) {
    await validateWinnerRelationships(database, winner, session)
  }

  const storedWinners = await database.winner_records
    .where('drawSessionId')
    .equals(drawSessionId)
    .toArray()
  const storedIds = new Set(storedWinners.map((winner) => winner.id))
  const storedSequences = new Set(
    storedWinners.map((winner) => winner.sequenceNumber),
  )
  const storedParticipants = new Set(
    storedWinners.map((winner) => winner.participantId),
  )
  const storedTickets = new Set(
    storedWinners.map((winner) => winner.ticketNumber),
  )

  for (const winner of winners) {
    if (
      storedIds.has(winner.id) ||
      storedSequences.has(winner.sequenceNumber) ||
      storedParticipants.has(winner.participantId) ||
      storedTickets.has(winner.ticketNumber)
    ) {
      throw new DuplicateRecordError(
        'The WinnerRecord conflicts with existing DrawSession history.',
      )
    }
  }

  await database.winner_records.bulkAdd([...winners])
}

export async function transitionWinnerInTransaction(
  database: RaffleOSDatabase,
  id: WinnerRecordId,
  from: WinnerStatus,
  to: WinnerStatus,
  at: IsoTimestamp,
  auditedRedraw = false,
): Promise<WinnerRecord> {
  const current = await database.winner_records.get(id)
  if (current === undefined) {
    throw new RecordNotFoundError(
      'The WinnerRecord required for a status transition was not found.',
    )
  }

  validateWinnerForPersistence(current)
  if (current.status !== from) {
    throw new ImmutableRecordError(
      `WinnerRecord status is ${current.status}, not the expected ${from}.`,
    )
  }
  if (to === 'pending') {
    throw new ImmutableRecordError(
      'A WinnerRecord cannot transition back to pending.',
    )
  }

  const session = await requireWinnerParentSession(
    database,
    current.drawSessionId,
  )
  await validateWinnerRelationships(database, current, session)

  const updated = requireValid(
    transitionWinnerStatus(current, to, at, {
      auditedRedraw,
    }),
  )
  validateWinnerForPersistence(updated)
  await database.winner_records.put(updated)
  return updated
}

function compareWinnerHistory(
  left: WinnerRecord,
  right: WinnerRecord,
): number {
  return (
    left.createdAt.localeCompare(right.createdAt) ||
    left.drawSessionId.localeCompare(right.drawSessionId) ||
    left.sequenceNumber - right.sequenceNumber ||
    left.id.localeCompare(right.id)
  )
}

export class DexieWinnerRepository implements WinnerRepository {
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async findByDrawSessionId(
    drawSessionId: DrawSessionId,
  ): Promise<WinnerRecord[]> {
    try {
      const winners = await this.database.winner_records
        .where('drawSessionId')
        .equals(drawSessionId)
        .toArray()
      return winners.sort(
        (left, right) =>
          left.sequenceNumber - right.sequenceNumber ||
          left.id.localeCompare(right.id),
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Listing DrawSession WinnerRecords',
      )
    }
  }

  async findConfirmedByEventId(
    eventId: EventId,
  ): Promise<WinnerRecord[]> {
    try {
      const winners = await this.database.winner_records
        .where('[eventId+status]')
        .equals([eventId, 'confirmed'])
        .toArray()
      return winners.sort(compareWinnerHistory)
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Listing confirmed Event WinnerRecords',
      )
    }
  }

  async findConfirmedByEventAndCategory(
    eventId: EventId,
    prizeCategoryId: PrizeCategoryId,
  ): Promise<WinnerRecord[]> {
    try {
      const winners = await this.database.winner_records
        .where('[eventId+prizeCategoryId+status]')
        .equals([eventId, prizeCategoryId, 'confirmed'])
        .toArray()
      return winners.sort(compareWinnerHistory)
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Listing confirmed Event PrizeCategory WinnerRecords',
      )
    }
  }

  async append(winner: WinnerRecord): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.participants,
          this.database.draw_sessions,
          this.database.winner_records,
        ],
        async () => {
          await appendWinnerBatchInTransaction(this.database, [winner])
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Appending the WinnerRecord',
      )
    }
  }

  async appendBatch(
    winners: readonly WinnerRecord[],
  ): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.participants,
          this.database.draw_sessions,
          this.database.winner_records,
        ],
        async () => {
          await appendWinnerBatchInTransaction(
            this.database,
            winners,
          )
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Appending WinnerRecords',
      )
    }
  }

  async transitionStatus(
    id: WinnerRecordId,
    from: WinnerStatus,
    to: WinnerStatus,
    at: IsoTimestamp,
  ): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.participants,
          this.database.draw_sessions,
          this.database.winner_records,
        ],
        async () => {
          await transitionWinnerInTransaction(
            this.database,
            id,
            from,
            to,
            at,
          )
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Transitioning WinnerRecord status',
      )
    }
  }
}
