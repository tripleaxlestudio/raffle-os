import type { Participant } from '../../domain/participants/participant.types.ts'

export type SupportedFileType = 'csv' | 'xlsx'

export interface ImportFileMetadata {
  readonly fileName: string
  readonly fileType: SupportedFileType
  readonly sizeBytes: number
  readonly lastModifiedAt?: string
  readonly sheetName?: string
}

export interface ParticipantImportSourceMetadata {
  readonly fileName: string
  readonly extension?: string
  readonly mimeType?: string
  readonly sizeBytes?: number
  readonly lastModifiedAt?: string
  readonly sheetName?: string
}

export interface RawImportRow {
  readonly rowNumber: number
  readonly values: Readonly<Record<string, unknown>>
  readonly sourceProvenance?: readonly RawImportCellProvenance[]
}

export interface RawImportCellProvenance {
  readonly sourceColumn: string
  readonly sourceColumnNumber: number
  readonly sourceType: string
  readonly formattedText?: string
  readonly formula?: string
  readonly cachedResultPresent?: boolean
}

export type ParticipantImportField =
  | 'ticketNumber'
  | 'name'
  | 'group'
  | 'notes'
  | 'isCheckedIn'

export type ImportFieldRequirement = 'required' | 'optional'

export interface ColumnMapping {
  readonly targetField: ParticipantImportField
  readonly sourceColumn: string | null
  readonly requirement: ImportFieldRequirement
}

export interface NormalizedStagingRow {
  readonly rowNumber: number
  readonly ticketNumber: string | null
  readonly name?: string
  readonly group?: string
  readonly notes?: string
  readonly isCheckedIn: boolean | null
}

export type ValidationSeverity = 'error' | 'warning'

export type ValidationIssueCode =
  | 'unsupported-file-type'
  | 'missing-ticket'
  | 'malformed-ticket'
  | 'duplicate-ticket'
  | 'malformed-field'
  | 'malformed-check-in'
  | 'formula-cell'
  | 'numeric-ticket-ambiguous'
  | 'date-cell'
  | 'boolean-cell'
  | 'error-cell'
  | 'rich-text-cell'
  | 'unsupported-cell'
  | 'merged-cell'

export interface ValidationIssue {
  readonly code: ValidationIssueCode
  readonly field?: ParticipantImportField
  readonly message: string
  readonly rowNumber: number
  readonly severity: ValidationSeverity
}

export type ValidatedParticipantDraft = Pick<
  Participant,
  'ticketNumber' | 'name' | 'group' | 'notes' | 'isCheckedIn'
>

export type ImportStrategy = 'replace' | 'merge'

export interface ImportSummary {
  readonly totalRows: number
  readonly validRows: number
  readonly invalidRows: number
  readonly emptyTicketRows: number
  readonly malformedRows: number
  readonly duplicateRows: number
  readonly issueCount: number
  readonly strategy: ImportStrategy
}

export interface ParticipantImportRowResult {
  readonly normalized: NormalizedStagingRow
  readonly issues: readonly ValidationIssue[]
  readonly participantDraft: ValidatedParticipantDraft | null
}

export interface ParticipantImportValidationResult {
  readonly rows: readonly ParticipantImportRowResult[]
  readonly summary: ImportSummary
}
