import type { ParticipantId } from '../../domain/shared/identifiers.ts'
import type { TicketNumber } from '../../domain/participants/participant.types.ts'

export type WinnerSelectionFailureKind =
  | 'validation'
  | 'relationship'
  | 'integrity'
  | 'uniqueness'
  | 'capacity'
  | 'random'

export type WinnerSelectionFailureCode =
  | 'unsupported-snapshot-version'
  | 'snapshot-not-frozen'
  | 'candidate-array-not-frozen'
  | 'candidate-entry-not-frozen'
  | 'invalid-snapshot'
  | 'invalid-candidate-identity'
  | 'invalid-event-identity'
  | 'event-mismatch'
  | 'configuration-mismatch'
  | 'category-mismatch'
  | 'mode-mismatch'
  | 'winning-rule-mismatch'
  | 'candidate-count-mismatch'
  | 'empty-candidate-snapshot'
  | 'duplicate-participant'
  | 'duplicate-ticket'
  | 'invalid-requested-count'
  | 'insufficient-capacity'
  | 'random-failure'
  | 'invalid-winner-record'
  | 'duplicate-winner-record-id'

export interface WinnerSelectionFailure {
  readonly kind: WinnerSelectionFailureKind
  readonly code: WinnerSelectionFailureCode
  readonly message: string
  readonly requested?: number
  readonly available?: number
  readonly participantId?: ParticipantId
  readonly ticketNumber?: TicketNumber
  readonly cause?: unknown
}

export function winnerSelectionFailure(
  kind: WinnerSelectionFailureKind,
  code: WinnerSelectionFailureCode,
  message: string,
  context: Omit<WinnerSelectionFailure, 'kind' | 'code' | 'message'> = {},
): WinnerSelectionFailure {
  return { ...context, code, kind, message }
}
