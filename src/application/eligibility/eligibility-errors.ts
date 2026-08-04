import type { ParticipantId, WinnerRecordId } from '../../domain/shared/identifiers.ts'

export type EligibilityFailureKind =
  | 'validation'
  | 'relationship'
  | 'integrity'

export type EligibilityFailureCode =
  | 'invalid-event'
  | 'invalid-configuration'
  | 'invalid-prize-category'
  | 'invalid-input-mode'
  | 'configuration-event-mismatch'
  | 'configuration-category-mismatch'
  | 'category-event-mismatch'
  | 'invalid-participant'
  | 'duplicate-participant'
  | 'invalid-winner-record'
  | 'duplicate-winner-record'
  | 'winner-session-mismatch'
  | 'winner-participant-mismatch'
  | 'invalid-official-session'

export interface EligibilityFailure {
  readonly kind: EligibilityFailureKind
  readonly code: EligibilityFailureCode
  readonly message: string
  readonly participantId?: ParticipantId
  readonly winnerRecordId?: WinnerRecordId
}

export function validationFailure(
  code: EligibilityFailureCode,
  message: string,
  context: Omit<EligibilityFailure, 'kind' | 'code' | 'message'> = {},
): EligibilityFailure {
  return { ...context, code, kind: 'validation', message }
}

export function relationshipFailure(
  code: EligibilityFailureCode,
  message: string,
): EligibilityFailure {
  return { code, kind: 'relationship', message }
}

export function integrityFailure(
  code: EligibilityFailureCode,
  message: string,
  context: Omit<EligibilityFailure, 'kind' | 'code' | 'message'> = {},
): EligibilityFailure {
  return { ...context, code, kind: 'integrity', message }
}
