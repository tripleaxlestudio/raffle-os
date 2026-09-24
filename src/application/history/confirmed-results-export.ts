import type { WorkBook } from 'xlsx'
import type { EventId } from '../../domain/shared/identifiers.ts'
import type { HistoryReconstruction } from './history-read-model.ts'

export const CONFIRMED_RESULTS_COLUMNS = [
  'event_id', 'event_name', 'draw_session_id', 'draw_timestamp', 'confirmed_at',
  'mode', 'category_id', 'category_name', 'prize_name', 'winner_record_id',
  'sequence_number', 'participant_id', 'ticket_number', 'participant_display_name',
] as const

export type ConfirmedResultsColumn = typeof CONFIRMED_RESULTS_COLUMNS[number]
export type ConfirmedResultsRow = Readonly<Record<ConfirmedResultsColumn, string>>

function compareRows(left: ConfirmedResultsRow, right: ConfirmedResultsRow): number {
  return left.confirmed_at.localeCompare(right.confirmed_at)
    || left.draw_timestamp.localeCompare(right.draw_timestamp)
    || Number(left.sequence_number) - Number(right.sequence_number)
    || left.winner_record_id.localeCompare(right.winner_record_id)
}

function text(value: string | number | null | undefined): string { return value === null || value === undefined ? '' : String(value) }

/** Builds the single read-only, Event-scoped projection consumed by both exporters. */
export function projectConfirmedResults(input: {
  readonly eventId: EventId | string
  readonly sessions: readonly HistoryReconstruction[]
}): readonly ConfirmedResultsRow[] {
  return input.sessions.flatMap((reconstruction) => {
    const item = reconstruction.value
    if (item.summary.eventId !== input.eventId || item.session.mode !== 'live') return []
    return item.winners.filter((winner) => winner.status === 'confirmed').map((winner) => ({
      category_id: text(item.summary.categoryId),
      category_name: text(item.summary.categoryName),
      confirmed_at: text(winner.confirmationTimestamp),
      draw_session_id: text(item.session.id),
      draw_timestamp: text(item.session.createdAt),
      event_id: text(item.summary.eventId),
      event_name: text(item.event?.name ?? item.summary.eventName),
      mode: 'live',
      participant_display_name: text(winner.participantDisplayName),
      participant_id: text(winner.participantId),
      prize_name: text(item.summary.prizeName),
      sequence_number: text(winner.sequence),
      ticket_number: text(winner.ticketNumber),
      winner_record_id: text(winner.winnerRecordId),
    }))
  }).slice().sort(compareRows)
}

function csvCell(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function serializeConfirmedResultsCsv(rows: readonly ConfirmedResultsRow[]): string {
  return [CONFIRMED_RESULTS_COLUMNS.join(','), ...rows.map((row) => CONFIRMED_RESULTS_COLUMNS.map((column) => csvCell(row[column])).join(','))].join('\r\n') + '\r\n'
}

async function loadSheetJs(): Promise<typeof import('xlsx')> { return import('xlsx') }

export async function createConfirmedResultsWorkbook(input: {
  readonly eventId: string
  readonly eventName: string
  readonly rows: readonly ConfirmedResultsRow[]
  readonly exportedAt: string
  readonly schemaVersion?: string
}): Promise<WorkBook> {
  const XLSX = await loadSheetJs()
  const workbook = XLSX.utils.book_new()
  const resultRows = [CONFIRMED_RESULTS_COLUMNS.slice(), ...input.rows.map((row) => CONFIRMED_RESULTS_COLUMNS.map((column) => row[column]))]
  const resultsSheet = XLSX.utils.aoa_to_sheet(resultRows)
  const ticketColumn = CONFIRMED_RESULTS_COLUMNS.indexOf('ticket_number')
  for (let row = 1; row <= input.rows.length; row += 1) {
    const address = XLSX.utils.encode_cell({ r: row, c: ticketColumn })
    resultsSheet[address] = { t: 's', v: input.rows[row - 1]?.ticket_number ?? '' }
  }
  XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Confirmed Results')
  const metadata = [['field', 'value'], ['event_id', input.eventId], ['event_name', input.eventName], ['exported_at', input.exportedAt], ['schema_version', input.schemaVersion ?? '1'], ['confirmed_row_count', String(input.rows.length)]]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(metadata), 'Metadata')
  return workbook
}

export async function serializeConfirmedResultsXlsx(input: { readonly eventId: string; readonly eventName: string; readonly rows: readonly ConfirmedResultsRow[]; readonly exportedAt: string; readonly schemaVersion?: string }): Promise<ArrayBuffer> {
  const XLSX = await loadSheetJs()
  return XLSX.write(await createConfirmedResultsWorkbook(input), { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer
}

export function createConfirmedResultsFilename(eventName: string, exportedAt: string, extension: 'csv' | 'xlsx'): string {
  const filenameCharacters = [...eventName].filter((character) => !'<>:"/\\|?*'.includes(character) && (character.codePointAt(0) ?? 0) >= 32).join('')
  const safeName = filenameCharacters.trim().replace(/\s+/gu, '-').replace(/-+/gu, '-').replace(/^-|-$/gu, '') || 'event'
  const date = new Date(exportedAt)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`
  return `${safeName}-confirmed-results-${stamp}.${extension}`
}

export function downloadExport(bytes: BlobPart, mimeType: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
