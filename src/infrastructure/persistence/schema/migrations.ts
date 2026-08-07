import type {
  Dexie,
  Transaction,
} from 'dexie'
import { SchemaMigrationError } from '../errors/persistence-errors.ts'
import {
  SCHEMA_V1,
  SCHEMA_VERSION_1,
  SCHEMA_V2,
  SCHEMA_VERSION_2,
  SCHEMA_V3,
  SCHEMA_VERSION_3,
  SCHEMA_V4,
  SCHEMA_VERSION_4,
  SCHEMA_V5,
  SCHEMA_VERSION_5,
} from './schema-v1.ts'
import { normalizeDrawPresentationConfiguration } from '../../../domain/draws/draw-presentation.types.ts'
import type { DrawConfiguration } from '../../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../../domain/draws/draw-session.types.ts'

type MutableDrawConfiguration = {
  -readonly [Key in keyof DrawConfiguration]: DrawConfiguration[Key]
}
type MutableDrawSession = {
  -readonly [Key in keyof DrawSession]: DrawSession[Key]
}

export interface PersistenceMigration {
  readonly version: number
  readonly stores: Readonly<Record<string, string | null>>
  readonly upgrade?: (
    transaction: Transaction,
  ) => PromiseLike<void> | void
}

export const CURRENT_SUPPORTED_SCHEMA_VERSION = SCHEMA_VERSION_5

export const PERSISTENCE_MIGRATIONS:
  readonly PersistenceMigration[] = [
    {
      stores: SCHEMA_V1,
      version: SCHEMA_VERSION_1,
    },
    {
      stores: SCHEMA_V2,
      version: SCHEMA_VERSION_2,
    },
    {
      stores: SCHEMA_V3,
      version: SCHEMA_VERSION_3,
    },
    { stores: SCHEMA_V4, version: SCHEMA_VERSION_4 },
    {
      stores: SCHEMA_V5,
      version: SCHEMA_VERSION_5,
      upgrade: async (transaction) => {
        const configurations = await transaction.table('draw_configurations').toArray() as DrawConfiguration[]
        const presentationByConfigurationId = new Map(
          configurations.map((configuration) => [
            configuration.id,
            normalizeDrawPresentationConfiguration(configuration.presentation),
          ]),
        )

        await transaction.table('draw_configurations').toCollection().modify((configuration: DrawConfiguration) => {
          const mutableConfiguration = configuration as MutableDrawConfiguration
          mutableConfiguration.presentation = presentationByConfigurationId.get(configuration.id) ?? normalizeDrawPresentationConfiguration(undefined)
        })

        await transaction.table('draw_sessions').toCollection().modify((session: DrawSession) => {
          const snapshot = session.configurationSnapshot
          if (snapshot === undefined || snapshot === null || snapshot.presentation !== undefined) return
          const presentation = presentationByConfigurationId.get(session.configurationId)
          if (presentation !== undefined) {
            const mutableSession = session as MutableDrawSession
            mutableSession.configurationSnapshot = { ...snapshot, presentation }
          }
        })
      },
    },
  ]

/*
 * Migrations are forward-only. Every future version requires an explicit
 * schema declaration, upgrade handler when data transformation is needed, and
 * focused upgrade tests. Official records may never be silently dropped.
 * Once deployed, an IndexedDB upgrade cannot be treated as automatically
 * reversible.
 */
export function registerPersistenceMigrations(
  database: Dexie,
  migrations: readonly PersistenceMigration[] =
    PERSISTENCE_MIGRATIONS,
): void {
  let previousVersion = 0

  for (const migration of migrations) {
    if (
      !Number.isInteger(migration.version) ||
      migration.version <= previousVersion
    ) {
      throw new SchemaMigrationError(
        'Persistence migrations must use strictly increasing positive integer versions.',
      )
    }

    try {
      const version = database
        .version(migration.version)
        .stores({ ...migration.stores })

      if (migration.upgrade !== undefined) {
        version.upgrade(migration.upgrade)
      }
    } catch (error: unknown) {
      throw new SchemaMigrationError(
        `Persistence schema version ${migration.version} could not be registered.`,
        { cause: error },
      )
    }

    previousVersion = migration.version
  }
}
