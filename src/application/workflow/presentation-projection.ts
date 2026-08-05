import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
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

export function projectLivePresentationResult(drawSessionId: DrawSessionId, records: readonly WinnerRecord[]): PresentationResultProjection {
  const related = records.filter((record) => record.drawSessionId === drawSessionId).sort((left, right) => left.sequenceNumber - right.sequenceNumber)
  if (related.length === 0 || related.some((record, index) => record.sequenceNumber !== index + 1)) throw new PresentationError('winner-relationship-invalid', 'The official WinnerRecord relationship is invalid.', false, true)
  return { drawSessionId, winners: related.map((record) => ({ winnerId: record.id, sequence: record.sequenceNumber, ticketNumber: record.ticketNumber })) }
}

export function validatePresentationResult(projection: PresentationResultProjection): PresentationResultProjection {
  if (projection.winners.length < 1 || projection.winners.length > 100 || projection.winners.some((winner, index) => winner.sequence !== index + 1 || typeof winner.ticketNumber !== 'string' || winner.ticketNumber.length === 0)) throw new PresentationError('result-projection-unavailable', 'The locked result projection is unavailable.', false, true)
  return projection
}
