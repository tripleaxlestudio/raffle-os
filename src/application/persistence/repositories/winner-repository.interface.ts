import type {
  DrawSessionId,
  EventId,
  PrizeCategoryId,
  WinnerRecordId,
} from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type {
  WinnerRecord,
  WinnerStatus,
} from '../../../domain/winners/winner.types.ts'

export interface WinnerRepository {
  findByEventId(eventId: EventId): Promise<WinnerRecord[]>
  findByDrawSessionId(
    drawSessionId: DrawSessionId,
  ): Promise<WinnerRecord[]>
  findConfirmedByEventId(eventId: EventId): Promise<WinnerRecord[]>
  findConfirmedByEventAndCategory(
    eventId: EventId,
    prizeCategoryId: PrizeCategoryId,
  ): Promise<WinnerRecord[]>
  append(winner: WinnerRecord): Promise<void>
  appendBatch(winners: readonly WinnerRecord[]): Promise<void>
  transitionStatus(
    id: WinnerRecordId,
    from: WinnerStatus,
    to: WinnerStatus,
    at: IsoTimestamp,
  ): Promise<void>
}

/** Read-only boundary for official-history projections. */
export type WinnerReadRepository = Pick<WinnerRepository, 'findByEventId' | 'findByDrawSessionId' | 'findConfirmedByEventId' | 'findConfirmedByEventAndCategory'>
