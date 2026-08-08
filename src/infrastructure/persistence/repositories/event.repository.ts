import type { EventRepository } from '../../../application/persistence/repositories/event-repository.interface.ts'
import {
  canPermanentlyDeleteEvent,
  transitionEventStatus,
  validateEvent,
} from '../../../domain/events/event.invariants.ts'
import type {
  Event,
  EventStatus,
} from '../../../domain/events/event.types.ts'
import type { EventId } from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { RaffleOSDatabase } from '../db.ts'
import { isDrawSessionAuthoringLocked } from '../../../domain/draws/draw-session.types.ts'
import {
  DuplicateRecordError,
  ImmutableRecordError,
  isUniqueConstraintError,
  PersistenceError,
  RecordNotFoundError,
  StorageQuotaError,
  TransactionError,
  ValidationError,
} from '../errors/persistence-errors.ts'

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
      `${operation} conflicts with an existing unique record.`,
      options,
    )
  }

  if (errorName(error) === 'QuotaExceededError') {
    return new StorageQuotaError(undefined, options)
  }

  return new TransactionError(`${operation} failed.`, options)
}

function validateEventForPersistence(event: Event): void {
  const result = validateEvent(event)
  if (!result.ok) {
    throw new ValidationError(result.error.message, {
      cause: result.error,
    })
  }
}

export class DexieEventRepository implements EventRepository {
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async findById(id: EventId): Promise<Event | null> {
    try {
      return (await this.database.events.get(id)) ?? null
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Finding the Event')
    }
  }

