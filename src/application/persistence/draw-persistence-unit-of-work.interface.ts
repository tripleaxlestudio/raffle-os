import type { AuditRecord } from '../../domain/audit/audit.types.ts'
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

export interface DrawPersistenceUnitOfWork {
  persistStartedDraw(input: PersistStartedDrawInput): Promise<void>
  transitionWinnersWithAudit(
    input: TransitionWinnersWithAuditInput,
  ): Promise<void>
  recordRedrawReplacement(
    input: RecordRedrawReplacementInput,
  ): Promise<void>
}
