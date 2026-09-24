import type { PrizeCategoryRepository } from '../../../application/persistence/repositories/prize-category-repository.interface.ts'
import type { DrawSession } from '../../../domain/draws/draw-session.types.ts'
import type { PrizeCategory } from '../../../domain/prizes/prize.types.ts'
import { validatePrizeCategory } from '../../../domain/prizes/prize.types.ts'
import type { EventId, PrizeCategoryId } from '../../../domain/shared/identifiers.ts'
import type { DrawConfigurationId } from '../../../domain/shared/identifiers.ts'
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

async function findReadySessionForConfigurations(
  database: RaffleOSDatabase,
  configurationIds: readonly DrawConfigurationId[],
): Promise<DrawSession | undefined> {
  if (configurationIds.length === 0) return undefined
  return database.draw_sessions.where('configurationId').anyOf([...configurationIds]).filter((session) => session.status === 'ready').first()
}

export class DexiePrizeCategoryRepository
  implements PrizeCategoryRepository
{
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async findById(
    id: PrizeCategoryId,
  ): Promise<PrizeCategory | null> {
    try {
      return (await this.database.prize_categories.get(id)) ?? null
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Finding the PrizeCategory',
      )
    }
  }

  async findByEventId(eventId: EventId): Promise<PrizeCategory[]> {
    try {
      const categories = await this.database.prize_categories
        .where('eventId')
        .equals(eventId)
        .toArray()

      return categories.sort(
        (left, right) =>
          left.displayOrder - right.displayOrder ||
          left.id.localeCompare(right.id),
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Listing Event PrizeCategories',
      )
    }
  }

  async create(category: PrizeCategory): Promise<void> {
    try {
      requireValid(validatePrizeCategory(category))

      await this.database.transaction(
        'rw',
        this.database.events,
        this.database.prize_categories,
        async () => {
          const parentEvent = await this.database.events.get(
            category.eventId,
          )
          if (parentEvent === undefined) {
            throw new RelationshipMismatchError(
              'The parent Event for the PrizeCategory was not found.',
            )
          }

          if (parentEvent.status === 'archived') {
            throw new ImmutableRecordError(
              'PrizeCategories cannot be created for an archived Event.',
            )
          }

          await this.database.prize_categories.add(category)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Creating the PrizeCategory',
      )
    }
  }

  async updateDraft(category: PrizeCategory): Promise<void> {
    try {
      requireValid(validatePrizeCategory(category))

      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.prize_categories,
          this.database.draw_configurations,
          this.database.draw_sessions,
        ],
        async () => {
          const current = await this.database.prize_categories.get(
            category.id,
          )
          if (current === undefined) {
            throw new RecordNotFoundError(
              'The PrizeCategory required for a draft update was not found.',
            )
          }

          if (category.eventId !== current.eventId) {
            throw new RelationshipMismatchError(
              'A PrizeCategory cannot be reassigned to another Event.',
            )
          }

          if (category.createdAt !== current.createdAt) {
            throw new ImmutableRecordError(
              'A PrizeCategory creation time cannot be changed.',
            )
          }

          const parentEvent = await this.database.events.get(
            current.eventId,
          )
          if (parentEvent === undefined) {
            throw new RelationshipMismatchError(
              'The stored PrizeCategory parent Event was not found.',
            )
          }

          if (parentEvent.status === 'archived') {
            throw new ImmutableRecordError(
              'PrizeCategories cannot be updated for an archived Event.',
            )
          }

          const configurationIds = await this.database.draw_configurations.where('prizeCategoryId').equals(current.id).primaryKeys()
          const readySession = await findReadySessionForConfigurations(this.database, configurationIds)
          if (readySession !== undefined) {
            throw new ImmutableRecordError('A PrizeCategory used by a ready DrawSession must be updated through Draw Setup first.')
          }

          await this.database.prize_categories.put(category)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Updating the draft PrizeCategory',
      )
    }
  }

  async deleteDraft(id: PrizeCategoryId): Promise<void> {
    try {
      await this.database.transaction(
        'rw',
        [
          this.database.events,
          this.database.prize_categories,
          this.database.draw_configurations,
        ],
        async () => {
          const category =
            await this.database.prize_categories.get(id)
          if (category === undefined) {
            throw new RecordNotFoundError(
              'The PrizeCategory required for deletion was not found.',
            )
          }

          const parentEvent = await this.database.events.get(
            category.eventId,
          )
          if (parentEvent === undefined) {
            throw new RelationshipMismatchError(
              'The stored PrizeCategory parent Event was not found.',
            )
          }

          if (parentEvent.status === 'archived') {
            throw new ImmutableRecordError(
              'Only a PrizeCategory in a non-archived Event can be deleted.',
            )
          }

          const configuration =
            await this.database.draw_configurations
              .where('prizeCategoryId')
              .equals(category.id)
              .first()
          if (configuration !== undefined) {
            throw new ImmutableRecordError(
              'A referenced PrizeCategory cannot be deleted; delete its configurations first.',
            )
          }

          await this.database.prize_categories.delete(category.id)
        },
      )
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Deleting the draft PrizeCategory',
      )
    }
  }
}
