import type { PreferenceRepository } from '../../../application/persistence/repositories/preference-repository.interface.ts'
import {
  isApplicationPreferenceKey,
  validateApplicationPreferenceValue,
  type ApplicationPreference,
  type ApplicationPreferenceKey,
  type ApplicationPreferenceRegistry,
} from '../../../domain/preferences/application-preference.types.ts'
import {
  isIsoTimestamp,
  type IsoTimestamp,
} from '../../../domain/shared/timestamps.ts'
import type { RaffleOSDatabase } from '../db.ts'
import {
  RelationshipMismatchError,
  ValidationError,
} from '../errors/persistence-errors.ts'
import {
  normalizeRepositoryError,
  requireValid,
} from './repository-helpers.ts'

function validatePreferenceKey(
  key: unknown,
): asserts key is ApplicationPreferenceKey {
  if (!isApplicationPreferenceKey(key)) {
    throw new ValidationError(
      'Application preference key is not supported.',
    )
  }
}

function validatePreferenceTimestamp(
  value: unknown,
): asserts value is IsoTimestamp {
  if (!isIsoTimestamp(value)) {
    throw new ValidationError(
      'Application preference timestamp must be a valid ISO UTC value.',
    )
  }
}

function validateStoredPreference(
  expectedKey: ApplicationPreferenceKey,
  value: unknown,
): ApplicationPreference {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('key' in value) ||
    !('value' in value) ||
    !('updatedAt' in value) ||
    value.key !== expectedKey
  ) {
    throw new ValidationError(
      'Stored application preference is malformed.',
    )
  }

  validatePreferenceKey(value.key)
  validatePreferenceTimestamp(value.updatedAt)

  if (value.key === 'activeEventId') {
    return {
      key: value.key,
      updatedAt: value.updatedAt,
      value: requireValid(
        validateApplicationPreferenceValue(
          value.key,
          value.value,
        ),
      ),
    }
  }

  if (value.key === 'setupJourneyReachedStepByEvent') {
    return {
      key: value.key,
      updatedAt: value.updatedAt,
      value: requireValid(validateApplicationPreferenceValue(value.key, value.value)),
    }
  }

  return {
    key: value.key,
    updatedAt: value.updatedAt,
    value: requireValid(
      validateApplicationPreferenceValue(value.key, value.value),
    ),
  }
}

export class DexiePreferenceRepository
  implements PreferenceRepository
{
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async get<K extends ApplicationPreferenceKey>(
    key: K,
  ): Promise<ApplicationPreferenceRegistry[K] | null> {
    try {
      validatePreferenceKey(key)
      const stored = await this.database.preferences.get(key)
      if (stored === undefined) {
        return null
      }

      const validated = validateStoredPreference(key, stored)
      /*
       * The closed key registry and key-specific runtime validation above
       * establish the correlation that TypeScript cannot retain when reading
       * a discriminated union through Dexie's generic Table.get API.
       */
      return validated.value as ApplicationPreferenceRegistry[K]
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Reading the application preference',
      )
    }
  }

  async set<K extends ApplicationPreferenceKey>(
    key: K,
    value: ApplicationPreferenceRegistry[K],
    at: IsoTimestamp,
  ): Promise<void> {
    try {
      validatePreferenceKey(key)
      validatePreferenceTimestamp(at)

      if (key === 'activeEventId') {
        const activeEventId = requireValid(
          validateApplicationPreferenceValue(
            'activeEventId',
            value,
          ),
        )
        const preference: ApplicationPreference<'activeEventId'> = {
          key: 'activeEventId',
          updatedAt: at,
          value: activeEventId,
        }

        if (activeEventId === null) {
          await this.database.preferences.put(preference)
          return
        }

        await this.database.transaction(
          'rw',
          this.database.events,
          this.database.preferences,
          async () => {
            const event =
              await this.database.events.get(activeEventId)
            if (event === undefined) {
              throw new RelationshipMismatchError(
                'The active Event preference must reference an existing Event.',
              )
            }

            await this.database.preferences.put(preference)
          },
        )
        return
      }

      if (key === 'lastOperatorMode') {
        const preference: ApplicationPreference<'lastOperatorMode'> = { key, updatedAt: at, value: requireValid(validateApplicationPreferenceValue(key, value)) }
        await this.database.preferences.put(preference)
        return
      }
      const preference: ApplicationPreference<'setupJourneyReachedStepByEvent'> = { key, updatedAt: at, value: requireValid(validateApplicationPreferenceValue(key, value)) }
      await this.database.preferences.put(preference)
    } catch (error: unknown) {
      throw normalizeRepositoryError(
        error,
        'Setting the application preference',
      )
    }
  }
}
