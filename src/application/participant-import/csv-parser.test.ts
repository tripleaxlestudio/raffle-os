import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv-parser.ts'
import { DEFAULT_CSV_PARSER_LIMITS } from './csv-parser.types.ts'

const metadata = { fileName: 'participants.csv', fileType: 'csv' as const, sizeBytes: 0 }

describe('CSV parser', () => {
  it('parses headers, rows, line endings, empty cells, and trailing cells', () => {
    const result = parseCsv('Ticket,Name,Notes\r\n00042,Ayu,\r\n42,,', { fileMetadata: metadata })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.headers).toEqual(['Ticket', 'Name', 'Notes'])
      expect(result.value.rows).toEqual([
        { rowNumber: 2, values: { Ticket: '00042', Name: 'Ayu', Notes: '' } },
        { rowNumber: 3, values: { Ticket: '42', Name: '', Notes: '' } },
      ])
    }
  })

  it('removes only the file BOM from the first header', () => {
    const result = parseCsv('\ufeffTicket,Name\n00042,\ufeffAyu', { fileMetadata: metadata })
    expect(result.ok && result.value.headers[0]).toBe('Ticket')
    expect(result.ok && result.value.rows[0]?.values.Name).toBe('\ufeffAyu')
  })

  it('supports quoted commas, escaped quotes, and newlines', () => {
    const result = parseCsv('Ticket,Name,Notes\n00042,"Ayu, Jr.","said ""hello""\nsecond line"', { fileMetadata: metadata })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.rows[0]).toEqual({ rowNumber: 2, values: { Ticket: '00042', Name: 'Ayu, Jr.', Notes: 'said "hello"\nsecond line' } })
  })

  it.each([
    ['unterminated quote', 'Ticket\n"00042', 'unterminated-quote'],
    ['unexpected quote', 'Ticket\n00"042', 'unexpected-quote'],
    ['inconsistent columns', 'Ticket,Name\n00042', 'inconsistent-column-count'],
    ['duplicate headers', 'Ticket,ticket\n00042,42', 'duplicate-header'],
  ])('returns a typed diagnostic for %s', (_name, input, code) => {
    const result = parseCsv(input, { fileMetadata: metadata })
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code }] })
  })

  it('enforces row, column, cell, and input limits', () => {
    expect(parseCsv('Ticket\n1\n2', { fileMetadata: metadata, maxRows: 1 })).toMatchObject({ ok: false, diagnostics: [{ code: 'rows-limit-exceeded' }] })
    expect(parseCsv('Ticket,Name\n1,A', { fileMetadata: metadata, maxColumns: 1 })).toMatchObject({ ok: false, diagnostics: [{ code: 'columns-limit-exceeded' }] })
    expect(parseCsv('Ticket\n1234', { fileMetadata: metadata, maxCellLength: 2 })).toMatchObject({ ok: false, diagnostics: [{ code: 'cell-length-limit-exceeded' }] })
    expect(parseCsv('Ticket\n1', { fileMetadata: metadata, maxInputCharacters: 2 })).toMatchObject({ ok: false, diagnostics: [{ code: 'input-length-limit-exceeded' }] })
    expect(DEFAULT_CSV_PARSER_LIMITS.maxColumns).toBeGreaterThan(0)
  })
})
