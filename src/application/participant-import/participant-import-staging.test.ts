import { describe, expect, it } from 'vitest'
import { parseTicketNumber } from '../../domain/participants/participant.invariants.ts'
import {
  parseSupportedFileType,
  validateImportFileMetadata,
  validateParticipantImport,
} from './participant-import-staging.ts'
import type {
  ColumnMapping,
  RawImportRow,
} from './participant-import-staging.types.ts'

const mappings: readonly ColumnMapping[] = [
  { requirement: 'required', sourceColumn: 'Ticket', targetField: 'ticketNumber' },
  { requirement: 'optional', sourceColumn: 'Name', targetField: 'name' },
  { requirement: 'optional', sourceColumn: 'Group', targetField: 'group' },
  { requirement: 'optional', sourceColumn: 'Notes', targetField: 'notes' },
  { requirement: 'optional', sourceColumn: 'Checked In', targetField: 'isCheckedIn' },
]

function row(rowNumber: number, values: Record<string, unknown>): RawImportRow {
  return { rowNumber, values }
}

describe('participant import staging validation', () => {
  it('preserves 00042 as a string through the validated draft', () => {
    const result = validateParticipantImport(
      [row(2, { Ticket: '00042' })],
      mappings,
      'replace',
    )

    expect(result.rows[0]?.participantDraft?.ticketNumber).toBe('00042')
  })

  it('rejects numeric ticket input at the raw-row boundary', () => {
    const result = validateParticipantImport(
      [row(2, { Ticket: 42 })],
      mappings,
      'replace',
    )

    expect(result.rows[0]?.issues[0]?.code).toBe('malformed-ticket')
    expect(result.rows[0]?.participantDraft).toBeNull()
    expect(parseTicketNumber(42).ok).toBe(false)
  })

  it('requires a ticket but permits a missing participant name', () => {
    const valid = validateParticipantImport(
      [row(2, { Ticket: '00042', Name: '' })],
      mappings,
      'replace',
    )
    const missingTicket = validateParticipantImport(
      [row(2, { Ticket: '' })],
      mappings,
      'replace',
    )

    expect(valid.summary.validRows).toBe(1)
    expect(valid.rows[0]?.participantDraft?.name).toBeUndefined()
    expect(missingTicket.rows[0]?.issues[0]?.code).toBe('missing-ticket')
  })

  it('reports exact duplicate tickets without normalizing leading zeroes', () => {
    const result = validateParticipantImport(
      [
        row(2, { Ticket: '00042' }),
        row(3, { Ticket: '00042' }),
        row(4, { Ticket: '42' }),
      ],
      mappings,
      'merge',
    )

    expect(result.summary.duplicateRows).toBe(2)
    expect(result.rows[0]?.issues[0]?.code).toBe('duplicate-ticket')
    expect(result.rows[2]?.participantDraft?.ticketNumber).toBe('42')
  })

  it('does not convert invalid rows into participant drafts', () => {
    const result = validateParticipantImport(
      [row(2, { Ticket: '00042', Name: 99 })],
      mappings,
      'replace',
    )

    expect(result.rows[0]?.participantDraft).toBeNull()
    expect(result.rows[0]?.issues[0]?.code).toBe('malformed-field')
  })

  it('produces a typed draft with optional fields when a row is valid', () => {
    const result = validateParticipantImport(
      [
        row(2, {
          'Checked In': 'yes',
          Group: 'VIP',
          Name: 'Ayu',
          Notes: 'Front row',
          Ticket: '00042',
        }),
      ],
      mappings,
      'replace',
    )

    expect(result.rows[0]?.participantDraft).toEqual({
      group: 'VIP',
      isCheckedIn: true,
      name: 'Ayu',
      notes: 'Front row',
      ticketNumber: '00042',
    })
  })

  it('reconciles import summary counts exactly', () => {
    const result = validateParticipantImport(
      [
        row(2, { Ticket: '00042' }),
        row(3, { Ticket: '00042' }),
        row(4, { Ticket: '' }),
        row(5, { Ticket: 7 }),
        row(6, { Ticket: '00043' }),
      ],
      mappings,
      'merge',
    )

    expect(result.summary).toEqual({
      duplicateRows: 2,
      emptyTicketRows: 1,
      invalidRows: 4,
      issueCount: 4,
      malformedRows: 1,
      strategy: 'merge',
      totalRows: 5,
      validRows: 1,
    })
    expect(
      result.summary.validRows + result.summary.invalidRows,
    ).toBe(result.summary.totalRows)
  })

  it('reports unsupported file types as typed issues', () => {
    expect(parseSupportedFileType('pdf')).toBeNull()
    expect(validateImportFileMetadata({ fileType: 'pdf' })).toEqual([
      expect.objectContaining({
        code: 'unsupported-file-type',
        severity: 'error',
      }),
    ])
  })
})

