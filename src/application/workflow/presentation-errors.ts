export type PresentationErrorCode =
  | 'result-projection-unavailable'
  | 'winner-relationship-invalid'
  | 'practice-projection-invalid'
  | 'checkpoint-read-failure'
  | 'checkpoint-write-failure'
  | 'checkpoint-relationship-mismatch'
  | 'unsupported-presentation-policy'
  | 'invalid-stage-transition'
  | 'duplicate-transition'
  | 'session-storage-write-failure'
  | 'timer-controller-failure'
  | 'reveal-projection-failure'
  | 'unexpected-presentation-failure'
  | 'pending-handoff-write-failure'
  | 'blackout-update-failure'
  | 'recovery-timer-failure'

export class PresentationError extends Error {
  readonly code: PresentationErrorCode
  readonly retryable: boolean
  readonly resultSafe: boolean

  constructor(code: PresentationErrorCode, message: string, retryable: boolean, resultSafe = true, cause?: unknown) {
    super(message, { cause })
    this.name = 'PresentationError'
    this.code = code
    this.retryable = retryable
    this.resultSafe = resultSafe
  }
}

export function safePresentationMessage(error: unknown): string {
  return error instanceof PresentationError ? error.message : 'Presentation was interrupted safely. The locked result was preserved.'
}
