import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { RedrawRecord } from '../../domain/winners/redraw.types.ts'
import { PresentationError } from './presentation-errors.ts'

export interface PresentationWinner {
  readonly winnerId: WinnerRecord['id']
  readonly sequence: number
  readonly ticketNumber: string
}

export interface PresentationResultProjection {
  readonly drawSessionId: DrawSessionId
  readonly winners: readonly PresentationWinner[]
}

export interface PresentationLineageEntry {
  readonly winnerId: WinnerRecord['id']
  readonly ticketNumber: string
  readonly status: 'replaced' | 'current'
}

export interface LiveDrawRunProjection {
  readonly result: PresentationResultProjection
  readonly lineage: readonly PresentationLineageEntry[]
}

export function projectLivePresentationResult(drawSessionId: DrawSessionId, records: readonly WinnerRecord[]): PresentationResultProjection {
  const related = records.filter((record) => record.drawSessionId === drawSessionId).sort((left, right) => left.sequenceNumber - right.sequenceNumber)
  if (related.length === 0 || related.some((record, index) => record.sequenceNumber !== index + 1)) throw new PresentationError('winner-relationship-invalid', 'The official WinnerRecord relationship is invalid.', false, true)
  return { drawSessionId, winners: related.map((record) => ({ winnerId: record.id, sequence: record.sequenceNumber, ticketNumber: record.ticketNumber })) }
}

export function projectLiveDrawRun(drawSessionId: DrawSessionId, records: readonly WinnerRecord[], redraws: readonly RedrawRecord[]): LiveDrawRunProjection {
  const related = records.filter((record) => record.drawSessionId === drawSessionId).sort((left, right) => left.sequenceNumber - right.sequenceNumber)
  if (related.length === 0) throw new PresentationError('winner-relationship-invalid', 'The official WinnerRecord relationship is invalid.', false, true)
  const replacedIds = new Set(redraws.filter((redraw) => redraw.drawSessionId === drawSessionId).map((redraw) => redraw.originalWinnerRecordId))
  const current = related.filter((record) => record.status === 'pending' && !replacedIds.has(record.id))
  if (current.length === 0) throw new PresentationError('winner-relationship-invalid', 'The current pending WinnerRecord relationship is invalid.', false, true)
  const currentIds = new Set(current.map((record) => record.id))
  return {
    result: { drawSessionId, winners: current.map((record, index) => ({ winnerId: record.id, sequence: index + 1, ticketNumber: record.ticketNumber })) },
    lineage: related.map((record) => ({ winnerId: record.id, ticketNumber: record.ticketNumber, status: currentIds.has(record.id) ? 'current' : 'replaced' })),
  }
}

export function validatePresentationResult(projection: PresentationResultProjection): PresentationResultProjection {
  if (projection.winners.length < 1 || projection.winners.length > 100 || projection.winners.some((winner, index) => winner.sequence !== index + 1 || typeof winner.ticketNumber !== 'string' || winner.ticketNumber.length === 0)) throw new PresentationError('result-projection-unavailable', 'The locked result projection is unavailable.', false, true)
  return projection
}
