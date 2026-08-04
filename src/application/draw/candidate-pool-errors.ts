import type {
  EligibilityFailure,
  EligibilityFailureCode,
} from '../eligibility/eligibility-errors.ts'
import type { ParticipantId } from '../../domain/shared/identifiers.ts'
import type { TicketNumber } from '../../domain/participants/participant.types.ts'

export type CandidatePoolFailureKind =
  | 'validation'
  | 'relationship'
  | 'integrity'
  | 'capacity'

export type CandidatePoolFailureCode =
  | 'invalid-capture-time'
  | 'invalid-eligibility-result'
  | 'eligibility-failure'
  | 'candidate-source-mismatch'
  | 'candidate-event-mismatch'
  | 'candidate-configuration-mismatch'
  | 'candidate-category-mismatch'
  | 'candidate-mode-mismatch'
  | 'candidate-count-mismatch'
  | 'duplicate-candidate-participant'
  | 'duplicate-candidate-ticket'
  | 'zero-eligible-candidates'
  | 'insufficient-candidates'

export interface CandidatePoolFailure {
  readonly kind: CandidatePoolFailureKind
  readonly code: CandidatePoolFailureCode | EligibilityFailureCode
  readonly message: string
  readonly participantId?: ParticipantId
  readonly ticketNumber?: TicketNumber
  readonly requested?: number
  readonly available?: number
  readonly eligibilityFailure?: EligibilityFailure
}

export function candidatePoolFailure(
  kind: CandidatePoolFailureKind,
  code: CandidatePoolFailureCode | EligibilityFailureCode,
  message: string,
  context: Omit<CandidatePoolFailure, 'kind' | 'code' | 'message'> = {},
): CandidatePoolFailure {
  return { ...context, code, kind, message }
}
