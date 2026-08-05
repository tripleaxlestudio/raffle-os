export type LiveStartGateErrorCode =
  | 'session-not-found'
  | 'session-not-ready'
  | 'session-already-started'
  | 'pending-confirmation-exists'
  | 'stale-configuration'
  | 'relationship-mismatch'
  | 'insufficient-capacity'
  | 'storage-unavailable'
  | 'persistence-read-failure'
  | 'persistence-write-failure'
  | 'crypto-unavailable'
  | 'eligibility-failure'
  | 'duplicate-start-attempt'
  | 'controller-invocation-pending'
  | 'practice-session-storage-unavailable'
  | 'practice-session-storage-write-failure'
  | 'official-result-persisted-response-failed'
  | 'unexpected-failure'

export type LiveStartGateRecovery = 'retryable' | 'return-to-setup' | 'resolve-existing-result' | 'completed-safely' | 'unavailable-capability'

export class LiveStartGateError extends Error {
  readonly name = 'LiveStartGateError'
  readonly code: LiveStartGateErrorCode
  readonly recovery: LiveStartGateRecovery
  readonly cause: unknown
  constructor(
    code: LiveStartGateErrorCode,
    message: string,
    recovery: LiveStartGateRecovery,
    cause?: unknown,
  ) {
    super(message)
    this.code = code
    this.recovery = recovery
    this.cause = cause
  }
}

export function toLiveStartGateError(error: unknown): LiveStartGateError {
  if (error instanceof LiveStartGateError) return error
  return new LiveStartGateError('unexpected-failure', 'The draw could not be started safely. Return to Draw Setup and verify the session.', 'retryable', error)
}
