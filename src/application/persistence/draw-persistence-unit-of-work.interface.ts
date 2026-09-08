import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import type { CommandId } from '../../domain/shared/identifiers.ts'
import type {
  DrawSessionStatus,
  DrawStartSnapshots,
} from '../../domain/draws/draw-session.types.ts'
import type {
  DrawSessionId,
  WinnerRecordId,
} from '../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { RedrawRecord } from '../../domain/winners/redraw.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import type { RedrawReason } from '../../domain/winners/redraw.types.ts'
import type { RedrawRequest } from '../../domain/winners/redraw-request.types.ts'
import type {
  WinnerRecord,
  WinnerStatus,
} from '../../domain/winners/winner.types.ts'

export interface DrawSessionTransitionInput {
  readonly from: DrawSessionStatus
  readonly to: DrawSessionStatus
  readonly at: IsoTimestamp
}

export interface WinnerStatusTransitionInput {
  readonly winnerId: WinnerRecordId
  readonly from: WinnerStatus
  readonly to: WinnerStatus
  readonly at: IsoTimestamp
}

export interface PersistStartedDrawInput {
  readonly drawSessionId: DrawSessionId
  readonly expectedStatus: 'ready'
  readonly snapshots: DrawStartSnapshots
  readonly winners: readonly WinnerRecord[]
  readonly auditRecord: AuditRecord
  readonly at: IsoTimestamp
}

export interface TransitionWinnersWithAuditInput {
  readonly drawSessionId: DrawSessionId
  readonly transitions: readonly WinnerStatusTransitionInput[]
  readonly auditRecords: readonly AuditRecord[]
  readonly sessionTransition?: DrawSessionTransitionInput
}

export interface RecordRedrawReplacementInput {
  readonly drawSessionId: DrawSessionId
  readonly originalWinnerId: WinnerRecordId
  readonly expectedOriginalStatus: 'pending' | 'confirmed'
  readonly replacementWinner: WinnerRecord
  readonly redrawRecord: RedrawRecord
  readonly auditRecords: readonly AuditRecord[]
  readonly at: IsoTimestamp
  readonly sessionTransition?: DrawSessionTransitionInput
}

export interface ConfirmPendingWinnersPersistenceInput {
  readonly commandId: CommandId
  readonly actor: 'local-operator'
  readonly drawSessionId: DrawSessionId
  readonly operation: 'confirm-pending-winners'
  readonly targets: readonly { readonly winnerId: WinnerRecordId; readonly expectedStatus: 'pending' }[]
  readonly canonicalPayload: unknown
}

export interface ConfirmPendingWinnersPersistenceOutcome {
  readonly status: 'committed'
  readonly commandId: CommandId
  readonly operation: 'confirm-pending-winners'
  readonly drawSessionId: DrawSessionId
  readonly affectedWinnerIds: readonly WinnerRecordId[]
  readonly sessionStatus?: DrawSessionStatus
  readonly committedAt?: IsoTimestamp
}

export interface CancelPendingWinnersPersistenceInput {
  readonly commandId: CommandId
  readonly actor: 'local-operator'
  readonly drawSessionId: DrawSessionId
  readonly operation: 'cancel-pending-winners'
  readonly reason: import('../../domain/winners/redraw.types.ts').RedrawReason
  readonly note?: string
  readonly targets: readonly { readonly winnerId: WinnerRecordId; readonly expectedStatus: 'pending' }[]
  readonly canonicalPayload: unknown
}

export interface CancelPendingWinnersPersistenceOutcome {
  readonly status: 'committed'
  readonly commandId: CommandId
  readonly operation: 'cancel-pending-winners'
  readonly drawSessionId: DrawSessionId
  readonly affectedWinnerIds: readonly WinnerRecordId[]
  readonly sessionStatus?: DrawSessionStatus
  readonly committedAt?: IsoTimestamp
}

export interface RedrawWinnersPersistenceOutcome {
  readonly status: 'committed'
  readonly commandId: CommandId
  readonly operation: 'redraw-pending-winners' | 'redraw-confirmed-winners'
  readonly drawSessionId: DrawSessionId
  readonly affectedWinnerIds: readonly WinnerRecordId[]
  readonly replacementWinnerIds: readonly WinnerRecordId[]
  readonly replacementTickets: readonly import('../../domain/participants/participant.types.ts').TicketNumber[]
  readonly sessionStatus: DrawSessionStatus
  readonly committedAt?: IsoTimestamp
}

export interface StartRedrawPersistenceInput {
  readonly requestId: CommandId
}

export interface CompleteRedrawPersistenceInput {
  readonly requestId: CommandId
}

export interface RedrawWinnersPersistenceInput {
  readonly commandId: CommandId
  readonly actor: 'local-operator'
  readonly drawSessionId: DrawSessionId
  readonly mode: AppMode
  readonly operation: 'redraw-pending-winners' | 'redraw-confirmed-winners'
  readonly reason: RedrawReason
  readonly note?: string
  readonly targets: readonly { readonly winnerId: WinnerRecordId; readonly expectedStatus: 'pending' | 'confirmed' }[]
  readonly canonicalPayload: unknown
}

export interface DrawPersistenceUnitOfWork {
  persistStartedDraw(input: PersistStartedDrawInput): Promise<void>
  transitionWinnersWithAudit(
    input: TransitionWinnersWithAuditInput,
  ): Promise<void>
  recordRedrawReplacement(
    input: RecordRedrawReplacementInput,
  ): Promise<void>
  confirmPendingWinners?(
    input: ConfirmPendingWinnersPersistenceInput,
  ): Promise<ConfirmPendingWinnersPersistenceOutcome>
  cancelPendingWinners?(
    input: CancelPendingWinnersPersistenceInput,
  ): Promise<CancelPendingWinnersPersistenceOutcome>
  redrawPendingWinners?(
    input: RedrawWinnersPersistenceInput,
  ): Promise<RedrawWinnersPersistenceOutcome>
  redrawConfirmedWinners?(
    input: RedrawWinnersPersistenceInput,
  ): Promise<RedrawWinnersPersistenceOutcome>
  startRedraw?(input: StartRedrawPersistenceInput): Promise<RedrawRequest>
  completeRedraw?(input: CompleteRedrawPersistenceInput): Promise<RedrawRequest>
}
