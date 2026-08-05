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
} from './schema-v1.ts'

export interface PersistenceMigration {
  readonly version: number
  readonly stores: Readonly<Record<string, string | null>>
  readonly upgrade?: (
    transaction: Transaction,
  ) => PromiseLike<void> | void
}

export const CURRENT_SUPPORTED_SCHEMA_VERSION = SCHEMA_VERSION_3

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
