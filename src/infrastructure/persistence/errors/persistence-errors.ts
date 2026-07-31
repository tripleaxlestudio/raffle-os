export const PERSISTENCE_ERROR_CODES = {
  databaseUnavailable: 'database-unavailable',
  duplicateRecord: 'duplicate-record',
  immutableRecord: 'immutable-record',
  recordNotFound: 'record-not-found',
  relationshipMismatch: 'relationship-mismatch',
  schemaMigration: 'schema-migration-failed',
  storageQuota: 'storage-quota-exceeded',
  transaction: 'transaction-failed',
  unsupportedSchemaVersion: 'unsupported-schema-version',
  validation: 'validation-failed',
} as const

export type PersistenceErrorCode =
  (typeof PERSISTENCE_ERROR_CODES)[keyof typeof PERSISTENCE_ERROR_CODES]

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode

  constructor(
    code: PersistenceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.code = code
    this.name = 'PersistenceError'
  }
}

export class DatabaseUnavailableError extends PersistenceError {
  constructor(
    message = 'The local storage capability check could not open the database.',
    options?: ErrorOptions,
  ) {
    super(
      PERSISTENCE_ERROR_CODES.databaseUnavailable,
      message,
      options,
    )
    this.name = 'DatabaseUnavailableError'
  }
}

export class SchemaMigrationError extends PersistenceError {
  constructor(
    message = 'The local database schema could not be migrated.',
    options?: ErrorOptions,
  ) {
    super(
      PERSISTENCE_ERROR_CODES.schemaMigration,
      message,
      options,
    )
    this.name = 'SchemaMigrationError'
  }
}

export class UnsupportedSchemaVersionError extends PersistenceError {
  constructor(
    message = 'The local database was created by a newer unsupported application version.',
    options?: ErrorOptions,
  ) {
    super(
      PERSISTENCE_ERROR_CODES.unsupportedSchemaVersion,
      message,
      options,
    )
    this.name = 'UnsupportedSchemaVersionError'
  }
}

export class RecordNotFoundError extends PersistenceError {
  constructor(
    message = 'The requested local record was not found.',
    options?: ErrorOptions,
  ) {
    super(
      PERSISTENCE_ERROR_CODES.recordNotFound,
      message,
      options,
    )
    this.name = 'RecordNotFoundError'
  }
}

export class DuplicateRecordError extends PersistenceError {
  constructor(
    message = 'The local record conflicts with an existing unique value.',
    options?: ErrorOptions,
  ) {
    super(
      PERSISTENCE_ERROR_CODES.duplicateRecord,
      message,
      options,
    )
    this.name = 'DuplicateRecordError'
  }
}

export class RelationshipMismatchError extends PersistenceError {
  constructor(
    message = 'The local record relationships do not match.',
    options?: ErrorOptions,
  ) {
    super(
      PERSISTENCE_ERROR_CODES.relationshipMismatch,
      message,
      options,
    )
    this.name = 'RelationshipMismatchError'
  }
}

export class ValidationError extends PersistenceError {
  constructor(
    message = 'The local record failed validation.',
    options?: ErrorOptions,
  ) {
    super(PERSISTENCE_ERROR_CODES.validation, message, options)
    this.name = 'ValidationError'
  }
}

export class ImmutableRecordError extends PersistenceError {
  constructor(
    message = 'The local record is immutable.',
    options?: ErrorOptions,
  ) {
    super(
      PERSISTENCE_ERROR_CODES.immutableRecord,
      message,
      options,
    )
    this.name = 'ImmutableRecordError'
  }
}

export class StorageQuotaError extends PersistenceError {
  constructor(
    message = 'The browser storage quota prevented the local operation.',
    options?: ErrorOptions,
  ) {
    super(PERSISTENCE_ERROR_CODES.storageQuota, message, options)
    this.name = 'StorageQuotaError'
  }
}

export class TransactionError extends PersistenceError {
  constructor(
    message = 'The local database transaction failed.',
    options?: ErrorOptions,
  ) {
    super(PERSISTENCE_ERROR_CODES.transaction, message, options)
    this.name = 'TransactionError'
  }
}

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

export function isUniqueConstraintError(value: unknown): boolean {
  return errorName(value) === 'ConstraintError'
}

export function normalizeDatabaseOpenError(
  error: unknown,
): PersistenceError {
  if (error instanceof PersistenceError) {
    return error
  }

  const options: ErrorOptions = { cause: error }

  switch (errorName(error)) {
    case 'VersionError':
      return new UnsupportedSchemaVersionError(undefined, options)
    case 'SchemaError':
    case 'UpgradeError':
      return new SchemaMigrationError(undefined, options)
    case 'QuotaExceededError':
      return new StorageQuotaError(undefined, options)
    default:
      return new DatabaseUnavailableError(undefined, options)
  }
}
