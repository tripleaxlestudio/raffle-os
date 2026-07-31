import type {
  ParticipantPage,
  ParticipantRepository,
} from '../../../application/persistence/repositories/participant-repository.interface.ts'
import { validateParticipant } from '../../../domain/participants/participant.invariants.ts'
import type {
  Participant,
  ParticipantOperationalChanges,
  TicketNumber,
} from '../../../domain/participants/participant.types.ts'
import type {
  EventId,
  ParticipantId,
} from '../../../domain/shared/identifiers.ts'
import type { RaffleOSDatabase } from '../db.ts'
import {
  DuplicateRecordError,
  ImmutableRecordError,
  isUniqueConstraintError,
  PersistenceError,
  RecordNotFoundError,
  RelationshipMismatchError,
  StorageQuotaError,
  TransactionError,
  ValidationError,
} from '../errors/persistence-errors.ts'

const OPERATIONAL_CHANGE_KEYS = new Set([
  'group',
  'isCheckedIn',
  'name',
  'notes',
  'updatedAt',
])

const OFFICIAL_AUDIT_ACTIONS = new Set([
  'draw-session-started',
  'draw-session-completed',
  'draw-session-cancelled',
  'winner-confirmed',
  'winner-cancelled',
  'redraw-recorded',
])

function errorName(value: unknown): string | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('name' in value) ||
    typeof value.name !== 'string'
  ) {
    return null
  }

  return value.name
}

function hasUniqueConstraintError(
  value: unknown,
  seen: Set<object> = new Set<object>(),
): boolean {
  if (isUniqueConstraintError(value)) {
    return true
  }

  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return false
  }

  seen.add(value)

  if (
    'cause' in value &&
    hasUniqueConstraintError(value.cause, seen)
  ) {
    return true
  }

  if (
    'inner' in value &&
    hasUniqueConstraintError(value.inner, seen)
  ) {
    return true
  }

  if ('failures' in value && Array.isArray(value.failures)) {
    return value.failures.some((failure) =>
      hasUniqueConstraintError(failure, seen),
    )
  }

  return false
}

function normalizeRepositoryError(
  error: unknown,
  operation: string,
): PersistenceError {
  if (error instanceof PersistenceError) {
    return error
  }

  const options: ErrorOptions = { cause: error }

  if (hasUniqueConstraintError(error)) {
    return new DuplicateRecordError(
      `${operation} conflicts with an existing Participant identifier or ticket number.`,
      options,
    )
  }

  if (errorName(error) === 'QuotaExceededError') {
    return new StorageQuotaError(undefined, options)
  }

  return new TransactionError(`${operation} failed.`, options)
}

function validateParticipantForPersistence(
  participant: Participant,
): void {
  const result = validateParticipant(participant)
  if (!result.ok) {
    throw new ValidationError(result.error.message, {
      cause: result.error,
    })
  }
}

function validatePage(page: ParticipantPage): void {
  if (!Number.isInteger(page.limit) || page.limit < 1) {
    throw new ValidationError(
      'Participant page limit must be a positive integer.',
    )
  }

  if (!Number.isInteger(page.offset) || page.offset < 0) {
    throw new ValidationError(
      'Participant page offset must be a non-negative integer.',
    )
  }
}

