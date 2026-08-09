import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { DrawSessionId, EventId } from '../../domain/shared/identifiers.ts'
import type { RedrawRecord } from '../../domain/winners/redraw.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { AuditReadRepository } from '../persistence/repositories/audit-repository.interface.ts'
import type { DrawConfigurationRepository } from '../persistence/repositories/draw-configuration-repository.interface.ts'
import type { DrawSessionReadRepository } from '../persistence/repositories/draw-session-repository.interface.ts'
import type { EventRepository } from '../persistence/repositories/event-repository.interface.ts'
import type { PrizeCategoryRepository } from '../persistence/repositories/prize-category-repository.interface.ts'
import type { RedrawReadRepository } from '../persistence/repositories/redraw-repository.interface.ts'
import type { WinnerReadRepository } from '../persistence/repositories/winner-repository.interface.ts'

export interface OfficialHistoryRecord {
  readonly winner: WinnerRecord
  readonly session: DrawSession
  readonly event: Event
  readonly category: PrizeCategory | null
  readonly redraw: RedrawRecord | null
  readonly replacement: WinnerRecord | null
  readonly actor: 'local-operator'
  readonly cancellation: AuditRecord | null
  readonly redrawAudit: AuditRecord | null
}

export type OfficialHistoryRelation = 'valid' | 'missing-category' | 'missing-event' | 'missing-winner'

export interface OfficialHistorySession {
  readonly session: DrawSession
  readonly event: Event
  readonly category: PrizeCategory | null
  readonly records: readonly OfficialHistoryRecord[]
  readonly relation: OfficialHistoryRelation
}

export type HistoryReconstructionIssueCode =
  | 'missing-event'
  | 'missing-category'
  | 'missing-configuration'
  | 'missing-winner'
  | 'missing-redraw-original'
  | 'missing-redraw-replacement'
  | 'inconsistent-session-ownership'
  | 'inconsistent-event-ownership'
  | 'inconsistent-category-ownership'
  | 'inconsistent-configuration-ownership'
  | 'inconsistent-snapshot'
  | 'malformed-redraw-lineage'
  | 'unassociated-audit'

export interface HistoryReconstructionIssue {
  readonly code: HistoryReconstructionIssueCode
  readonly message: string
  readonly recordId?: string
}

export interface HistorySessionSummary {
  readonly drawSessionId: DrawSessionId
  readonly eventId: Event['id']
  readonly eventName: string
  readonly mode: DrawSession['mode']
  readonly sessionStatus: DrawSession['status']
  readonly drawTimestamp: DrawSession['createdAt']
  readonly completionTimestamp?: DrawSession['completedAt']
  readonly eligibleCount: number | null
  readonly requestedWinnerCount: number | null
  readonly categoryId: string | null
  readonly categoryName: string | null
  readonly prizeName: string | null
}

export interface ReconstructedWinner {
  readonly winnerRecordId: WinnerRecord['id']
  readonly drawSessionId: DrawSessionId
  readonly participantId: WinnerRecord['participantId']
  readonly ticketNumber: WinnerRecord['ticketNumber']
  readonly sequence: number
  readonly status: WinnerRecord['status']
  readonly selectedTimestamp: WinnerRecord['createdAt']
  readonly confirmationTimestamp?: WinnerRecord['confirmedAt']
  readonly cancellationTimestamp?: WinnerRecord['cancelledAt']
}

export interface ReconstructedRedrawLineage {
  readonly originalWinnerRecordId: WinnerRecord['id']
  readonly originalTicketNumber: WinnerRecord['ticketNumber']
  readonly replacementWinnerRecordId: WinnerRecord['id']
  readonly replacementTicketNumber: WinnerRecord['ticketNumber']
  readonly redrawRecordId: RedrawRecord['id']
  readonly reason: RedrawRecord['reason']
  readonly reasonNote?: RedrawRecord['reasonNote']
  readonly redrawTimestamp: RedrawRecord['createdAt']
}

export interface ReconstructedHistorySession {
  readonly summary: HistorySessionSummary
  readonly session: DrawSession
  readonly event: Event | null
  readonly category: PrizeCategory | null
  readonly configuration: DrawConfiguration | null
  readonly winners: readonly ReconstructedWinner[]
  readonly redraws: readonly RedrawRecord[]
  readonly lineages: readonly ReconstructedRedrawLineage[]
  readonly audits: readonly AuditRecord[]
  readonly issues: readonly HistoryReconstructionIssue[]
}

export type HistoryReconstruction =
  | { readonly kind: 'complete'; readonly value: ReconstructedHistorySession }
  | { readonly kind: 'incomplete'; readonly value: ReconstructedHistorySession }

