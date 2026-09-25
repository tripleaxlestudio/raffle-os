import type { DrawConfigurationId, DrawSessionId, EventId, PrizeCategoryId } from '../../domain/shared/identifiers.ts'

export type DrawCommandFailureKind =
  | 'not-found'
  | 'validation'
  | 'relationship'
  | 'integrity'
  | 'capacity'
  | 'eligibility'
  | 'candidate-pool'
  | 'selection'
  | 'persistence'

export type DrawCommandFailureCode =
  | 'event-not-found'
  | 'configuration-not-found'
  | 'category-not-found'
  | 'session-not-found'
  | 'event-not-active'
  | 'session-event-mismatch'
  | 'session-configuration-mismatch'
  | 'session-category-mismatch'
  | 'session-mode-mismatch'
  | 'session-not-ready'
  | 'session-snapshots-already-attached'
  | 'session-already-has-winners'
  | 'participants-load-failed'
  | 'invalid-clock'
  | 'invalid-audit-record'
  | 'eligibility-failed'
  | 'candidate-pool-failed'
  | 'selection-failed'
  | 'update-in-progress'
  | 'persistence-failed'

export interface DrawCommandFailure {
  readonly kind: DrawCommandFailureKind
  readonly code: DrawCommandFailureCode
  readonly message: string
  readonly eventId?: EventId
  readonly configurationId?: DrawConfigurationId
  readonly prizeCategoryId?: PrizeCategoryId
  readonly drawSessionId?: DrawSessionId
  readonly cause?: unknown
}

export function drawCommandFailure(
  kind: DrawCommandFailureKind,
  code: DrawCommandFailureCode,
  message: string,
  context: Omit<DrawCommandFailure, 'kind' | 'code' | 'message'> = {},
): DrawCommandFailure {
  return { ...context, code, kind, message }
}
