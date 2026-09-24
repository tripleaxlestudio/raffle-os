import type { DrawSessionStatus } from '../../domain/draws/draw-session.types.ts'
import type { CommandId, DrawSessionId, WinnerRecordId } from '../../domain/shared/identifiers.ts'
import type { TicketNumber } from '../../domain/participants/participant.types.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import type { WinnerStatus } from '../../domain/winners/winner.types.ts'
import type { RedrawReason } from '../../domain/winners/redraw.types.ts'

export const LOCAL_OPERATOR = 'local-operator' as const
export type PendingDecisionActor = typeof LOCAL_OPERATOR

export type DecisionReason = RedrawReason

export interface DecisionTarget {
  readonly winnerId: WinnerRecordId
  readonly expectedStatus: WinnerStatus
}

export interface DecisionCommandBase {
  readonly commandId: CommandId
  readonly actor: PendingDecisionActor
  readonly drawSessionId: DrawSessionId
  readonly mode: AppMode
  readonly targets: readonly DecisionTarget[]
}

export interface ConfirmPendingWinnersCommand extends DecisionCommandBase {
  readonly operation: 'confirm-pending-winners'
  readonly mode: 'live'
  readonly targets: readonly (DecisionTarget & { readonly expectedStatus: 'pending' })[]
}

export interface CancelPendingWinnersCommand extends DecisionCommandBase {
  readonly operation: 'cancel-pending-winners'
  readonly mode: 'live'
  readonly reason: DecisionReason
  readonly note?: string
  readonly targets: readonly (DecisionTarget & { readonly expectedStatus: 'pending' })[]
}

export interface RedrawPendingWinnersCommand extends DecisionCommandBase {
  readonly operation: 'redraw-pending-winners'
  readonly mode: 'live'
  readonly reason: DecisionReason
  readonly note?: string
  readonly targets: readonly (DecisionTarget & { readonly expectedStatus: 'pending' })[]
}

export interface RedrawConfirmedWinnersCommand extends DecisionCommandBase {
  readonly operation: 'redraw-confirmed-winners'
  readonly mode: 'live'
  readonly reason: DecisionReason
  readonly note?: string
  readonly targets: readonly (DecisionTarget & { readonly expectedStatus: 'confirmed' })[]
}

export type PendingDecisionCommand =
  | ConfirmPendingWinnersCommand
  | CancelPendingWinnersCommand
  | RedrawPendingWinnersCommand
  | RedrawConfirmedWinnersCommand

export type PendingDecisionOperation = PendingDecisionCommand['operation']

export interface CanonicalDecisionPayload {
  readonly operation: PendingDecisionOperation
  readonly drawSessionId: DrawSessionId
  readonly targets: readonly DecisionTarget[]
  readonly reason?: DecisionReason
  readonly note?: string
}

export type PendingDecisionOutcomeStatus = 'committed' | 'failed' | 'unknown'

export interface PendingDecisionOutcome {
  readonly status: PendingDecisionOutcomeStatus
  readonly commandId: CommandId
  readonly operation: PendingDecisionOperation
  readonly drawSessionId: DrawSessionId
  readonly sessionStatus?: DrawSessionStatus
  readonly affectedWinnerIds: readonly WinnerRecordId[]
  readonly replacementWinnerIds?: readonly WinnerRecordId[]
  readonly replacementTickets?: readonly TicketNumber[]
  readonly committedAt?: IsoTimestamp
}

export interface PendingDecisionReceiptResult {
  readonly commandId: CommandId
  readonly actor: PendingDecisionActor
  readonly payload: CanonicalDecisionPayload
  readonly outcome: PendingDecisionOutcome
}
