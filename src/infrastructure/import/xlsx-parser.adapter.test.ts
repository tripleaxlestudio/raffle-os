import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { classifyStringCell, parseXlsx } from './xlsx-parser.adapter.ts'
import { validateParticipantImport } from '../../application/participant-import/participant-import-staging.ts'
import type { ColumnMapping } from '../../application/participant-import/participant-import-staging.types.ts'

const metadata = { fileName: 'participants.xlsx', fileType: 'xlsx' as const, sizeBytes: 1 }
const ticketMapping: readonly ColumnMapping[] = [{ targetField: 'ticketNumber', sourceColumn: 'Ticket Number', requirement: 'required' }]

function workbookBuffer(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name)
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
}

describe('SheetJS XLSX parser adapter', () => {
  it('classifies Excel-style plain shared strings without trusting derived rich-text fields', () => {
    const plainCell = { t: 's', v: '00077', h: '00077', r: '00077' } as const
    expect(classifyStringCell(plainCell)).toBe('string')
    expect(classifyStringCell({ t: 's', v: '00123', h: '<span>00123</span>' })).toBe('string')
    expect(classifyStringCell({ t: 's', v: '00077', r: '<r><t>000</t></r><r><t>77</t></r>' })).toBe('rich-text')
  })

  it('preserves strings, source rows, provenance, and ignores numeric cells in other columns', async () => {
    const result = await parseXlsx(workbookBuffer({ Sheet1: [['Ticket Number', 'Name', 'Ignored'], [], ['00042', 'Ada', 42], ['42', 'Bea', 7]] }), { fileMetadata: metadata })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows.map((row) => row.values['Ticket Number'])).toEqual([undefined, '00042', '42'])
    expect(result.value.rows.map((row) => row.rowNumber)).toEqual([2, 3, 4])
    expect(result.value.provenance[1]?.cells[0]?.sourceType).toBe('string')
    expect(result.value.provenance[1]?.cells[0]?.rowNumber).toBe(3)
    const validation = validateParticipantImport(result.value.rows, ticketMapping, 'replace')
    expect(validation.summary.validRows).toBe(2)
    expect(validation.rows[1]?.participantDraft?.ticketNumber).toBe('00042')
  })

  it('selects visible worksheets and rejects hidden or missing selections', async () => {
    const buffer = workbookBuffer({ Visible: [['Ticket Number'], ['00001']], Hidden: [['Ticket Number'], ['00002']] })
    const hiddenWorkbook = XLSX.read(buffer, { type: 'array' })
    hiddenWorkbook.Workbook = { Sheets: [{ name: 'Visible', Hidden: 0 }, { name: 'Hidden', Hidden: 1 }] }
    const hiddenBuffer = XLSX.write(hiddenWorkbook, { bookType: 'xlsx', type: 'array' })
    const first = await parseXlsx(hiddenBuffer, { fileMetadata: metadata })
    expect(first.ok && first.value.sheetName).toBe('Visible')
    await expect(parseXlsx(hiddenBuffer, { fileMetadata: metadata, worksheet: { kind: 'named', name: 'Hidden' } })).resolves.toMatchObject({ ok: false, diagnostics: [{ code: 'hidden-worksheet-not-selectable' }] })
    await expect(parseXlsx(hiddenBuffer, { fileMetadata: metadata, worksheet: { kind: 'named', name: 'Missing' } })).resolves.toMatchObject({ ok: false, diagnostics: [{ code: 'worksheet-not-found' }] })
  })

  it('rejects very-hidden and no-visible-sheet workbooks', async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Ticket Number'], ['1']]), 'VeryHidden')
    workbook.Workbook = { Sheets: [{ name: 'VeryHidden', Hidden: 2 }] }
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    await expect(parseXlsx(buffer, { fileMetadata: metadata })).resolves.toMatchObject({ ok: false, diagnostics: [{ code: 'no-visible-worksheet' }] })
    await expect(parseXlsx(buffer, { fileMetadata: metadata, worksheet: { kind: 'named', name: 'VeryHidden' } })).resolves.toMatchObject({ ok: false, diagnostics: [{ code: 'hidden-worksheet-not-selectable' }] })
  })

  it('rejects numeric and formula ticket cells without trusting cached results', async () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([['Ticket Number'], [null], [null]])
    sheet.A2 = { t: 'n', v: 42, z: '000000' }
    sheet.A3 = { t: 'n', v: 7, f: 'A2+1', z: '000000', w: '000007' }
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
    const result = await parseXlsx(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }), { fileMetadata: metadata })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const validation = validateParticipantImport(result.value.rows, ticketMapping, 'replace')
    expect(validation.rows[0]?.participantDraft).toBeNull()
    expect(validation.rows[0]?.issues.map((issue) => issue.code)).toContain('numeric-ticket-ambiguous')
    expect(validation.rows[1]?.participantDraft).toBeNull()
    expect(validation.rows[1]?.issues.map((issue) => issue.code)).toContain('formula-cell')
    expect(result.value.provenance[1]?.cells[0]).toMatchObject({ sourceType: 'formula', formattedText: '000007', cachedResultPresent: true })
  })

  it('checks workbook size before importing SheetJS and enforces bounds', async () => {
    await expect(parseXlsx(new ArrayBuffer(11), { fileMetadata: metadata, limits: { maxWorkbookBytes: 10 } })).resolves.toMatchObject({ ok: false, diagnostics: [{ code: 'workbook-too-large' }] })
    await expect(parseXlsx(workbookBuffer({ Sheet1: [['Ticket Number'], ['1'], ['2']] }), { fileMetadata: metadata, limits: { maxRows: 2 } })).resolves.toMatchObject({ ok: false, diagnostics: [{ code: 'too-many-rows' }] })
    await expect(parseXlsx(workbookBuffer({ Sheet1: [['A', 'B'], ['1', '2']] }), { fileMetadata: metadata, limits: { maxColumns: 1 } })).resolves.toMatchObject({ ok: false, diagnostics: [{ code: 'too-many-columns' }] })
    await expect(parseXlsx(workbookBuffer({ Sheet1: [['A', 'B'], ['1', '2']] }), { fileMetadata: metadata, limits: { maxProcessedCells: 2 } })).resolves.toMatchObject({ ok: false, diagnostics: [{ code: 'too-many-cells' }] })
    await expect(parseXlsx(workbookBuffer({ Sheet1: [['A'], ['12345']] }), { fileMetadata: metadata, limits: { maxCellTextLength: 4 } })).resolves.toMatchObject({ ok: false, diagnostics: [{ code: 'unsupported-cell' }] })
  })

  it('keeps merged continuation cells blank and reports typed cell provenance', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([['Ticket Number', 'Name'], ['00042', 'Ada']])
    sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
    const result = await parseXlsx(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }), { fileMetadata: metadata })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows[0]?.values.Name).toBe('Ada')
    expect(result.value.diagnostics.some((diagnostic) => diagnostic.code === 'merged-cell')).toBe(true)
  })
})
