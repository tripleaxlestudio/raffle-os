import type { ImportFileMetadata, RawImportRow } from './participant-import-staging.types.ts'

export interface CsvParserLimits {
  readonly maxInputCharacters: number
  readonly maxRows: number
  readonly maxColumns: number
  readonly maxCellLength: number
}

export const DEFAULT_CSV_PARSER_LIMITS: CsvParserLimits = {
  maxInputCharacters: 1_000_000,
  maxRows: 100_000,
  maxColumns: 100,
  maxCellLength: 10_000,
}

export type CsvParserDiagnosticCode =
  | 'empty-file'
  | 'missing-header-row'
  | 'duplicate-header'
  | 'unterminated-quote'
  | 'unexpected-quote'
  | 'inconsistent-column-count'
  | 'rows-limit-exceeded'
  | 'columns-limit-exceeded'
  | 'cell-length-limit-exceeded'
  | 'input-length-limit-exceeded'

export interface CsvParserDiagnostic {
  readonly code: CsvParserDiagnosticCode
  readonly message: string
  readonly rowNumber: number
  readonly columnIndex?: number
}

export interface ParsedCsvFile {
  readonly format: 'csv'
  readonly headers: readonly string[]
  readonly rows: readonly RawImportRow[]
  readonly fileMetadata: ImportFileMetadata
  readonly warnings: readonly string[]
}

export type CsvParseResult =
  | { readonly ok: true; readonly value: ParsedCsvFile }
  | { readonly ok: false; readonly diagnostics: readonly CsvParserDiagnostic[] }
