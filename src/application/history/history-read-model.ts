import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { RedrawRecord } from '../../domain/winners/redraw.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'

export interface OfficialHistoryRecord {
  readonly winner: WinnerRecord
  readonly session: DrawSession
  readonly event: Event
  readonly category: PrizeCategory | null
  readonly redraw: RedrawRecord | null
  readonly replacement: WinnerRecord | null
  readonly actor: 'local-operator'
}

export interface OfficialHistorySession {
  readonly session: DrawSession
  readonly event: Event
  readonly category: PrizeCategory | null
  readonly records: readonly OfficialHistoryRecord[]
}

export function buildOfficialHistorySession(
  session: DrawSession,
  event: Event,
  category: PrizeCategory | null,
  winners: readonly WinnerRecord[],
  redraws: readonly RedrawRecord[],
): OfficialHistorySession {
  const byId = new Map(winners.map((winner) => [winner.id, winner]))
  const redrawByOriginal = new Map(redraws.map((redraw) => [redraw.originalWinnerRecordId, redraw]))
  return {
    category,
    event,
    records: winners
      .slice()
      .sort((left, right) => left.sequenceNumber - right.sequenceNumber || left.id.localeCompare(right.id))
      .map((winner) => {
        const redraw = redrawByOriginal.get(winner.id) ?? null
        return { actor: 'local-operator', category, event, redraw, replacement: redraw === null ? null : byId.get(redraw.replacementWinnerRecordId) ?? null, session, winner }
      }),
    session,
  }
}
