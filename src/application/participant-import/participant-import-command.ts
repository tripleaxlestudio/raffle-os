import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import type { AuditRecordId, EventId, ParticipantId } from '../../domain/shared/identifiers.ts'
import { parseEventId } from '../../domain/shared/identifiers.ts'
import { isIsoTimestamp, type IsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { ParticipantImportUnitOfWork } from '../persistence/participant-import-unit-of-work.interface.ts'
import type {
  ColumnMapping,
  ImportStrategy,
  ImportSummary,
  ParticipantImportSourceMetadata,
  ValidatedParticipantDraft,
} from './participant-import-staging.types.ts'

export interface CommitParticipantImportCommand {
  readonly eventId: string
  readonly strategy: ImportStrategy
  readonly source: ParticipantImportSourceMetadata
  readonly mapping: readonly ColumnMapping[]
  readonly drafts: readonly ValidatedParticipantDraft[]
  readonly summary: ImportSummary
  readonly requestedAt?: string
}

export interface CommitParticipantImportDependencies {
  readonly unitOfWork: ParticipantImportUnitOfWork
  readonly createParticipantId: () => ParticipantId
  readonly createAuditRecordId: () => AuditRecordId
  readonly createOperationId: () => string
  readonly now: () => string
}

export type ParticipantImportFailureCode =
  | 'invalid-command'
  | 'event-not-found'
  | 'event-not-mutable'
  | 'empty-import'
  | 'duplicate-ticket-in-batch'
  | 'existing-ticket-conflict'
  | 'summary-mismatch'
  | 'persistence-unavailable'
  | 'transaction-failed'
  | 'quota-storage-failure'
  | 'relationship-violation'
  | 'uniqueness-violation'

export interface ParticipantImportFailure {
  readonly ok: false
  readonly code: ParticipantImportFailureCode
  readonly message: string
}

export interface ParticipantImportSuccess {
  readonly ok: true
  readonly eventId: EventId
  readonly strategy: ImportStrategy
  readonly operationId: string
  readonly insertedCount: number
  readonly removedCount: number
  readonly unchangedCount: number
  readonly auditRecordId: AuditRecordId
  readonly completedAt: IsoTimestamp
}

export type CommitParticipantImportResult =
  | ParticipantImportSuccess
  | ParticipantImportFailure

const IMPORT_ACTION = 'participant-import-committed' as const

function sourceIsSupported(source: ParticipantImportSourceMetadata): boolean {
  if (source.fileName.trim().length === 0) return false
  const extension = source.extension?.trim().toLocaleLowerCase().replace(/^\./, '')
  const mime = source.mimeType?.trim().toLocaleLowerCase()
  const supportedExtension = extension === 'csv' || extension === 'xlsx'
  const supportedMime = mime === undefined || mime === '' || mime === 'text/csv' || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return supportedExtension && supportedMime && (source.sizeBytes === undefined || (Number.isInteger(source.sizeBytes) && source.sizeBytes >= 0))
}

function mappingsAreValid(mapping: readonly ColumnMapping[]): boolean {
  const ticket = mapping.filter((item) => item.targetField === 'ticketNumber')
  if (ticket.length !== 1 || ticket[0]?.sourceColumn === null || ticket[0]?.sourceColumn === undefined) return false
  const targets = new Set<string>()
  for (const item of mapping) {
    if (item.sourceColumn === null) continue
    if (targets.has(item.sourceColumn)) return false
    targets.add(item.sourceColumn)
  }
  return true
}

function invalid(message: string): ParticipantImportFailure {
  return { ok: false, code: 'invalid-command', message }
}

function validateSummary(command: CommitParticipantImportCommand): ParticipantImportFailure | null {
  const { summary, drafts } = command
  if (summary.strategy !== command.strategy || summary.validRows !== drafts.length || summary.totalRows !== summary.validRows + summary.invalidRows || summary.issueCount < summary.invalidRows || summary.emptyTicketRows > summary.invalidRows || summary.malformedRows > summary.invalidRows || summary.duplicateRows > summary.invalidRows) {
    return { ok: false, code: 'summary-mismatch', message: 'Import summary does not reconcile with the validated draft batch.' }
  }
  return null
}

function mapPersistenceFailure(error: unknown): ParticipantImportFailure {
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined
  if (code === 'record-not-found') return { ok: false, code: 'event-not-found', message: 'The selected Event was not found.' }
  if (code === 'immutable-record') return { ok: false, code: 'event-not-mutable', message: 'The selected Event does not permit participant import.' }
  if (code === 'duplicate-record') {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('already exists in this Event')) return { ok: false, code: 'existing-ticket-conflict', message: 'An imported Ticket Number already exists in this Event.' }
    return { ok: false, code: 'uniqueness-violation', message: 'The import conflicts with an existing unique record.' }
  }
  if (code === 'relationship-mismatch') return { ok: false, code: 'relationship-violation', message: 'The import contains an invalid record relationship.' }
  if (code === 'storage-quota-exceeded') return { ok: false, code: 'quota-storage-failure', message: 'Local storage could not complete the import.' }
  if (code === 'database-unavailable') return { ok: false, code: 'persistence-unavailable', message: 'Local persistence is unavailable.' }
  return { ok: false, code: 'transaction-failed', message: 'The participant import transaction was rolled back.' }
}

