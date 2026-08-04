import { parseTicketNumber } from '../../domain/participants/participant.invariants.ts'
import type {
  ColumnMapping,
  ImportFileMetadata,
  ImportStrategy,
  NormalizedStagingRow,
  ParticipantImportField,
  ParticipantImportValidationResult,
  ParticipantImportRowResult,
  RawImportRow,
  SupportedFileType,
  ValidatedParticipantDraft,
  ValidationIssue,
} from './participant-import-staging.types.ts'

export function parseSupportedFileType(
  value: unknown,
): SupportedFileType | null {
  if (value === 'csv' || value === 'xlsx') {
    return value
  }

  return null
}

export function validateImportFileMetadata(
  metadata: ImportFileMetadata | Readonly<Record<string, unknown>>,
): readonly ValidationIssue[] {
  const fileType = metadata.fileType
  if (parseSupportedFileType(fileType) !== null) {
    return []
  }

  return [
    {
      code: 'unsupported-file-type',
      message: 'Import file type must be CSV or XLSX.',
      rowNumber: 0,
      severity: 'error',
    },
  ]
}

export function validateParticipantImport(
  rows: readonly RawImportRow[],
  mappings: readonly ColumnMapping[],
  strategy: ImportStrategy,
): ParticipantImportValidationResult {
  const mappingByTarget = new Map(
    mappings.map((mapping) => [mapping.targetField, mapping]),
  )
  const preliminary = rows.map((row) =>
    validateRow(row, mappingByTarget),
  )
  const ticketOccurrences = new Map<string, number>()

  for (const result of preliminary) {
    if (result.normalized.ticketNumber !== null) {
      ticketOccurrences.set(
        result.normalized.ticketNumber,
        (ticketOccurrences.get(result.normalized.ticketNumber) ?? 0) + 1,
      )
    }
  }

  const validatedRows = preliminary.map((result) => {
    const ticket = result.normalized.ticketNumber
    const duplicate =
      ticket !== null && (ticketOccurrences.get(ticket) ?? 0) > 1
    const issues = duplicate
      ? [
          ...result.issues,
          {
            code: 'duplicate-ticket' as const,
            field: 'ticketNumber' as const,
            message: 'Ticket number is duplicated in this import.',
            rowNumber: result.normalized.rowNumber,
            severity: 'error' as const,
          },
        ]
      : result.issues
    const participantDraft =
      issues.some((issue) => issue.severity === 'error')
        ? null
        : createParticipantDraft(result.normalized)

    return { ...result, issues, participantDraft }
  })

  return {
    rows: validatedRows,
    summary: summarize(validatedRows, strategy),
  }
}

function validateRow(
  row: RawImportRow,
  mappingByTarget: ReadonlyMap<ParticipantImportField, ColumnMapping>,
): ParticipantImportRowResult {
  const issues: ValidationIssue[] = []
  const read = (field: ParticipantImportField): unknown => {
    const mapping = mappingByTarget.get(field)
    return mapping?.sourceColumn === null || mapping === undefined
      ? undefined
      : row.values[mapping.sourceColumn]
  }

  const ticketValue = read('ticketNumber')
  let ticketNumber: string | null = null
  if (typeof ticketValue !== 'string' || ticketValue.length === 0) {
    issues.push({
      code:
        ticketValue === undefined || ticketValue === ''
          ? 'missing-ticket'
          : 'malformed-ticket',
      field: 'ticketNumber',
      message:
        ticketValue === undefined || ticketValue === ''
          ? 'Ticket Number is required.'
          : 'Ticket Number must be supplied as a string.',
      rowNumber: row.rowNumber,
      severity: 'error',
    })
  } else {
    const parsedTicket = parseTicketNumber(ticketValue)
    if (parsedTicket.ok) {
      ticketNumber = parsedTicket.value
    }
  }

  const name = readOptionalText(row, 'name', read('name'), issues)
  const group = readOptionalText(row, 'group', read('group'), issues)
  const notes = readOptionalText(row, 'notes', read('notes'), issues)
  const isCheckedIn = readCheckIn(row, read('isCheckedIn'), issues)

  return {
    normalized: {
      group,
      isCheckedIn,
      name,
      notes,
      rowNumber: row.rowNumber,
      ticketNumber,
    },
    issues,
    participantDraft: null,
  }
}

function readOptionalText(
  row: RawImportRow,
  field: Extract<ParticipantImportField, 'name' | 'group' | 'notes'>,
  value: unknown,
  issues: ValidationIssue[],
): string | undefined {
  if (value === undefined || value === '') {
    return undefined
  }
  if (typeof value !== 'string') {
    issues.push({
      code: 'malformed-field',
      field,
      message: `${field} must be supplied as text when present.`,
      rowNumber: row.rowNumber,
      severity: 'error',
    })
    return undefined
  }
  return value
}

function readCheckIn(
  row: RawImportRow,
  value: unknown,
  issues: ValidationIssue[],
): boolean | null {
  if (value === undefined || value === '') {
    return null
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (normalized === 'true' || normalized === 'yes' || normalized === '1') {
      return true
    }
    if (normalized === 'false' || normalized === 'no' || normalized === '0') {
      return false
    }
  }
  issues.push({
    code: 'malformed-check-in',
    field: 'isCheckedIn',
    message: 'Check-in must be a boolean or a supported boolean string.',
    rowNumber: row.rowNumber,
    severity: 'error',
  })
  return null
}

function createParticipantDraft(
  row: NormalizedStagingRow,
): ValidatedParticipantDraft | null {
  if (row.ticketNumber === null) {
    return null
  }

  const ticketResult = parseTicketNumber(row.ticketNumber)
  if (!ticketResult.ok) {
    return null
  }

  return {
    group: row.group,
    isCheckedIn: row.isCheckedIn ?? false,
    name: row.name,
    notes: row.notes,
    ticketNumber: ticketResult.value,
  }
}

function summarize(
  rows: readonly ParticipantImportRowResult[],
  strategy: ImportStrategy,
) {
  const invalidRows = rows.filter((row) => row.participantDraft === null)
  const hasCode = (row: ParticipantImportRowResult, code: ValidationIssue['code']) =>
    row.issues.some((issue) => issue.code === code)

  return {
    duplicateRows: rows.filter((row) => hasCode(row, 'duplicate-ticket')).length,
    emptyTicketRows: rows.filter((row) => hasCode(row, 'missing-ticket')).length,
    invalidRows: invalidRows.length,
    issueCount: rows.reduce((count, row) => count + row.issues.length, 0),
    malformedRows: rows.filter((row) =>
      row.issues.some((issue) =>
        issue.code === 'malformed-ticket' ||
        issue.code === 'malformed-field' ||
        issue.code === 'malformed-check-in',
      ),
    ).length,
    strategy,
    totalRows: rows.length,
    validRows: rows.length - invalidRows.length,
  }
}
