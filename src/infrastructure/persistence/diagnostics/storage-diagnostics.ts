import {
  DatabaseUnavailableError,
  PersistenceError,
  ValidationError,
} from '../errors/persistence-errors.ts'

export type StorageDiagnosticStage =
  | 'open'
  | 'schema'
  | 'write'
  | 'read'
  | 'verify'
  | 'delete-record'
  | 'verify-delete'
  | 'close'
  | 'delete-database'

export interface StorageCapabilityResult {
  readonly success: boolean
  readonly failedStage?: StorageDiagnosticStage
  readonly error?: PersistenceError
  readonly cleanupSucceeded: boolean
}

export interface StorageDiagnosticOptions {
  readonly indexedDBFactory?: IDBFactory
  readonly databaseName?: string
}

let diagnosticSequence = 0

function createDiagnosticDatabaseName(): string {
  diagnosticSequence += 1
  return `RaffleOS_StorageDiag_${Date.now()}_${diagnosticSequence}`
}

function normalizeDiagnosticError(error: unknown): PersistenceError {
  if (error instanceof PersistenceError) {
    return error
  }
  return new DatabaseUnavailableError(
    'Storage capability probe encountered an error.',
    { cause: error },
  )
}

async function attemptCleanup(
  factory: IDBFactory,
  db: IDBDatabase | null,
  databaseName: string,
): Promise<boolean> {
  if (db !== null) {
    try {
      db.close()
    } catch {
      // Ignore close errors during cleanup
    }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const request = factory.deleteDatabase(databaseName)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Database deletion blocked.'))
    })
    return true
  } catch {
    return false
  }
}

export async function runStorageCapabilityDiagnostic(
  options: StorageDiagnosticOptions = {},
): Promise<StorageCapabilityResult> {
  const factory = options.indexedDBFactory ?? globalThis.indexedDB
  const tempDbName =
    options.databaseName ?? createDiagnosticDatabaseName()

  let currentStage: StorageDiagnosticStage = 'open'
  let db: IDBDatabase | null = null

  try {
    // 1. Open stage & schema stage
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(tempDbName, 1)

      request.onupgradeneeded = () => {
        try {
          currentStage = 'schema'
          const targetDb = request.result
          if (!targetDb.objectStoreNames.contains('sentinels')) {
            targetDb.createObjectStore('sentinels', { keyPath: 'id' })
          }
        } catch (error) {
          reject(error)
        }
      }

      request.onsuccess = () => {
        currentStage = 'open'
        resolve(request.result)
      }
      request.onerror = () => reject(request.error)
    })

    // 2. Write stage
    currentStage = 'write'
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(['sentinels'], 'readwrite')
      const store = transaction.objectStore('sentinels')
      const request = store.put({
        id: 'sentinel',
        value: 'raffle-os-diag-check',
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    // 3. Read stage
    currentStage = 'read'
    const sentinelRecord = await new Promise<
      { id: string; value: string } | undefined
    >((resolve, reject) => {
      const transaction = db!.transaction(['sentinels'], 'readonly')
      const store = transaction.objectStore('sentinels')
      const request = store.get('sentinel')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    // 4. Verify stage
    currentStage = 'verify'
    if (
      sentinelRecord === undefined ||
      sentinelRecord.value !== 'raffle-os-diag-check'
    ) {
      throw new ValidationError(
        'Sentinel record value verification mismatch.',
      )
    }

    // 5. Delete-record stage
    currentStage = 'delete-record'
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(['sentinels'], 'readwrite')
      const store = transaction.objectStore('sentinels')
      const request = store.delete('sentinel')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    // 6. Verify-delete stage
    currentStage = 'verify-delete'
    const deletedRecord = await new Promise<unknown>((resolve, reject) => {
      const transaction = db!.transaction(['sentinels'], 'readonly')
      const store = transaction.objectStore('sentinels')
      const request = store.get('sentinel')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    if (deletedRecord !== undefined) {
      throw new ValidationError(
        'Sentinel record delete verification failed: record still exists.',
      )
    }

    // 7. Close stage
    currentStage = 'close'
    db.close()
    db = null

    // 8. Delete-database stage
    currentStage = 'delete-database'
    await new Promise<void>((resolve, reject) => {
      const request = factory.deleteDatabase(tempDbName)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Database deletion blocked.'))
    })

    return {
      cleanupSucceeded: true,
      success: true,
    }
  } catch (rawError: unknown) {
    const error = normalizeDiagnosticError(rawError)
    const cleanupSucceeded = await attemptCleanup(factory, db, tempDbName)

    return {
      cleanupSucceeded,
      error,
      failedStage: currentStage,
      success: false,
    }
  }
}