export interface HistoryReadRepositories {
  readonly events: Pick<EventRepository, 'findById'>
  readonly sessions: Pick<DrawSessionReadRepository, 'findById' | 'findByEventId'>
  readonly configurations: Pick<DrawConfigurationRepository, 'findById'>
  readonly categories: Pick<PrizeCategoryRepository, 'findById'>
  readonly winners: Pick<WinnerReadRepository, 'findByDrawSessionId'>
  readonly redraws: Pick<RedrawReadRepository, 'findByDrawSessionId'>
  readonly audits: Pick<AuditReadRepository, 'findByEventId'>
}

export interface OfficialHistoryEventProjection {
  readonly eventId: EventId
  readonly sessions: readonly HistoryReconstruction[]
}

function compareByTimestampAndId(left: { readonly timestamp: string; readonly id: string }, right: { readonly timestamp: string; readonly id: string }): number {
  return left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id)
}

function compareWinners(left: WinnerRecord, right: WinnerRecord): number {
  return left.sequenceNumber - right.sequenceNumber || left.id.localeCompare(right.id)
}

function compareRedraws(left: RedrawRecord, right: RedrawRecord): number {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
}

function detailObject(detail: AuditRecord['detail']): Readonly<Record<string, unknown>> | null {
  if (typeof detail !== 'object' || detail === null || Array.isArray(detail)) return null
  return detail as Readonly<Record<string, unknown>>
}

function auditForWinner(audits: readonly AuditRecord[], action: AuditRecord['action'], winnerId: string): AuditRecord | null {
  return audits.find((audit) => {
    if (audit.action !== action) return false
    const detail = detailObject(audit.detail)
    return detail?.winnerId === winnerId || detail?.originalWinnerId === winnerId
  }) ?? null
}

function buildSummary(session: DrawSession, event: Event | null): HistorySessionSummary {
  const snapshot = session.configurationSnapshot
  return {
    categoryId: snapshot?.prizeCategoryId ?? null,
    categoryName: snapshot?.categoryName ?? null,
    completionTimestamp: session.completedAt,
    drawSessionId: session.id,
    drawTimestamp: session.createdAt,
    eligibleCount: session.candidatePoolSnapshot?.eligibleSnapshotCount ?? null,
    eventId: session.eventId,
    eventName: event?.name ?? '',
    mode: session.mode,
    prizeName: snapshot?.prizeName ?? null,
    requestedWinnerCount: snapshot?.requestedWinners ?? null,
    sessionStatus: session.status,
  }
}

export async function reconstructOfficialHistorySession(
  drawSessionId: DrawSessionId,
  repositories: HistoryReadRepositories,
): Promise<HistoryReconstruction | null> {
  const session = await repositories.sessions.findById(drawSessionId)
  if (session === null) return null

  const event = await repositories.events.findById(session.eventId)
  const configuration = await repositories.configurations.findById(session.configurationId)
  const categoryId = session.configurationSnapshot?.prizeCategoryId ?? configuration?.prizeCategoryId
  const category = categoryId === undefined ? null : await repositories.categories.findById(categoryId as PrizeCategory['id'])
  const [winners, redraws, audits] = await Promise.all([
    repositories.winners.findByDrawSessionId(session.id),
    repositories.redraws.findByDrawSessionId(session.id),
    repositories.audits.findByEventId(session.eventId),
  ])

  const issues: HistoryReconstructionIssue[] = []
  if (event === null) issues.push({ code: 'missing-event', message: 'The parent Event could not be resolved.' })
  if (configuration === null) issues.push({ code: 'missing-configuration', message: 'The DrawConfiguration could not be resolved.' })
  if (category === null) issues.push({ code: 'missing-category', message: 'The PrizeCategory could not be resolved.' })
  if (event !== null && session.eventId !== event.id) issues.push({ code: 'inconsistent-event-ownership', message: 'The DrawSession Event relationship is inconsistent.' })
  if (configuration !== null && configuration.eventId !== session.eventId) issues.push({ code: 'inconsistent-configuration-ownership', message: 'The DrawConfiguration belongs to a different Event.', recordId: configuration.id })
  if (category !== null && category.eventId !== session.eventId) issues.push({ code: 'inconsistent-category-ownership', message: 'The PrizeCategory belongs to a different Event.', recordId: category.id })
  if (configuration !== null && session.configurationSnapshot !== null && (configuration.id !== session.configurationSnapshot.configurationId || configuration.prizeCategoryId !== session.configurationSnapshot.prizeCategoryId)) issues.push({ code: 'inconsistent-snapshot', message: 'The persisted configuration snapshot does not match its source configuration.' })
  if (category !== null && session.configurationSnapshot !== null && (category.id !== session.configurationSnapshot.prizeCategoryId || category.name !== session.configurationSnapshot.categoryName || category.prizeName !== session.configurationSnapshot.prizeName)) issues.push({ code: 'inconsistent-snapshot', message: 'The persisted category/prize snapshot does not match its source category.' })

  for (const winner of winners) {
    if (winner.drawSessionId !== session.id) issues.push({ code: 'inconsistent-session-ownership', message: 'A WinnerRecord belongs to a different DrawSession.', recordId: winner.id })
    if (winner.eventId !== session.eventId) issues.push({ code: 'inconsistent-event-ownership', message: 'A WinnerRecord belongs to a different Event.', recordId: winner.id })
  }
  const winnerById = new Map(winners.map((winner) => [winner.id, winner]))
  const lineages: ReconstructedRedrawLineage[] = []
  for (const redraw of redraws.slice().sort(compareRedraws)) {
    const original = winnerById.get(redraw.originalWinnerRecordId)
    const replacement = winnerById.get(redraw.replacementWinnerRecordId)
    if (original === undefined) issues.push({ code: 'missing-redraw-original', message: 'A RedrawRecord references a missing original WinnerRecord.', recordId: redraw.id })
    if (replacement === undefined) issues.push({ code: 'missing-redraw-replacement', message: 'A RedrawRecord references a missing replacement WinnerRecord.', recordId: redraw.id })
    if (original === undefined || replacement === undefined) continue
    if (redraw.eventId !== session.eventId || redraw.drawSessionId !== session.id || original.status !== 'cancelled' || replacement.id === original.id) {
      issues.push({ code: 'malformed-redraw-lineage', message: 'A RedrawRecord does not describe a valid original-to-replacement lineage.', recordId: redraw.id })
      continue
    }
    lineages.push({ originalTicketNumber: original.ticketNumber, originalWinnerRecordId: original.id, reason: redraw.reason, reasonNote: redraw.reasonNote, redrawRecordId: redraw.id, redrawTimestamp: redraw.createdAt, replacementTicketNumber: replacement.ticketNumber, replacementWinnerRecordId: replacement.id })
  }

  const sortedAudits = audits.slice().sort(compareByTimestampAndId)
  return {
    kind: issues.length === 0 ? 'complete' : 'incomplete',
    value: {
      audits: sortedAudits,
      category,
      configuration,
      event,
      issues,
      lineages,
      redraws: redraws.slice().sort(compareRedraws),
      session,
      summary: buildSummary(session, event),
      winners: winners.slice().sort(compareWinners).map((winner) => ({ cancellationTimestamp: winner.cancelledAt, confirmationTimestamp: winner.confirmedAt, drawSessionId: winner.drawSessionId, participantId: winner.participantId, selectedTimestamp: winner.createdAt, sequence: winner.sequenceNumber, status: winner.status, ticketNumber: winner.ticketNumber, winnerRecordId: winner.id })),
    },
  }
}

