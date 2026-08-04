import type { ImportFileMetadata, RawImportRow } from './participant-import-staging.types.ts'
import {
  DEFAULT_CSV_PARSER_LIMITS,
  type CsvParserDiagnosticCode,
  type CsvParseResult,
  type CsvParserLimits,
} from './csv-parser.types.ts'

export interface CsvParserOptions extends Partial<CsvParserLimits> {
  readonly fileMetadata: ImportFileMetadata
}

export function parseCsv(
  input: string,
  options: CsvParserOptions,
): CsvParseResult {
  const limits = { ...DEFAULT_CSV_PARSER_LIMITS, ...options }
  if (input.length > limits.maxInputCharacters) {
    return failure('input-length-limit-exceeded', 'CSV input exceeds the configured character limit.', 0)
  }
  if (input.length === 0) {
    return failure('empty-file', 'CSV input is empty.', 0)
  }

  const rows: Array<{ rowNumber: number; values: string[] }> = []
  let fields: string[] = []
  let field = ''
  let inQuotes = false
  let afterQuote = false
  let sourceRow = 1
  let fieldColumn = 1
  const firstCharacterIsBom = input.charCodeAt(0) === 0xfeff
  const start = firstCharacterIsBom ? 1 : 0
  if (start === input.length) {
    return failure('empty-file', 'CSV input is empty.', 0)
  }

  const pushField = (): CsvParseResult | null => {
    if (field.length > limits.maxCellLength) {
      return failure('cell-length-limit-exceeded', 'CSV cell exceeds the configured character limit.', sourceRow, fieldColumn)
    }
    fields.push(field)
    field = ''
    fieldColumn += 1
    return null
  }
  const pushRow = (): CsvParseResult | null => {
    const cellFailure = pushField()
    if (cellFailure) return cellFailure
    if (fields.length > limits.maxColumns) {
      return failure('columns-limit-exceeded', 'CSV row exceeds the configured column limit.', sourceRow)
    }
    if (rows.length > 0 && fields.length !== rows[0].values.length) {
      return failure('inconsistent-column-count', 'CSV rows must contain the same number of columns as the header.', sourceRow)
    }
    rows.push({ rowNumber: sourceRow, values: fields })
    if (rows.length > limits.maxRows + 1) {
      return failure('rows-limit-exceeded', 'CSV input exceeds the configured row limit.', sourceRow)
    }
    fields = []
    fieldColumn = 1
    return null
  }

  for (let index = start; index < input.length; index += 1) {
    const character = input[index]
    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
          afterQuote = true
        }
      } else {
        if (character === '\r' && input[index + 1] === '\n') index += 1
        field += character === '\r' ? '\n' : character
      }
      continue
    }
    if (afterQuote) {
      if (character === ',') {
        const result = pushField()
        if (result) return result
        afterQuote = false
        continue
      }
      if (character === '\r' || character === '\n') {
        const result = pushRow()
        if (result) return result
        afterQuote = false
        if (character === '\r' && input[index + 1] === '\n') index += 1
        sourceRow += 1
        continue
      }
      return failure('unexpected-quote', 'Quoted fields must be followed by a comma or line ending.', sourceRow, fieldColumn)
    }
    if (character === '"') {
      if (field.length !== 0) return failure('unexpected-quote', 'A quote is only allowed at the beginning of a field.', sourceRow, fieldColumn)
      inQuotes = true
    } else if (character === ',') {
      const result = pushField()
      if (result) return result
    } else if (character === '\r' || character === '\n') {
      const result = pushRow()
      if (result) return result
      if (character === '\r' && input[index + 1] === '\n') index += 1
      sourceRow += 1
    } else {
      field += character
    }
  }
  if (inQuotes) return failure('unterminated-quote', 'CSV contains an unterminated quoted field.', sourceRow, fieldColumn)
  if (afterQuote || field.length > 0 || fields.length > 0) {
    const result = pushRow()
    if (result) return result
  }
  if (rows.length === 0) return failure('missing-header-row', 'CSV does not contain a header row.', 1)

  const headers = rows[0].values
  if (headers.length === 0 || headers.every((header) => header === '')) {
    return failure('missing-header-row', 'CSV header row is empty.', rows[0].rowNumber)
  }
  const seen = new Set<string>()
  for (let index = 0; index < headers.length; index += 1) {
    const key = headers[index].trim().toLocaleLowerCase()
    if (seen.has(key)) return failure('duplicate-header', 'CSV header names must be unique.', rows[0].rowNumber, index + 1)
    seen.add(key)
  }
  const rawRows: RawImportRow[] = rows.slice(1).map((row) => ({
    rowNumber: row.rowNumber,
    values: Object.fromEntries(headers.map((header, index) => [header, row.values[index] ?? ''])),
  }))
  return {
    ok: true,
    value: {
      fileMetadata: { ...options.fileMetadata },
      format: 'csv',
      headers: [...headers],
      rows: rawRows,
      warnings: [],
    },
  }
}

function failure(
  code: CsvParserDiagnosticCode,
  message: string,
  rowNumber: number,
  columnIndex?: number,
): CsvParseResult {
  return { ok: false, diagnostics: [makeDiagnostic(code, message, rowNumber, columnIndex)] }
}

function makeDiagnostic(
  code: CsvParserDiagnosticCode,
  message: string,
  rowNumber: number,
  columnIndex?: number,
) {
  return { code, message, rowNumber, ...(columnIndex === undefined ? {} : { columnIndex }) }
}