  async findAll(): Promise<Event[]> {
    try {
      const events = await this.database.events
        .orderBy('createdAt')
        .toArray()

      return events.sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id),
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Listing Events')
    }
  }

  async create(event: Event): Promise<void> {
    try {
      validateEventForPersistence(event)
      await this.database.events.add(event)
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Creating the Event')
    }
  }

  async updateDraft(event: Event): Promise<void> {
    try {
      validateEventForPersistence(event)

      await this.database.transaction(
        'rw',
        this.database.events,
        async () => {
          const current = await this.database.events.get(event.id)
          if (current === undefined) {
            throw new RecordNotFoundError(
              'The Event required for a draft update was not found.',
            )
          }

          if (current.status !== 'draft') {
            throw new ImmutableRecordError(
              'Only a draft Event can be updated.',
            )
          }

          if (
            event.status !== current.status ||
            event.createdAt !== current.createdAt
          ) {
            throw new ImmutableRecordError(
              'Draft updates cannot change Event status or creation time.',
            )
          }

          const updated: Event = {
            ...current,
            description: event.description,
            name: event.name,
            scheduledAt: event.scheduledAt,
            updatedAt: event.updatedAt,
          }
          validateEventForPersistence(updated)
          await this.database.events.put(updated)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Updating the draft Event')
    }
  }

  async transitionStatus(
    id: EventId,
    from: EventStatus,
    to: EventStatus,
    at: IsoTimestamp,
  ): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        this.database.events,
        async () => {
          const current = await this.database.events.get(id)
          if (current === undefined) {
            throw new RecordNotFoundError(
              'The Event required for a status transition was not found.',
            )
          }

          validateEventForPersistence(current)

          if (current.status !== from) {
            throw new ImmutableRecordError(
              `Event status is ${current.status}, not the expected ${from}.`,
            )
          }

          const transition = transitionEventStatus(current, to, at)
          if (!transition.ok) {
            throw new ValidationError(transition.error.message, {
              cause: transition.error,
            })
          }

          validateEventForPersistence(transition.value)
          await this.database.events.put(transition.value)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Transitioning Event status')
    }
  }

  async deleteDraft(id: EventId): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.participants,
          this.database.prize_categories,
          this.database.draw_configurations,
          this.database.display_configurations,
          this.database.draw_sessions,
          this.database.winner_records,
          this.database.redraw_records,
          this.database.audit_records,
          this.database.preferences,
        ],
        async () => {
          const event = await this.database.events.get(id)
          if (event === undefined) {
            throw new RecordNotFoundError(
              'The Event required for deletion was not found.',
            )
          }

          if (event.status !== 'draft') {
            throw new ImmutableRecordError(
              'Only an unreferenced draft Event can be deleted.',
            )
          }

          const [
            participant,
            prizeCategory,
            drawConfiguration,
            displayConfiguration,
            drawSession,
            winnerRecord,
            redrawRecord,
            auditRecord,
            activeEventPreference,
          ] = await Promise.all([
            this.database.participants.where('eventId').equals(id).first(),
            this.database.prize_categories.where('eventId').equals(id).first(),
            this.database.draw_configurations
              .where('eventId')
              .equals(id)
              .first(),
            this.database.display_configurations
              .where('eventId')
              .equals(id)
              .first(),
            this.database.draw_sessions.where('eventId').equals(id).first(),
            this.database.winner_records.where('eventId').equals(id).first(),
            this.database.redraw_records.where('eventId').equals(id).first(),
            this.database.audit_records.where('eventId').equals(id).first(),
            this.database.preferences.get('activeEventId'),
          ])

          if (
            participant !== undefined ||
            prizeCategory !== undefined ||
            drawConfiguration !== undefined ||
            displayConfiguration !== undefined ||
            drawSession !== undefined ||
            winnerRecord !== undefined ||
            redrawRecord !== undefined ||
            auditRecord !== undefined ||
            activeEventPreference?.value === id
          ) {
            throw new ImmutableRecordError(
              'The draft Event has dependent records and cannot be deleted.',
            )
          }

          await this.database.events.delete(id)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Deleting the draft Event')
    }
  }

  async deletePermanently(id: EventId): Promise<void> {
    try {
      await this.database.transaction('rw', [
        this.database.events, this.database.participants, this.database.prize_categories,
        this.database.draw_configurations, this.database.display_configurations,
        this.database.event_settings, this.database.draw_sessions, this.database.winner_records,
        this.database.redraw_records, this.database.audit_records, this.database.preferences,
        this.database.presentation_checkpoints, this.database.command_receipts,
      ], async () => {
        const event = await this.database.events.get(id)
        if (event === undefined) throw new RecordNotFoundError('The Event required for deletion was not found.')
        const sessions = await this.database.draw_sessions.where('eventId').equals(id).toArray()
        const blocked = sessions.find(isDrawSessionAuthoringLocked)
        if (!canPermanentlyDeleteEvent(event, blocked !== undefined)) {
          throw new ImmutableRecordError(blocked === undefined
            ? 'This Event cannot be deleted while it is operational.'
            : `This Event cannot be deleted while a DrawSession is ${blocked.status}.`)
        }
        const sessionIds = sessions.map((session) => session.id)
        await Promise.all([
          this.database.participants.where('eventId').equals(id).delete(),
          this.database.prize_categories.where('eventId').equals(id).delete(),
          this.database.draw_configurations.where('eventId').equals(id).delete(),
          this.database.display_configurations.where('eventId').equals(id).delete(),
          this.database.event_settings.where('eventId').equals(id).delete(),
          this.database.draw_sessions.where('eventId').equals(id).delete(),
          this.database.winner_records.where('eventId').equals(id).delete(),
          this.database.redraw_records.where('eventId').equals(id).delete(),
          this.database.audit_records.where('eventId').equals(id).delete(),
          ...sessionIds.map((sessionId) => this.database.presentation_checkpoints.delete(sessionId)),
          ...sessionIds.map((sessionId) => this.database.command_receipts.where('drawSessionId').equals(sessionId).delete()),
        ])
        const active = await this.database.preferences.get('activeEventId')
        if (active?.value === id) await this.database.preferences.delete('activeEventId')
        await this.database.events.delete(id)
      })
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Deleting the Event permanently')
    }
  }
}
