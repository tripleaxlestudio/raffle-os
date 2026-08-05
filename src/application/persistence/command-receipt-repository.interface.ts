import type { Transaction } from 'dexie'
import type {
  CanonicalDecisionPayload,
  PendingDecisionActor,
  PendingDecisionOperation,
  PendingDecisionOutcome,
} from '../pending-decisions/command.types.ts'
import type { CommandId, DrawSessionId, WinnerRecordId } from '../../domain/shared/identifiers.ts'
import type { DrawSessionStatus } from '../../domain/draws/draw-session.types.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'

export type CommandReceiptStatus = 'started' | 'committed' | 'failed' | 'unknown'

export interface CommandReceiptRecord {
  readonly commandId: CommandId
  readonly drawSessionId: DrawSessionId
  readonly operation: PendingDecisionOperation
  readonly actor: PendingDecisionActor
  readonly canonicalPayload: string
  readonly status: CommandReceiptStatus
  readonly outcomeStatus: PendingDecisionOutcome['status']
  readonly affectedWinnerIds: readonly WinnerRecordId[]
  readonly sessionStatus?: DrawSessionStatus
  readonly createdAt: IsoTimestamp
  readonly committedAt?: IsoTimestamp
}

export interface CommandReceiptTransaction {
  readonly transaction: Transaction
}

export type CommandReceiptReconciliation =
  | { readonly kind: 'missing'; readonly retryable: true }
  | { readonly kind: 'committed'; readonly outcome: PendingDecisionOutcome }
  | { readonly kind: 'in-progress'; readonly receipt: CommandReceiptRecord }
  | { readonly kind: 'conflict'; readonly receipt: CommandReceiptRecord }

export interface CommandReceiptRepository {
  inTransaction(transaction: Transaction): CommandReceiptTransaction
  read(commandId: CommandId, transaction?: CommandReceiptTransaction): Promise<CommandReceiptRecord | undefined>
  findBySession(drawSessionId: DrawSessionId, transaction?: CommandReceiptTransaction): Promise<readonly CommandReceiptRecord[]>
  create(commandId: CommandId, actor: PendingDecisionActor, payload: CanonicalDecisionPayload, transaction?: CommandReceiptTransaction): Promise<CommandReceiptRecord | PendingDecisionOutcome>
  finalize(commandId: CommandId, payload: CanonicalDecisionPayload, outcome: PendingDecisionOutcome, transaction?: CommandReceiptTransaction): Promise<PendingDecisionOutcome>
  reconcile(commandId: CommandId, payload: CanonicalDecisionPayload, transaction?: CommandReceiptTransaction): Promise<CommandReceiptReconciliation>
}