export async function commitParticipantImport(command: CommitParticipantImportCommand, dependencies: CommitParticipantImportDependencies): Promise<CommitParticipantImportResult> {
  const eventIdResult = parseEventId(command.eventId)
  if (!eventIdResult.ok) return invalid('Event ID must be a valid UUID string.')
  if (command.strategy !== 'replace' && command.strategy !== 'merge') return invalid('Import strategy is unsupported.')
  if (command.drafts.length === 0) return { ok: false, code: 'empty-import', message: 'An import must contain at least one valid Participant draft.' }
  if (!sourceIsSupported(command.source)) return invalid('Import source metadata is incomplete or unsupported.')
  if (!mappingsAreValid(command.mapping)) return invalid('Column mapping must include one unique Ticket Number source column.')
  const summaryFailure = validateSummary(command)
  if (summaryFailure !== null) return summaryFailure
  const seen = new Set<string>()
  for (const draft of command.drafts) {
    if (typeof draft.ticketNumber !== 'string' || draft.ticketNumber.length === 0) return invalid('Every Participant draft must contain a non-empty string Ticket Number.')
    if (seen.has(draft.ticketNumber)) return { ok: false, code: 'duplicate-ticket-in-batch', message: 'The import contains duplicate Ticket Numbers.' }
    seen.add(draft.ticketNumber)
    if (typeof draft.isCheckedIn !== 'boolean' || (draft.name !== undefined && typeof draft.name !== 'string') || (draft.group !== undefined && typeof draft.group !== 'string') || (draft.notes !== undefined && typeof draft.notes !== 'string')) return invalid('A Participant draft contains an invalid field value.')
  }
  const completedAtValue = command.requestedAt ?? dependencies.now()
  if (!isIsoTimestamp(completedAtValue)) return invalid('The import timestamp must be a valid ISO UTC value.')
  const eventId = eventIdResult.value
  const participants = command.drafts.map((draft) => ({ ...draft, eventId, id: dependencies.createParticipantId(), createdAt: completedAtValue, updatedAt: completedAtValue }))
  const operationId = dependencies.createOperationId()
  if (operationId.trim().length === 0) return invalid('The import operation ID must not be empty.')
  const auditRecord: AuditRecord = {
    id: dependencies.createAuditRecordId(), eventId, action: IMPORT_ACTION, actor: { type: 'system' }, timestamp: completedAtValue,
    detail: {
      operationId, strategy: command.strategy,
      source: { fileName: command.source.fileName, fileType: command.source.extension?.replace(/^\./, '').toLocaleLowerCase() ?? 'unknown', sizeBytes: command.source.sizeBytes ?? null, sheetName: command.source.sheetName ?? null },
      mapping: Object.fromEntries(command.mapping.map((item) => [item.targetField, item.sourceColumn])), summary: {
        totalRows: command.summary.totalRows, validRows: command.summary.validRows, invalidRows: command.summary.invalidRows,
        emptyTicketRows: command.summary.emptyTicketRows, malformedRows: command.summary.malformedRows,
        duplicateRows: command.summary.duplicateRows, issueCount: command.summary.issueCount, strategy: command.summary.strategy,
      },
      insertedParticipantCount: participants.length, replacedParticipantCount: command.strategy === 'replace' ? null : 0, conflictCount: 0,
    },
  }
  try {
    const transactionResult = await dependencies.unitOfWork.commitParticipantImport({ eventId, strategy: command.strategy, participants, auditRecord })
    return { ok: true, eventId, strategy: command.strategy, operationId, insertedCount: participants.length, removedCount: transactionResult.removedCount, unchangedCount: transactionResult.unchangedCount, auditRecordId: auditRecord.id, completedAt: completedAtValue }
  } catch (error: unknown) {
    return mapPersistenceFailure(error)
  }
}
