import type { CellObject, WorkBook, WorkSheet } from 'xlsx'
import type { XlsxCellDiagnostic, XlsxCellProvenance, XlsxParsedFile, XlsxParserLimits, XlsxParserOptions, XlsxParserResult, XlsxRowProvenance, XlsxWorksheetPolicy } from '../../application/participant-import/xlsx-parser.types.ts'
import { DEFAULT_XLSX_PARSER_LIMITS } from '../../application/participant-import/xlsx-parser.types.ts'

export async function parseXlsx(input: ArrayBuffer, options: XlsxParserOptions): Promise<XlsxParserResult> {
  const limits = { ...DEFAULT_XLSX_PARSER_LIMITS, ...options.limits }
  if (input.byteLength > limits.maxWorkbookBytes) return failure({ code: 'workbook-too-large', message: 'XLSX workbook exceeds the configured size limit.' })
  let xlsx: typeof import('xlsx')
  try { xlsx = await import('xlsx') } catch { return failure({ code: 'parser-module-load-failed', message: 'The XLSX parser could not be loaded.' }) }
  let workbook: WorkBook
  try {
    workbook = xlsx.read(input, { type: 'array', cellFormula: true, cellNF: true, cellText: true, cellDates: true, sheetStubs: true, bookVBA: false })
  } catch { return failure({ code: 'invalid-workbook', message: 'The selected workbook could not be read.' }) }
  if (workbook.SheetNames.length > limits.maxWorksheets) return failure({ code: 'too-many-worksheets', message: 'The workbook contains too many worksheets.' })
  const worksheets = workbook.SheetNames.map((name) => ({ name, visibility: visibilityOf(workbook, name) }))
  const policy: XlsxWorksheetPolicy = options.worksheet ?? { kind: 'first-visible' }
  const selected = policy.kind === 'named' ? worksheets.find((sheet) => sheet.name === policy.name) : worksheets.find((sheet) => sheet.visibility === 'visible')
  if (!selected) return failure({ code: policy.kind === 'named' ? 'worksheet-not-found' : 'no-visible-worksheet', message: policy.kind === 'named' ? 'The requested worksheet was not found.' : 'The workbook has no visible worksheet.' })
  if (selected.visibility !== 'visible') return failure({ code: 'hidden-worksheet-not-selectable', message: 'Hidden worksheets cannot be selected.' })
  const sheet = workbook.Sheets[selected.name]
  if (!sheet || typeof sheet !== 'object' || typeof sheet['!ref'] !== 'string') return failure({ code: 'invalid-workbook', message: 'The selected worksheet has no readable range.' })
  const range = xlsx.utils.decode_range(sheet['!ref'])
  const rowCount = range.e.r - range.s.r + 1
  const columnCount = range.e.c - range.s.c + 1
  if (rowCount > limits.maxRows) return failure({ code: 'too-many-rows', message: 'The worksheet contains too many rows.' })
  if (columnCount > limits.maxColumns) return failure({ code: 'too-many-columns', message: 'The worksheet contains too many columns.' })
  if (rowCount * columnCount > limits.maxProcessedCells) return failure({ code: 'too-many-cells', message: 'The worksheet contains too many cells to process.' })
  const headers: string[] = []
  const diagnostics: XlsxCellDiagnostic[] = []
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const provenance = inspectCell(sheet, range.s.r, column, selected.name, xlsx.utils.encode_cell({ r: range.s.r, c: column }), limits)
    if (provenance.sourceType === 'blank') headers.push('')
    else if (provenance.sourceType === 'string' && typeof sheet[xlsx.utils.encode_cell({ r: range.s.r, c: column })]?.v === 'string') headers.push(String(sheet[xlsx.utils.encode_cell({ r: range.s.r, c: column })]?.v))
    else headers.push(provenance.formattedText ?? '')
    if (isMergedContinuation(sheet, range.s.r, column)) diagnostics.push({ ...provenance, code: 'merged-cell', message: 'Merged continuation cells cannot define an unambiguous header.' })
  }
  if (headers.length === 0 || headers.every((header) => header === '')) return failure({ code: 'invalid-workbook', message: 'The selected worksheet has no header row.' })
  const rows: XlsxParsedFile['rows'][number][] = []
  const provenanceRows: XlsxRowProvenance[] = []
  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    const values: Record<string, unknown> = {}
    const cells: XlsxCellProvenance[] = []
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = xlsx.utils.encode_cell({ r: row, c: column })
      const cell = inspectCell(sheet, row, column, selected.name, address, limits)
      cells.push(cell)
      if (cell.formattedText && cell.formattedText.length > limits.maxCellTextLength) return cellFailure({ ...cell, code: 'unsupported-cell', message: 'A worksheet cell exceeds the configured text limit.' })
      const header = headers[column - range.s.c] ?? ''
      if (header !== '' && cell.sourceType === 'string') values[header] = sheet[address]?.v
      else if (header !== '' && cell.sourceType === 'number') values[header] = sheet[address]?.v
      else if (header !== '') values[header] = undefined
      if (cell.sourceType !== 'blank' && cell.sourceType !== 'string' && cell.sourceType !== 'number') diagnostics.push(toCellDiagnostic(cell))
      if (isMergedContinuation(sheet, row, column)) diagnostics.push({ ...cell, code: 'merged-cell', message: 'Merged continuation cells remain blank and cannot be mapped.' })
    }
    rows.push({ rowNumber: row + 1, values, sourceProvenance: cells.map((cell, index) => ({ sourceColumn: headers[index] ?? '', sourceColumnNumber: cell.columnNumber, sourceType: cell.sourceType, formattedText: cell.formattedText, formula: cell.formula, cachedResultPresent: cell.cachedResultPresent })) })
    provenanceRows.push({ sheetName: selected.name, rowNumber: row + 1, cells })
  }
  return { ok: true, value: { format: 'xlsx', headers, rows, provenance: provenanceRows, fileMetadata: options.fileMetadata, sheetName: selected.name, worksheets, diagnostics } }
}

