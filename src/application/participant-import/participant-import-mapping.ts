import type { ColumnMapping, ParticipantImportField } from './participant-import-staging.types.ts'

export const PARTICIPANT_IMPORT_FIELDS: readonly {
  field: ParticipantImportField
  label: string
  requirement: 'required' | 'optional'
}[] = [
  { field: 'ticketNumber', label: 'Ticket Number', requirement: 'required' },
  { field: 'name', label: 'Participant Name', requirement: 'optional' },
  { field: 'group', label: 'Group', requirement: 'optional' },
  { field: 'notes', label: 'Notes', requirement: 'optional' },
  { field: 'isCheckedIn', label: 'Check-in', requirement: 'optional' },
]

const aliases: Readonly<Record<ParticipantImportField, readonly string[]>> = {
  ticketNumber: ['ticket number', 'ticket', 'ticket no', 'ticket id', 'nomor tiket', 'no tiket'],
  name: ['participant name', 'name', 'nama'],
  group: ['group', 'department', 'table', 'grup', 'divisi'],
  notes: ['notes', 'note', 'catatan'],
  isCheckedIn: ['checked in', 'check in', 'check-in', 'hadir', 'status hadir'],
}

export function normalizeHeader(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')
}

export function suggestColumnMappings(headers: readonly string[]): readonly ColumnMapping[] {
  const normalized = headers.map(normalizeHeader)
  return PARTICIPANT_IMPORT_FIELDS.map(({ field, requirement }) => {
    const matches = headers.filter((_, index) => aliases[field].includes(normalized[index] ?? ''))
    return {
      targetField: field,
      sourceColumn: matches.length === 1 ? matches[0] ?? null : null,
      requirement,
    }
  })
}

export function preventDuplicateSourceMappings(
  mappings: readonly ColumnMapping[],
  changedField: ParticipantImportField,
  sourceColumn: string | null,
): readonly ColumnMapping[] {
  return mappings.map((mapping) =>
    mapping.targetField === changedField
      ? { ...mapping, sourceColumn }
      : mapping.sourceColumn === sourceColumn && sourceColumn !== null
        ? { ...mapping, sourceColumn: null }
        : mapping,
  )
}
