import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HistoryReconstruction } from './history-read-model.ts'
import { CONFIRMED_RESULTS_COLUMNS, createConfirmedResultsFilename, projectConfirmedResults, serializeConfirmedResultsCsv, serializeConfirmedResultsXlsx } from './confirmed-results-export.ts'

const eventId = 'event-1'

function parseCsv(csv: string): string[][] {
  const records: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    if (quoted && character === '"' && csv[index + 1] === '"') { cell += '"'; index += 1; continue }
    if (character === '"') { quoted = !quoted; continue }
    if (!quoted && character === ',') { row.push(cell); cell = ''; continue }
    if (!quoted && character === '\r' && csv[index + 1] === '\n') { row.push(cell); records.push(row); row = []; cell = ''; index += 1; continue }
    cell += character
  }
  return records
}

function history(): HistoryReconstruction[] {
  const makeSession = (id: string, createdAt: string, winners: readonly Record<string, unknown>[]) => ({ kind: 'complete' as const, value: {
    event: { id: eventId, name: 'Unicode Événement', status: 'live', createdAt, updatedAt: createdAt },
    issues: [], lineages: [], redraws: [], session: { id, eventId, mode: 'live', status: 'completed', createdAt, updatedAt: createdAt, configurationId: `config-${id}`, configurationSnapshot: { snapshotFormatVersion: 1, configurationId: `config-${id}`, prizeCategoryId: `category-${id}`, categoryName: 'Category', prizeName: 'Prize 🎁', requestedWinners: 2, winningRule: 'all-participants', requireCheckIn: false, eligibleGroupFilter: null, capturedAt: createdAt }, candidatePoolSnapshot: null, completedAt: '2026-08-10T01:00:00.000Z' },
    summary: { drawSessionId: id, eventId, eventName: 'Unicode Événement', mode: 'live', sessionStatus: 'completed', drawTimestamp: createdAt, completionTimestamp: '2026-08-10T01:00:00.000Z', eligibleCount: 2, requestedWinnerCount: 2, categoryId: `category-${id}`, categoryName: 'Category', prizeName: 'Prize 🎁' },
    category: null, configuration: null, audits: [], winners,
  } as never })
  return [makeSession('session-later', '2026-08-10T00:02:00.000Z', [
    { winnerRecordId: 'winner-42', drawSessionId: 'session-later', participantId: 'participant-42', ticketNumber: '42', sequence: 2, status: 'confirmed', confirmationTimestamp: '2026-08-10T00:04:00.000Z', participantDisplayName: 'Béa, "Winner"' },
    { winnerRecordId: 'winner-cancelled', drawSessionId: 'session-later', participantId: 'participant-old', ticketNumber: '00042', sequence: 1, status: 'cancelled', cancellationTimestamp: '2026-08-10T00:03:00.000Z' },
    { winnerRecordId: 'winner-pending', drawSessionId: 'session-later', participantId: 'participant-pending', ticketNumber: '00321', sequence: 3, status: 'pending' },
  ]), makeSession('session-earlier', '2026-08-10T00:01:00.000Z', [
    { winnerRecordId: 'winner-replacement', drawSessionId: 'session-earlier', participantId: 'participant-new', ticketNumber: '00321', sequence: 1, status: 'confirmed', confirmationTimestamp: '2026-08-10T00:05:00.000Z', participantDisplayName: 'Andi' },
  ])]
}

describe('confirmed results export', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('projects confirmed Live winners only, preserves ticket strings, redraw replacements, and deterministic order', () => {
    const rows = projectConfirmedResults({ eventId, sessions: history() })
    expect(rows.map((row) => row.ticket_number)).toEqual(['42', '00321'])
    expect(rows[0]?.participant_display_name).toBe('Béa, "Winner"')
    expect(rows.some((row) => row.ticket_number === '00042')).toBe(false)
  })

  it('serializes an escaped Unicode CSV with a stable header and round-trips its rows', () => {
    const rows = projectConfirmedResults({ eventId, sessions: history() })
    const csv = serializeConfirmedResultsCsv(rows)
    expect(csv.startsWith(`${CONFIRMED_RESULTS_COLUMNS.join(',')}\r\n`)).toBe(true)
    expect(csv).toContain('"Béa, ""Winner"""')
    const parsed = parseCsv(csv)
    expect(parsed[0]).toEqual([...CONFIRMED_RESULTS_COLUMNS])
    expect(parsed).toHaveLength(3)
    expect(parsed.slice(1).map((row) => row[12])).toEqual(['42', '00321'])
  })

  it('writes the same rows to Confirmed Results and keeps tickets as text cells after XLSX round-trip', async () => {
    const rows = projectConfirmedResults({ eventId, sessions: history() })
    const buffer = await serializeConfirmedResultsXlsx({ eventId, eventName: 'Unicode Événement', exportedAt: '2026-08-10T12:34:56.000Z', rows })
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
    const sheet = workbook.Sheets['Confirmed Results']
    expect(workbook.SheetNames).toEqual(['Confirmed Results', 'Metadata'])
    expect(XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })).toEqual([[...CONFIRMED_RESULTS_COLUMNS], expect.any(Array), expect.any(Array)])
    const tickets = [sheet[XLSX.utils.encode_cell({ r: 1, c: 12 })], sheet[XLSX.utils.encode_cell({ r: 2, c: 12 })]]
    expect(tickets.map((cell) => cell.v)).toEqual(['42', '00321'])
    expect(tickets.every((cell) => cell.t === 's')).toBe(true)
  })

  it('supports a deterministic empty export and sanitizes filenames', () => {
    expect(serializeConfirmedResultsCsv([])).toBe(`${CONFIRMED_RESULTS_COLUMNS.join(',')}\r\n`)
    expect(createConfirmedResultsFilename('Bad: Event / Name', '2026-08-10T05:34:56.000Z', 'xlsx')).toBe('Bad-Event-Name-confirmed-results-202608101234.xlsx')
  })

  it('uses the local calendar date when UTC crosses midnight locally', () => {
    vi.stubEnv('TZ', 'Asia/Jakarta')

    expect(createConfirmedResultsFilename('HUT RI 81', '2026-08-09T18:05:56.000Z', 'csv')).toBe('HUT-RI-81-confirmed-results-202608100105.csv')
  })
})