export class DexieParticipantRepository
  implements ParticipantRepository
{
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async findById(id: ParticipantId): Promise<Participant | null> {
    try {
      return (await this.database.participants.get(id)) ?? null
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Finding the Participant')
    }
  }

  async findByTicketNumber(
    eventId: EventId,
    ticketNumber: TicketNumber,
  ): Promise<Participant | null> {
    try {
      const participant = await this.database.participants
        .where('[eventId+ticketNumber]')
        .equals([eventId, ticketNumber])
        .first()

      return participant ?? null
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Finding the Participant by ticket number',
      )
    }
  }

  async findByEventId(
    eventId: EventId,
    page: ParticipantPage,
  ): Promise<Participant[]> {
    try {
      validatePage(page)

      /*
       * IndexedDB index cursors order duplicate eventId keys by primary key,
       * giving pages a deterministic Participant-id order without a full scan.
       */
      return await this.database.participants
        .where('eventId')
        .equals(eventId)
        .offset(page.offset)
        .limit(page.limit)
        .toArray()
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Listing Event Participants')
    }
  }

  async countByEventId(eventId: EventId): Promise<number> {
    try {
      return await this.database.participants
        .where('eventId')
        .equals(eventId)
        .count()
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Counting Event Participants')
    }
  }

  async createBatch(
    participants: readonly Participant[],
  ): Promise<void> {
    try {
      if (participants.length === 0) {
        throw new ValidationError(
          'A Participant batch must contain at least one record.',
        )
      }

      const eventId = participants[0]?.eventId
      if (eventId === undefined) {
        throw new ValidationError(
          'A Participant batch must contain at least one record.',
        )
      }

      const ids = new Set<string>()
      const ticketNumbers = new Set<string>()

      for (const participant of participants) {
        validateParticipantForPersistence(participant)

        if (participant.eventId !== eventId) {
          throw new RelationshipMismatchError(
            'Every Participant in a batch must belong to the same Event.',
          )
        }

        if (ids.has(participant.id)) {
          throw new DuplicateRecordError(
            'A Participant ID appears more than once in the submitted batch.',
          )
        }

        if (ticketNumbers.has(participant.ticketNumber)) {
          throw new DuplicateRecordError(
            'A ticket number appears more than once in the submitted batch.',
          )
        }

        ids.add(participant.id)
        ticketNumbers.add(participant.ticketNumber)
      }

      await this.database.transaction(
        'rw',
        this.database.events,
        this.database.participants,
        async () => {
          const parentEvent = await this.database.events.get(eventId)
          if (parentEvent === undefined) {
            throw new RecordNotFoundError(
              'The parent Event for the Participant batch was not found.',
            )
          }

          await this.database.participants.bulkAdd([...participants])
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Creating Participants')
    }
  }

  async updateOperationalFields(
    id: ParticipantId,
    changes: ParticipantOperationalChanges,
  ): Promise<void> {
    try {
      const unsupportedKeys = Object.keys(changes).filter(
        (key) => !OPERATIONAL_CHANGE_KEYS.has(key),
      )
      if (unsupportedKeys.length > 0) {
        throw new ValidationError(
          `Participant operational changes contain unsupported fields: ${unsupportedKeys.join(', ')}.`,
        )
      }

      await this.database.transaction(
        'rw',
        this.database.participants,
        async () => {
          const current = await this.database.participants.get(id)
          if (current === undefined) {
            throw new RecordNotFoundError(
              'The Participant required for an operational update was not found.',
            )
          }

          let updated: Participant = {
            ...current,
            isCheckedIn:
              changes.isCheckedIn ?? current.isCheckedIn,
            updatedAt: changes.updatedAt,
          }

          if (changes.name !== undefined) {
            updated = { ...updated, name: changes.name }
          }
          if (changes.group !== undefined) {
            updated = { ...updated, group: changes.group }
          }
          if (changes.notes !== undefined) {
            updated = { ...updated, notes: changes.notes }
          }

          validateParticipantForPersistence(updated)
          await this.database.participants.put(updated)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Updating Participant operational fields',
      )
    }
  }

  async deleteDraftEventParticipants(eventId: EventId): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.participants,
          this.database.draw_sessions,
          this.database.winner_records,
          this.database.redraw_records,
          this.database.audit_records,
        ],
        async () => {
          const event = await this.database.events.get(eventId)
          if (event === undefined) {
            throw new RecordNotFoundError(
              'The parent Event required for Participant deletion was not found.',
            )
          }

          if (event.status !== 'draft') {
            throw new ImmutableRecordError(
              'Participants can be deleted only from a draft Event.',
            )
          }

          const [
            drawSession,
            winnerRecord,
            redrawRecord,
            officialAuditRecord,
          ] = await Promise.all([
            this.database.draw_sessions
              .where('eventId')
              .equals(eventId)
              .first(),
            this.database.winner_records
              .where('eventId')
              .equals(eventId)
              .first(),
            this.database.redraw_records
              .where('eventId')
              .equals(eventId)
              .first(),
            this.database.audit_records
              .where('eventId')
              .equals(eventId)
              .filter((record) =>
                OFFICIAL_AUDIT_ACTIONS.has(record.action),
              )
              .first(),
          ])

          if (
            drawSession !== undefined ||
            winnerRecord !== undefined ||
            redrawRecord !== undefined ||
            officialAuditRecord !== undefined
          ) {
            throw new ImmutableRecordError(
              'Official history protects this Event from Participant deletion.',
            )
          }

          await this.database.participants
            .where('eventId')
            .equals(eventId)
            .delete()
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Deleting draft Event Participants',
      )
    }
  }
}