function visibilityOf(workbook: WorkBook, name: string): 'visible' | 'hidden' | 'very-hidden' {
  const hidden = workbook.Workbook?.Sheets?.find((sheet) => sheet.name === name)?.Hidden ?? 0
  return hidden === 2 ? 'very-hidden' : hidden === 1 ? 'hidden' : 'visible'
}
function failure(diagnostic: { readonly code: 'workbook-too-large' | 'too-many-worksheets' | 'worksheet-not-found' | 'hidden-worksheet-not-selectable' | 'no-visible-worksheet' | 'too-many-rows' | 'too-many-columns' | 'too-many-cells' | 'invalid-workbook' | 'parser-module-load-failed'; readonly message: string }): XlsxParserResult { return { ok: false, diagnostics: [diagnostic] } }
function cellFailure(diagnostic: XlsxCellDiagnostic): XlsxParserResult { return { ok: false, diagnostics: [diagnostic] } }
function isMergedContinuation(sheet: WorkSheet, row: number, column: number): boolean { return (sheet['!merges'] ?? []).some((merge) => merge.s.r <= row && row <= merge.e.r && merge.s.c <= column && column <= merge.e.c && (merge.s.r !== row || merge.s.c !== column)) }
function inspectCell(sheet: WorkSheet, row: number, column: number, sheetName: string, address: string, limits: XlsxParserLimits): XlsxCellProvenance {
  const cell = sheet[address] as CellObject | undefined
  const base = { sheetName, rowNumber: row + 1, columnNumber: column + 1, ...(cell?.w === undefined ? {} : { formattedText: cell.w }), ...(cell?.z === undefined ? {} : { numberFormat: String(cell.z) }), ...(cell?.f === undefined ? {} : { formula: cell.f, cachedResultPresent: cell.v !== undefined }) }
  if (!cell || cell.t === 'z') return { ...base, sourceType: 'blank' }
  if (cell.w && cell.w.length > limits.maxCellTextLength) return { ...base, sourceType: 'unsupported' }
  if (cell.f !== undefined) return { ...base, sourceType: 'formula' }
  if (cell.t === 's') return { ...base, sourceType: cell.r !== undefined ? 'rich-text' : 'string' }
  if (cell.t === 'n') return { ...base, sourceType: 'number' }
  if (cell.t === 'd') return { ...base, sourceType: 'date' }
  if (cell.t === 'b') return { ...base, sourceType: 'boolean' }
  if (cell.t === 'e') return { ...base, sourceType: 'error' }
  return { ...base, sourceType: 'unsupported' }
}
function toCellDiagnostic(cell: XlsxCellProvenance): XlsxCellDiagnostic { const code = cell.sourceType === 'formula' ? 'formula-cell' : cell.sourceType === 'date' ? 'date-cell' : cell.sourceType === 'boolean' ? 'boolean-cell' : cell.sourceType === 'error' ? 'error-cell' : cell.sourceType === 'rich-text' ? 'rich-text-cell' : 'unsupported-cell'; return { ...cell, code, message: `Cell at row ${cell.rowNumber}, column ${cell.columnNumber} is not a plain text value.` } }
