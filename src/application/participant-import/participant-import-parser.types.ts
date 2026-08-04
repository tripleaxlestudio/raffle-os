import type {
  ColumnMapping,
  ImportStrategy,
  ParticipantImportSourceMetadata,
  ParticipantImportValidationResult,
} from './participant-import-staging.types.ts'
import type { CsvParserDiagnostic, CsvParserLimits, ParsedCsvFile } from './csv-parser.types.ts'
import type { XlsxParserLimits, XlsxParsedFile, XlsxWorksheetPolicy } from './xlsx-parser.types.ts'

export type ParticipantImportParserFormat = 'csv' | 'xlsx'

export type ParticipantImportParserFailureCode =
  | 'unsupported-format'
  | 'parser-not-implemented'
  | 'csv-parse-failed'

export interface ParticipantImportParserFailure {
  readonly ok: false
  readonly code: ParticipantImportParserFailureCode
  readonly message: string
  readonly diagnostics: readonly CsvParserDiagnostic[]
  readonly format?: ParticipantImportParserFormat
}

export interface ParticipantImportParserSuccess {
  readonly ok: true
  readonly parsed: ParsedCsvFile
  readonly validation: ParticipantImportValidationResult
}

export type ParticipantImportParserResult =
  | ParticipantImportParserSuccess
  | ParticipantImportParserFailure

export interface ParticipantImportParserOptions extends Partial<CsvParserLimits> {
  readonly metadata: ParticipantImportSourceMetadata
  readonly mappings: readonly ColumnMapping[]
  readonly strategy: ImportStrategy
}

export interface ParticipantImportXlsxOptions extends Partial<XlsxParserLimits> {
  readonly metadata: ParticipantImportSourceMetadata
  readonly mappings: readonly ColumnMapping[]
  readonly strategy: ImportStrategy
  readonly worksheet?: XlsxWorksheetPolicy
}

export interface ParticipantImportXlsxSuccess {
  readonly ok: true
  readonly parsed: XlsxParsedFile
  readonly validation: ParticipantImportValidationResult
}
