import type { DrawConfigurationRepository } from '../../../application/persistence/repositories/draw-configuration-repository.interface.ts'
import { validateDrawConfiguration } from '../../../domain/draws/draw.invariants.ts'
import { normalizeDrawConfigurationPresentation } from '../../../domain/draws/draw.invariants.ts'
import type { DrawConfiguration } from '../../../domain/draws/draw-configuration.types.ts'
import type { DrawSessionStatus } from '../../../domain/draws/draw-session.types.ts'
import type {
  DrawConfigurationId,
  EventId,
} from '../../../domain/shared/identifiers.ts'
import type { RaffleOSDatabase } from '../db.ts'
import {
  ImmutableRecordError,
  RecordNotFoundError,
  RelationshipMismatchError,
} from '../errors/persistence-errors.ts'
import {
  normalizeRepositoryError,
  requireValid,
} from './repository-helpers.ts'

const STARTED_SESSION_STATUSES: ReadonlySet<DrawSessionStatus> =
  new Set([
    'drawing',
    'pending-confirmation',
    'completed',
    'cancelled',
  ])

export class DexieDrawConfigurationRepository
  implements DrawConfigurationRepository
{
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async findById(
    id: DrawConfigurationId,
  ): Promise<DrawConfiguration | null> {
    try {
      const configuration = await this.database.draw_configurations.get(id)
      return configuration === undefined ? null : normalizeDrawConfigurationPresentation(configuration)
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Finding the DrawConfiguration',
      )
    }
  }

  async findByEventId(
    eventId: EventId,
  ): Promise<DrawConfiguration[]> {
    try {
      const configurations =
        await this.database.draw_configurations
          .where('eventId')
          .equals(eventId)
          .toArray()

      return configurations.map(normalizeDrawConfigurationPresentation).sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id),
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Listing Event DrawConfigurations',
      )
    }
  }

  async createDraft(
    configuration: DrawConfiguration,
  ): Promise<void> {
    try {
      const normalizedConfiguration = normalizeDrawConfigurationPresentation(configuration)
      requireValid(validateDrawConfiguration(normalizedConfiguration))

      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.prize_categories,
          this.database.draw_configurations,
        ],
        async () => {
          const parentEvent = await this.database.events.get(
            configuration.eventId,
          )
          if (parentEvent === undefined) {
            throw new RelationshipMismatchError(
              'The parent Event for the DrawConfiguration was not found.',
            )
          }

          if (parentEvent.status !== 'draft') {
            throw new ImmutableRecordError(
              'DrawConfigurations can be created only for a draft Event.',
            )
          }

          const category =
            await this.database.prize_categories.get(
              configuration.prizeCategoryId,
            )
          if (
            category === undefined ||
            category.eventId !== configuration.eventId
          ) {
            throw new RelationshipMismatchError(
              'The DrawConfiguration PrizeCategory must exist in the same Event.',
            )
          }

          await this.database.draw_configurations.add(normalizedConfiguration)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Creating the draft DrawConfiguration',
      )
    }
  }

  async updateDraft(
    configuration: DrawConfiguration,
  ): Promise<void> {
    try {
      const normalizedConfiguration = normalizeDrawConfigurationPresentation(configuration)
      requireValid(validateDrawConfiguration(normalizedConfiguration))

      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.prize_categories,
          this.database.draw_configurations,
          this.database.draw_sessions,
        ],
        async () => {
          const current =
            await this.database.draw_configurations.get(
              configuration.id,
            )
          if (current === undefined) {
            throw new RecordNotFoundError(
              'The DrawConfiguration required for a draft update was not found.',
            )
          }

          if (normalizedConfiguration.eventId !== current.eventId) {
            throw new RelationshipMismatchError(
              'A DrawConfiguration cannot be reassigned to another Event.',
            )
          }

          if (normalizedConfiguration.createdAt !== current.createdAt) {
            throw new ImmutableRecordError(
              'A DrawConfiguration creation time cannot be changed.',
            )
          }

          const parentEvent = await this.database.events.get(
            current.eventId,
          )
          if (parentEvent === undefined) {
            throw new RelationshipMismatchError(
              'The stored DrawConfiguration parent Event was not found.',
            )
          }

          if (parentEvent.status !== 'draft') {
            throw new ImmutableRecordError(
              'Only a DrawConfiguration in a draft Event can be updated.',
            )
          }

          const category =
            await this.database.prize_categories.get(
              configuration.prizeCategoryId,
            )
          if (
            category === undefined ||
            category.eventId !== current.eventId
          ) {
            throw new RelationshipMismatchError(
              'The DrawConfiguration PrizeCategory must exist in the same Event.',
            )
          }

          const startedSession =
            await this.database.draw_sessions
              .where('configurationId')
              .equals(current.id)
              .filter((session) =>
                STARTED_SESSION_STATUSES.has(session.status),
              )
              .first()
          if (startedSession !== undefined) {
            throw new ImmutableRecordError(
              'A DrawConfiguration used by a started DrawSession is immutable.',
            )
          }

          await this.database.draw_configurations.put(normalizedConfiguration)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Updating the draft DrawConfiguration',
      )
    }
  }

  async deleteUnused(id: DrawConfigurationId): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.draw_configurations,
          this.database.draw_sessions,
        ],
        async () => {
          const configuration =
            await this.database.draw_configurations.get(id)
          if (configuration === undefined) {
            throw new RecordNotFoundError(
              'The DrawConfiguration required for deletion was not found.',
            )
          }

          const parentEvent = await this.database.events.get(
            configuration.eventId,
          )
          if (parentEvent === undefined) {
            throw new RelationshipMismatchError(
              'The stored DrawConfiguration parent Event was not found.',
            )
          }

          if (parentEvent.status !== 'draft') {
            throw new ImmutableRecordError(
              'Only a DrawConfiguration in a draft Event can be deleted.',
            )
          }

          const session = await this.database.draw_sessions
            .where('configurationId')
            .equals(configuration.id)
            .first()
          if (session !== undefined) {
            throw new ImmutableRecordError(
              'A DrawConfiguration referenced by any DrawSession cannot be deleted.',
            )
          }

          await this.database.draw_configurations.delete(
            configuration.id,
          )
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Deleting the unused DrawConfiguration',
      )
    }
  }
}
