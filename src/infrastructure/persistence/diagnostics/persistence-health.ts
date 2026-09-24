import type { PersistenceErrorCode } from '../errors/persistence-errors.ts'
import { normalizeDatabaseOpenError } from '../errors/persistence-errors.ts'
import { runStorageCapabilityDiagnostic, type StorageCapabilityResult } from './storage-diagnostics.ts'

export type PersistenceHealthState =
  | 'healthy'
  | 'unknown'
  | 'storage-unavailable'
  | 'schema-incompatible'
  | 'read-failure'
  | 'write-failure'
  | 'transaction-failure'
  | 'quota-exceeded'
  | 'checkpoint-failure'

export interface PersistenceHealth {
  readonly state: PersistenceHealthState
  readonly ok: boolean
  readonly retryable: boolean
  readonly code: string
  readonly reason: string
  readonly diagnostic?: StorageCapabilityResult
}

export type StorageReadiness =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly reason: string }

function stateForCode(code: string): PersistenceHealthState {
  switch (code as PersistenceErrorCode | string) {
    case 'unsupported-schema':
    case 'unsupported-schema-version':
    case 'schema-migration-failed':
      return 'schema-incompatible'
    case 'storage-quota-exceeded':
      return 'quota-exceeded'
    case 'transaction-failed':
      return 'transaction-failure'
    case 'checkpoint-read-failed':
    case 'checkpoint-write-failed':
    case 'checkpoint-delete-failed':
      return 'checkpoint-failure'
    case 'read-failure':
    case 'required-store-read-failed':
      return 'read-failure'
    case 'write-failure':
      return 'write-failure'
    case 'database-unavailable':
    default:
      return 'storage-unavailable'
  }
}

export function persistenceHealthFromReadiness(readiness: StorageReadiness): PersistenceHealth {
  if (readiness.ok) {
    return { state: 'healthy', ok: true, retryable: false, code: 'healthy', reason: 'Local persistence is available and readable.' }
  }
  const state = stateForCode(readiness.code)
  return {
    state,
    ok: false,
    retryable: state !== 'schema-incompatible',
    code: readiness.code,
    reason: readiness.reason,
  }
}

export function persistenceHealthFromError(error: unknown): PersistenceHealth {
  const normalized = normalizeDatabaseOpenError(error)
  const state = stateForCode(normalized.code)
  return {
    state,
    ok: false,
    retryable: state !== 'schema-incompatible',
    code: normalized.code,
    reason: normalized.message,
  }
}

export interface PersistenceHealthDependencies {
  readonly checkReadiness: () => Promise<StorageReadiness>
  readonly runDiagnostic?: () => Promise<StorageCapabilityResult>
}

/** Readiness is safe for boot and Live preflight. The optional diagnostic is isolated. */
export async function checkPersistenceHealth(
  dependencies: PersistenceHealthDependencies,
  options: { readonly includeDiagnostic?: boolean } = {},
): Promise<PersistenceHealth> {
  try {
    const readiness = persistenceHealthFromReadiness(await dependencies.checkReadiness())
    if (!readiness.ok || options.includeDiagnostic !== true) return readiness
    const diagnostic = await (dependencies.runDiagnostic ?? (() => runStorageCapabilityDiagnostic()))()
    if (diagnostic.success) return { ...readiness, diagnostic }
    return {
      state: diagnostic.failedStage === 'schema' ? 'schema-incompatible' : diagnostic.failedStage === 'read' || diagnostic.failedStage === 'verify' || diagnostic.failedStage === 'verify-delete' ? 'read-failure' : 'write-failure',
      ok: false,
      retryable: diagnostic.cleanupSucceeded,
      code: diagnostic.error?.code ?? 'storage-diagnostic-failed',
      reason: diagnostic.cleanupSucceeded ? 'Local storage capability could not be verified safely. Live draw is blocked until it can be checked again.' : 'Local storage capability check failed and its temporary database could not be cleaned up. Live draw is blocked.',
      diagnostic,
    }
  } catch (error: unknown) {
    return persistenceHealthFromError(error)
  }
}
