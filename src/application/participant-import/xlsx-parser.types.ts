import type { ImportFileMetadata, RawImportRow } from './participant-import-staging.types.ts'

export interface XlsxParserLimits {
  readonly maxWorkbookBytes: number
  readonly maxWorksheets: number
  readonly maxRows: number
  readonly maxColumns: number
  readonly maxProcessedCells: number
  readonly maxCellTextLength: number
}

export const DEFAULT_XLSX_PARSER_LIMITS: XlsxParserLimits = {
  maxWorkbookBytes: 10 * 1024 * 1024,
  maxWorksheets: 8,
  maxRows: 100_000,
  maxColumns: 100,
  maxProcessedCells: 1_000_000,
  maxCellTextLength: 10_000,
}

export type XlsxWorksheetPolicy =
  | { readonly kind: 'first-visible' }
  | { readonly kind: 'named'; readonly name: string }

export interface XlsxParserOptions {
  readonly fileMetadata: ImportFileMetadata
  readonly worksheet?: XlsxWorksheetPolicy
  readonly limits?: Partial<XlsxParserLimits>
}

export type XlsxCellSourceType =
  | 'blank' | 'string' | 'number' | 'formula' | 'date' | 'boolean'
  | 'error' | 'rich-text' | 'unsupported'

export interface XlsxCellProvenance {
  readonly sheetName: string
  readonly rowNumber: number
  readonly columnNumber: number
  readonly sourceType: XlsxCellSourceType
  readonly formattedText?: string
  readonly numberFormat?: string
  readonly formula?: string
  readonly cachedResultPresent?: boolean
}

export interface XlsxRowProvenance {
  readonly sheetName: string
  readonly rowNumber: number
  readonly cells: readonly XlsxCellProvenance[]
}

export type XlsxCellDiagnosticCode =
  | 'formula-cell' | 'error-cell' | 'numeric-ticket-ambiguous' | 'date-cell'
  | 'boolean-cell' | 'rich-text-cell' | 'unsupported-cell' | 'merged-cell'
  | 'cell-text-too-long'

export interface XlsxCellDiagnostic {
  readonly code: XlsxCellDiagnosticCode
  readonly sheetName: string
  readonly rowNumber: number
  readonly columnNumber: number
  readonly message: string
  readonly evidence?: string
}

export type XlsxWorkbookDiagnosticCode =
  | 'workbook-too-large' | 'too-many-worksheets' | 'worksheet-not-found'
  | 'hidden-worksheet-not-selectable' | 'no-visible-worksheet' | 'too-many-rows'
  | 'too-many-columns' | 'too-many-cells' | 'invalid-workbook'
  | 'parser-module-load-failed'

export interface XlsxWorkbookDiagnostic {
  readonly code: XlsxWorkbookDiagnosticCode
  readonly message: string
}

export interface XlsxParsedFile {
  readonly format: 'xlsx'
  readonly headers: readonly string[]
  readonly rows: readonly RawImportRow[]
  readonly provenance: readonly XlsxRowProvenance[]
  readonly fileMetadata: ImportFileMetadata
  readonly sheetName: string
  readonly worksheets: readonly { readonly name: string; readonly visibility: 'visible' | 'hidden' | 'very-hidden' }[]
  readonly diagnostics: readonly XlsxCellDiagnostic[]
}

export interface XlsxParserSuccess { readonly ok: true; readonly value: XlsxParsedFile }
export interface XlsxParserFailure {
  readonly ok: false
  readonly diagnostics: readonly (XlsxWorkbookDiagnostic | XlsxCellDiagnostic)[]
}
export type XlsxParserResult = XlsxParserSuccess | XlsxParserFailure
