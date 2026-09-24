import { describe, expect, it, vi } from 'vitest'
import { checkPersistenceHealth, persistenceHealthFromError, persistenceHealthFromReadiness } from './persistence-health.ts'
import { StorageQuotaError, UnsupportedSchemaVersionError } from '../errors/persistence-errors.ts'

describe('persistence health', () => {
  it('maps healthy readiness to a successful health state', () => {
    expect(persistenceHealthFromReadiness({ ok: true })).toMatchObject({ state: 'healthy', ok: true, code: 'healthy' })
  })

  it('maps schema, quota, and transaction failures to distinct states', () => {
    expect(persistenceHealthFromReadiness({ ok: false, code: 'unsupported-schema', reason: 'Missing store.' }).state).toBe('schema-incompatible')
    expect(persistenceHealthFromError(new StorageQuotaError()).state).toBe('quota-exceeded')
    expect(persistenceHealthFromReadiness({ ok: false, code: 'transaction-failed', reason: 'Rolled back.' }).state).toBe('transaction-failure')
    expect(persistenceHealthFromError(new UnsupportedSchemaVersionError()).retryable).toBe(false)
  })

  it('does not run the isolated diagnostic unless explicitly requested', async () => {
    const diagnostic = vi.fn()
    const result = await checkPersistenceHealth({ checkReadiness: async () => ({ ok: true }), runDiagnostic: diagnostic }, {})
    expect(result.ok).toBe(true)
    expect(diagnostic).not.toHaveBeenCalled()
  })

  it('blocks when the isolated diagnostic fails and reports cleanup safety', async () => {
    const result = await checkPersistenceHealth({
      checkReadiness: async () => ({ ok: true }),
      runDiagnostic: async () => ({ success: false, failedStage: 'write' as const, cleanupSucceeded: true, error: new StorageQuotaError() }),
    }, { includeDiagnostic: true })
    expect(result).toMatchObject({ ok: false, state: 'write-failure', retryable: true, code: 'storage-quota-exceeded' })
  })

  it('blocks and is not retryable when diagnostic cleanup fails', async () => {
    const result = await checkPersistenceHealth({
      checkReadiness: async () => ({ ok: true }),
      runDiagnostic: async () => ({ success: false, failedStage: 'delete-database' as const, cleanupSucceeded: false }),
    }, { includeDiagnostic: true })
    expect(result).toMatchObject({ ok: false, state: 'write-failure', retryable: false, code: 'storage-diagnostic-failed' })
  })
})