function compareReconstructedSessions(left: HistoryReconstruction, right: HistoryReconstruction): number {
  const leftSession = left.value.session
  const rightSession = right.value.session
  const unresolved = (status: DrawSession['status']): number => status === 'drawing' || status === 'pending-confirmation' ? 0 : 1
  return unresolved(leftSession.status) - unresolved(rightSession.status) || rightSession.updatedAt.localeCompare(leftSession.updatedAt) || leftSession.id.localeCompare(rightSession.id)
}

/**
 * The single event-scoped read boundary for official History consumers.
 * Practice sessions are intentionally excluded before reconstruction.
 */
export async function reconstructOfficialHistoryForEvent(
  eventId: EventId,
  repositories: HistoryReadRepositories,
): Promise<OfficialHistoryEventProjection> {
  const sessions = (await repositories.sessions.findByEventId(eventId)).filter((session) => session.eventId === eventId && session.mode === 'live')
  const reconstructed = (await Promise.all(sessions.map((session) => reconstructOfficialHistorySession(session.id, repositories)))).filter((result): result is HistoryReconstruction => result !== null)
  return { eventId, sessions: reconstructed.slice().sort(compareReconstructedSessions) }
}

export function buildOfficialHistorySession(
  session: DrawSession,
  event: Event,
  category: PrizeCategory | null,
  winners: readonly WinnerRecord[],
  redraws: readonly RedrawRecord[],
  relation: OfficialHistoryRelation = category === null ? 'missing-category' : 'valid',
  audits: readonly AuditRecord[] = [],
): OfficialHistorySession {
  const byId = new Map(winners.map((winner) => [winner.id, winner]))
  const redrawByOriginal = new Map(redraws.map((redraw) => [redraw.originalWinnerRecordId, redraw]))
  const orderedAudits = audits.slice().sort(compareByTimestampAndId)
  return {
    category,
    event,
    records: winners.slice().sort(compareWinners).map((winner) => {
      const redraw = redrawByOriginal.get(winner.id) ?? null
      return { actor: 'local-operator', cancellation: auditForWinner(orderedAudits, 'winner-cancelled', winner.id), category, event, redraw, redrawAudit: auditForWinner(orderedAudits, 'redraw-recorded', winner.id), replacement: redraw === null ? null : byId.get(redraw.replacementWinnerRecordId) ?? null, session, winner }
    }),
    relation,
    session,
  }
}
