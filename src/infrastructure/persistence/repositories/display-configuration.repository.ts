import type { DisplayConfigurationRepository } from '../../../application/persistence/repositories/display-configuration-repository.interface.ts'
import {
  validateDisplayConfiguration,
  type DisplayConfiguration,
} from '../../../domain/display/display-configuration.types.ts'
import type { EventId } from '../../../domain/shared/identifiers.ts'
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

export class DexieDisplayConfigurationRepository
  implements DisplayConfigurationRepository
{
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async findByEventId(
    eventId: EventId,
  ): Promise<DisplayConfiguration | null> {
    try {
      const configuration =
        await this.database.display_configurations
          .where('eventId')
          .equals(eventId)
          .first()

      return configuration ?? null
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Finding the Event DisplayConfiguration',
      )
    }
  }

  async create(
    configuration: DisplayConfiguration,
  ): Promise<void> {
    try {
      requireValid(validateDisplayConfiguration(configuration))

      await this.database.transaction(
        'rw',
        this.database.events,
        this.database.display_configurations,
        async () => {
          const parentEvent = await this.database.events.get(
            configuration.eventId,
          )
          if (parentEvent === undefined) {
            throw new RelationshipMismatchError(
              'The parent Event for the DisplayConfiguration was not found.',
            )
          }

          await this.database.display_configurations.add(
            configuration,
          )
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Creating the DisplayConfiguration',
      )
    }
  }

  async updateForEvent(
    configuration: DisplayConfiguration,
  ): Promise<void> {
    try {
      requireValid(validateDisplayConfiguration(configuration))

      await this.database.transaction(
        'rw',
        this.database.display_configurations,
        async () => {
          const configurationById =
            await this.database.display_configurations.get(
              configuration.id,
            )
          if (
            configurationById !== undefined &&
            configurationById.eventId !== configuration.eventId
          ) {
            throw new RelationshipMismatchError(
              'A DisplayConfiguration cannot be reassigned to another Event.',
            )
          }

          const current =
            await this.database.display_configurations
              .where('eventId')
              .equals(configuration.eventId)
              .first()
          if (current === undefined) {
            throw new RecordNotFoundError(
              'The Event DisplayConfiguration required for update was not found.',
            )
          }

          if (current.id !== configuration.id) {
            throw new ImmutableRecordError(
              'A DisplayConfiguration identity cannot be replaced.',
            )
          }

          if (current.createdAt !== configuration.createdAt) {
            throw new ImmutableRecordError(
              'A DisplayConfiguration creation time cannot be changed.',
            )
          }

          await this.database.display_configurations.put(configuration)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Updating the Event DisplayConfiguration',
      )
    }
  }
}
