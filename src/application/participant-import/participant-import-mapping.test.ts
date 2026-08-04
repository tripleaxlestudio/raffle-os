import { describe, expect, it } from 'vitest'
import { preventDuplicateSourceMappings, suggestColumnMappings } from './participant-import-mapping.ts'

describe('participant import header suggestions', () => {
  it('suggests required and optional fields from deterministic aliases', () => {
    const mappings = suggestColumnMappings(['No Tiket', 'Nama', 'Divisi', 'Catatan', 'Hadir'])
    expect(mappings).toEqual([
      expect.objectContaining({ targetField: 'ticketNumber', sourceColumn: 'No Tiket' }),
      expect.objectContaining({ targetField: 'name', sourceColumn: 'Nama' }),
      expect.objectContaining({ targetField: 'group', sourceColumn: 'Divisi' }),
      expect.objectContaining({ targetField: 'notes', sourceColumn: 'Catatan' }),
      expect.objectContaining({ targetField: 'isCheckedIn', sourceColumn: 'Hadir' }),
    ])
  })

  it('leaves ambiguous aliases unmapped and never changes row values', () => {
    expect(suggestColumnMappings(['Ticket', 'ticket number']).find((mapping) => mapping.targetField === 'ticketNumber')?.sourceColumn).toBeNull()
    expect(suggestColumnMappings(['00042']).map((mapping) => mapping.sourceColumn)).not.toContain('42')
  })

  it('prevents one source column from mapping to multiple targets', () => {
    const mappings = suggestColumnMappings(['Ticket Number', 'Name'])
    const changed = preventDuplicateSourceMappings(mappings, 'name', 'Ticket Number')
    expect(changed.find((mapping) => mapping.targetField === 'ticketNumber')?.sourceColumn).toBeNull()
    expect(changed.find((mapping) => mapping.targetField === 'name')?.sourceColumn).toBe('Ticket Number')
  })
})
