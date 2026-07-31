import type { Result } from '../../../domain/shared/result.ts'
import {
  DuplicateRecordError,
  isUniqueConstraintError,
  PersistenceError,
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

function hasNamedError(
  value: unknown,
  name: string,
  seen: Set<object> = new Set<object>(),
): boolean {
  if (
    (name === 'ConstraintError' && isUniqueConstraintError(value)) ||
    errorName(value) === name
  ) {
    return true
  }

  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return false
  }

  seen.add(value)

  if ('cause' in value && hasNamedError(value.cause, name, seen)) {
    return true
  }

  if ('inner' in value && hasNamedError(value.inner, name, seen)) {
    return true
  }

  if ('failures' in value && Array.isArray(value.failures)) {
    return value.failures.some((failure) =>
      hasNamedError(failure, name, seen),
    )
  }

  return false
}

export function normalizeRepositoryError(
  error: unknown,
  operation: string,
): PersistenceError {
  if (error instanceof PersistenceError) {
    return error
  }

  const options: ErrorOptions = { cause: error }

  if (hasNamedError(error, 'ConstraintError')) {
    return new DuplicateRecordError(
      `${operation} conflicts with an existing unique record.`,
      options,
    )
  }

  if (hasNamedError(error, 'QuotaExceededError')) {
    return new StorageQuotaError(undefined, options)
  }

  return new TransactionError(`${operation} failed.`, options)
}

export function requireValid<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new ValidationError(result.error.message, {
      cause: result.error,
    })
  }

  return result.value
}
