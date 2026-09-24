import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'

export interface LiveResultProjection {
  readonly drawSessionId: DrawSessionId
  readonly winnerRecordIds: readonly WinnerRecord['id'][]
  readonly ticketNumbers: readonly WinnerRecord['ticketNumber'][]
}

export function projectLiveResult(drawSessionId: DrawSessionId, winners: readonly WinnerRecord[]): LiveResultProjection {
  return {
    drawSessionId,
    winnerRecordIds: winners.filter((winner) => winner.drawSessionId === drawSessionId).map((winner) => winner.id),
    ticketNumbers: winners.filter((winner) => winner.drawSessionId === drawSessionId).map((winner) => winner.ticketNumber),
  }
}
