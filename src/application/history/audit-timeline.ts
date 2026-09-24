import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import type { HistoryReconstruction, ReconstructedHistorySession } from './history-read-model.ts'

export interface AuditTimelineItem {
  readonly id: AuditRecord['id']
  readonly timestamp: AuditRecord['timestamp']
  readonly action: string
  readonly actor: string | null
  readonly drawSessionId: string | null
  readonly winnerRecordId: string | null
  readonly ticketNumber: string | null
  readonly originalTicketNumber: string | null
  readonly replacementTicketNumber: string | null
  readonly reason: string | null
  readonly note: string | null
  readonly resultingStatus: string | null
}

type Evidence = { readonly [key: string]: unknown }
function evidence(detail: AuditRecord['detail']): Evidence { return typeof detail === 'object' && detail !== null && !Array.isArray(detail) ? detail as Evidence : {} }
function stringValue(value: unknown): string | null { return typeof value === 'string' ? value : null }
function actorName(record: AuditRecord): string | null { return record.actor.type === 'operator' ? record.actor.name : 'System' }
function actionLabel(action: string): string { return ({ 'draw-session-started': 'Draw session started', 'draw-session-completed': 'Session completed', 'draw-session-cancelled': 'Session cancelled', 'winner-confirmed': 'Winner confirmed', 'winner-cancelled': 'Winner cancelled', 'redraw-recorded': 'Replacement winner recorded' } as Readonly<Record<string, string>>)[action] ?? 'Unknown audit action' }

export function projectAuditTimeline(reconstruction: HistoryReconstruction): readonly AuditTimelineItem[] {
  const item: ReconstructedHistorySession = reconstruction.value
  const winnerById = new Map<string, ReconstructedHistorySession['winners'][number]>(item.winners.map((winner) => [String(winner.winnerRecordId), winner]))
  const lineageByOriginal = new Map<string, ReconstructedHistorySession['lineages'][number]>(item.lineages.map((lineage) => [String(lineage.originalWinnerRecordId), lineage]))
  return item.audits.filter((record) => {
    const detail = evidence(record.detail)
    const sessionId = stringValue(detail.drawSessionId)
    return sessionId === item.session.id || (sessionId === null && ['draw-session-started', 'draw-session-completed', 'draw-session-cancelled'].includes(record.action))
  }).map((record) => {
    const detail = evidence(record.detail)
    const winnerId = stringValue(detail.winnerId) ?? stringValue(detail.originalWinnerId) ?? stringValue(detail.replacementWinnerId)
    const winner = winnerId === null ? undefined : winnerById.get(winnerId)
    const lineage = stringValue(detail.originalWinnerId) === null ? undefined : lineageByOriginal.get(stringValue(detail.originalWinnerId) as string)
    return { action: actionLabel(record.action), actor: actorName(record), drawSessionId: stringValue(detail.drawSessionId) ?? item.session.id, id: record.id, note: stringValue(detail.normalizedNote), originalTicketNumber: stringValue(detail.originalTicketNumber) ?? lineage?.originalTicketNumber ?? null, reason: stringValue(detail.reason) ?? lineage?.reason ?? null, replacementTicketNumber: stringValue(detail.replacementTicketNumber) ?? lineage?.replacementTicketNumber ?? null, resultingStatus: stringValue(detail.resultingSessionStatus) ?? stringValue(detail.afterStatus), ticketNumber: stringValue(detail.ticketNumber) ?? winner?.ticketNumber ?? null, timestamp: record.timestamp, winnerRecordId: winnerId }
  }).sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id))
}
