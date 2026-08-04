import { describe, expect, it } from 'vitest'
import { parseParticipantImport } from './participant-import-parser.ts'
import type { ColumnMapping } from './participant-import-staging.types.ts'

const mappings: readonly ColumnMapping[] = [
  { requirement: 'required', sourceColumn: 'Ticket', targetField: 'ticketNumber' },
  { requirement: 'optional', sourceColumn: 'Name', targetField: 'name' },
]
const options = { metadata: { fileName: 'participants.csv', mimeType: 'text/csv' }, mappings, strategy: 'replace' as const }

describe('participant import parser boundary', () => {
  it('dispatches CSV into Slice 1 validation and preserves exact strings', () => {
    const result = parseParticipantImport('Ticket,Name\n00042,\n42,\n1E10,\n=SUM(A1:A2),', options)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.parsed.rows.map((row) => row.values.Ticket)).toEqual(['00042', '42', '1E10', '=SUM(A1:A2)'])
      expect(result.validation.summary).toMatchObject({ totalRows: 4, validRows: 4, duplicateRows: 0 })
    }
  })

  it('keeps missing names valid and missing tickets invalid', () => {
    const result = parseParticipantImport('Ticket,Name\n00042,\n,No ticket', options)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.validation.summary).toMatchObject({ validRows: 1, invalidRows: 1, emptyTicketRows: 1 })
      expect(result.validation.rows[0]?.participantDraft?.name).toBeUndefined()
      expect(result.validation.rows[1]?.participantDraft).toBeNull()
    }
  })

  it('reconciles exact duplicate tickets and never drafts rows after parser failure', () => {
    const duplicate = parseParticipantImport('Ticket,Name\n00042,A\n00042,B\n42,C', options)
    expect(duplicate.ok && duplicate.validation.summary).toMatchObject({ duplicateRows: 2, validRows: 1 })
    const failure = parseParticipantImport('Ticket,Name\n"00042,A', options)
    expect(failure).toMatchObject({ ok: false, code: 'csv-parse-failed' })
  })

  it('returns typed results for unsupported and XLSX formats', () => {
    expect(parseParticipantImport('', { ...options, metadata: { fileName: 'participants.pdf', mimeType: 'application/pdf' } })).toMatchObject({ ok: false, code: 'unsupported-format' })
    expect(parseParticipantImport('', { ...options, metadata: { fileName: 'participants.xlsx' } })).toMatchObject({ ok: false, code: 'parser-not-implemented', format: 'xlsx' })
  })
})
