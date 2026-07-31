import type { RaffleOSDatabase } from '../db.ts'
import {
  DatabaseUnavailableError,
  PersistenceError,
  ValidationError,
} from '../errors/persistence-errors.ts'

export interface DatabaseResetConfirmation {
  readonly databaseName: string
  readonly acknowledgePermanentDataLoss: boolean
  readonly confirmationText: string
}

export interface DatabaseResetResult {
  readonly databaseName: string
  readonly status: 'deleted'
}

export interface ResetDatabaseInput {
  readonly database: RaffleOSDatabase
  readonly confirmation: DatabaseResetConfirmation
}

export function validateResetConfirmation(
  databaseName: string,
  confirmation: DatabaseResetConfirmation,
): void {
  if (confirmation.databaseName !== databaseName) {
    throw new ValidationError(
      `Database name in confirmation ("${confirmation.databaseName}") does not match target database ("${databaseName}").`,
    )
  }

  if (confirmation.acknowledgePermanentDataLoss !== true) {
    throw new ValidationError(
      'Permanent data loss acknowledgement must be explicitly set to true.',
    )
  }

  const expectedConfirmationText = `DELETE ${databaseName}`
  if (confirmation.confirmationText !== expectedConfirmationText) {
    throw new ValidationError(
      `Confirmation text must match exactly "${expectedConfirmationText}".`,
    )
  }
}

export async function resetDatabase(
  input: ResetDatabaseInput,
): Promise<DatabaseResetResult> {
  const database = input.database
  const databaseName = database.name

  // 1. Validate confirmation prior to closing or deleting
  validateResetConfirmation(databaseName, input.confirmation)

  // 2. Safely close database handle
  try {
    database.close()
  } catch {
    // Ignore close errors if handle is already closed
  }

  // 3. Delete database safely with error normalization
  try {
    await database.delete()
    return {
      databaseName,
      status: 'deleted',
    }
  } catch (error: unknown) {
    if (error instanceof PersistenceError) {
      throw error
    }
    throw new DatabaseUnavailableError(
      `Failed to delete database "${databaseName}".`,
      { cause: error },
    )
  }
}
