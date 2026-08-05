import Dexie, {
  type DexieOptions,
  type Table,
} from 'dexie'
import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type {
  ApplicationPreference,
  ApplicationPreferenceKey,
} from '../../domain/preferences/application-preference.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type {
  AuditRecordId,
  DisplayConfigurationId,
  DrawConfigurationId,
  DrawSessionId,
  EventId,
  ParticipantId,
  PrizeCategoryId,
  RedrawRecordId,
  WinnerRecordId,
} from '../../domain/shared/identifiers.ts'
import type { RedrawRecord } from '../../domain/winners/redraw.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { PresentationCheckpointRecord } from '../../domain/workflow/presentation-checkpoint.types.ts'
import { normalizeDatabaseOpenError } from './errors/persistence-errors.ts'
import {
  CURRENT_SUPPORTED_SCHEMA_VERSION,
  registerPersistenceMigrations,
} from './schema/migrations.ts'

export const DEFAULT_DATABASE_NAME = 'RaffleOS_DB'
export const APPLICATION_SCHEMA_VERSION =
  CURRENT_SUPPORTED_SCHEMA_VERSION

export interface RaffleOSDatabaseOptions {
  readonly indexedDB?: IDBFactory
  readonly IDBKeyRange?: typeof IDBKeyRange
}

async function surfaceNativeVersionError(
  indexedDbFactory: IDBFactory,
  databaseName: string,
  supportedNativeVersion: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDbFactory.open(
      databaseName,
      supportedNativeVersion,
    )

    request.onerror = () => {
      reject(
        request.error ??
          new DOMException(
            'The database version is newer than supported.',
            'VersionError',
          ),
      )
    }
    request.onsuccess = () => {
      request.result.close()
      resolve()
    }
  })
}

export class RaffleOSDatabase extends Dexie {
  declare readonly events: Table<Event, EventId>
  declare readonly participants: Table<Participant, ParticipantId>
  declare readonly prize_categories: Table<
    PrizeCategory,
    PrizeCategoryId
  >
  declare readonly draw_configurations: Table<
    DrawConfiguration,
    DrawConfigurationId
  >
  declare readonly display_configurations: Table<
    DisplayConfiguration,
    DisplayConfigurationId
  >
  declare readonly draw_sessions: Table<DrawSession, DrawSessionId>
  declare readonly winner_records: Table<
    WinnerRecord,
    WinnerRecordId
  >
  declare readonly redraw_records: Table<
    RedrawRecord,
    RedrawRecordId
  >
  declare readonly audit_records: Table<AuditRecord, AuditRecordId>
  declare readonly preferences: Table<
    ApplicationPreference,
    ApplicationPreferenceKey
  >
  declare readonly presentation_checkpoints: Table<
    PresentationCheckpointRecord,
    DrawSessionId
  >

  readonly #indexedDbFactory: IDBFactory | undefined

  constructor(
    databaseName = DEFAULT_DATABASE_NAME,
    options: RaffleOSDatabaseOptions = {},
  ) {
    const dexieOptions: DexieOptions = {
      autoOpen: false,
    }

    if (options.IDBKeyRange !== undefined) {
      dexieOptions.IDBKeyRange = options.IDBKeyRange
    }
    if (options.indexedDB !== undefined) {
      dexieOptions.indexedDB = options.indexedDB
    }

    super(databaseName, dexieOptions)
    this.#indexedDbFactory = options.indexedDB
    registerPersistenceMigrations(this)
  }

  async openSupported(): Promise<this> {
    try {
      const indexedDbFactory =
        this.#indexedDbFactory ?? globalThis.indexedDB
      const databases = await indexedDbFactory.databases()
      const existingDatabase = databases.find(
        (database) => database.name === this.name,
      )
      const supportedNativeVersion = Math.round(this.verno * 10)

      if (
        existingDatabase?.version !== undefined &&
        existingDatabase.version > supportedNativeVersion
      ) {
        await surfaceNativeVersionError(
          indexedDbFactory,
          this.name,
          supportedNativeVersion,
        )
      }

      await super.open()
      return this
    } catch (error: unknown) {
      this.close({ disableAutoOpen: true })
      throw normalizeDatabaseOpenError(error)
    }
  }
}
