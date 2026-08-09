import type { HistoryReconstruction } from './history-read-model.ts'

export const HISTORY_STATUSES = ['draft', 'ready', 'drawing', 'pending-confirmation', 'completed', 'cancelled'] as const
export type HistoryStatus = typeof HISTORY_STATUSES[number]

export interface HistoryQuery {
  readonly status: HistoryStatus | 'all'
  readonly category: string
  readonly search: string
  readonly from: string
  readonly to: string
}

const validStatus = (value: string | null): HistoryQuery['status'] => value !== null && (value === 'all' || (HISTORY_STATUSES as readonly string[]).includes(value)) ? value as HistoryQuery['status'] : 'all'

export function readHistoryQuery(params: URLSearchParams): HistoryQuery {
  const date = (value: string | null): string => value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
  return { category: params.get('category') ?? '', from: date(params.get('from')), search: params.get('q') ?? '', status: validStatus(params.get('status')), to: date(params.get('to')) }
}

export function writeHistoryQuery(query: HistoryQuery): string {
  const params = new URLSearchParams()
  if (query.search.trim() !== '') params.set('q', query.search)
  if (query.status !== 'all') params.set('status', query.status)
  if (query.category !== '') params.set('category', query.category)
  if (query.from !== '') params.set('from', query.from)
  if (query.to !== '') params.set('to', query.to)
  return params.toString()
}

function textMatches(value: string | null | undefined, search: string): boolean { return value?.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ?? false }

export function filterOfficialHistory(sessions: readonly HistoryReconstruction[], query: HistoryQuery): readonly HistoryReconstruction[] {
  const search = query.search.trim()
  return sessions.filter((reconstruction) => {
    const item = reconstruction.value
    if (query.status !== 'all' && item.session.status !== query.status) return false
    if (query.category !== '' && item.summary.categoryId !== query.category) return false
    if (query.from !== '' && item.summary.drawTimestamp < query.from) return false
    if (query.to !== '' && item.summary.drawTimestamp.slice(0, 10) > query.to) return false
    if (search === '') return true
    const exactTicket = item.winners.some((winner) => winner.ticketNumber === search)
    return exactTicket || textMatches(item.summary.categoryName, search) || textMatches(item.summary.prizeName, search) || textMatches(item.session.id, search) || textMatches(item.summary.eventName, search)
  })
}

export interface HistoryWinnerRow { readonly reconstruction: HistoryReconstruction; readonly winner: HistoryReconstruction['value']['winners'][number] }

export function filterOfficialWinners(sessions: readonly HistoryReconstruction[], query: HistoryQuery): readonly HistoryWinnerRow[] {
  return filterOfficialHistory(sessions, query).flatMap((reconstruction) => reconstruction.value.winners.filter((winner) => query.search.trim() === '' || winner.ticketNumber === query.search.trim() || textMatches(reconstruction.value.summary.categoryName, query.search.trim()) || textMatches(reconstruction.value.summary.prizeName, query.search.trim()) || textMatches(reconstruction.value.session.id, query.search.trim())).map((winner) => ({ reconstruction, winner })))
}
