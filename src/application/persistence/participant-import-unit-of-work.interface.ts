import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import type { EventId } from '../../domain/shared/identifiers.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'

export interface ParticipantImportTransactionInput {
  readonly eventId: EventId
  readonly strategy: 'replace' | 'merge'
  readonly participants: readonly Participant[]
  readonly auditRecord: AuditRecord
}

export interface ParticipantImportTransactionResult {
  readonly removedCount: number
  readonly unchangedCount: number
}

export interface ParticipantImportUnitOfWork {
  commitParticipantImport(
    input: ParticipantImportTransactionInput,
  ): Promise<ParticipantImportTransactionResult>
}
