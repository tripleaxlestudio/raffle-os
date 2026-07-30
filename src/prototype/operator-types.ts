export type PrototypeImportStep =
  | 'upload'
  | 'mapping'
  | 'validation'
  | 'summary'

export interface PrototypeImportFile {
  fileName: string
  fileSize: string
  fileType: 'XLSX' | 'CSV'
  sheetName: string
  totalRows: number
}

export interface PrototypeSourceColumn {
  heading: string
  samples: readonly string[]
}

export interface PrototypeColumnMapping {
  requirement: 'required' | 'optional'
  sourceColumn: string | null
  sourcePreview: readonly string[]
  targetField: string
}

export type PrototypeValidationStatus =
  | 'valid'
  | 'duplicate'
  | 'invalid'

export interface PrototypeValidationIssue {
  code:
    | 'duplicate-ticket'
    | 'empty-ticket'
    | 'malformed-email'
    | 'missing-name'
    | 'whitespace-normalized'
  message: string
  severity: 'normalization' | 'warning' | 'error'
}

export interface PrototypeParticipantRow {
  email: string
  group: string
  issues: readonly PrototypeValidationIssue[]
  participantName: string
  rowNumber: number
  status: PrototypeValidationStatus
  ticketNumber: string
}

export interface PrototypeImportSummary {
  eventTarget: string
  invalidRows: number
  mappedFields: readonly string[]
  strategy: 'replace' | 'merge'
  strategyLabel: string
  totalRows: number
  validRows: number
  duplicateRows: number
}

export interface PrototypeParticipantImportFixture {
  file: PrototypeImportFile
  mappings: readonly PrototypeColumnMapping[]
  rows: readonly PrototypeParticipantRow[]
  sourceColumns: readonly PrototypeSourceColumn[]
  summary: PrototypeImportSummary
}
