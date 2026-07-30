import type {
  DrawSessionId,
  EventId,
  RedrawRecordId,
  WinnerRecordId,
} from '../shared/identifiers.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'

export type RedrawReason =
  | 'absent'
  | 'invalid-ticket'
  | 'ineligible'
  | 'previous-winner'
  | 'operator-error'
  | 'other'

export interface RedrawRecord {
  readonly id: RedrawRecordId
  readonly eventId: EventId
  readonly drawSessionId: DrawSessionId
  readonly originalWinnerRecordId: WinnerRecordId
  readonly replacementWinnerRecordId: WinnerRecordId
  readonly reason: RedrawReason
  readonly reasonNote?: string
  readonly createdAt: IsoTimestamp
}

export const REDRAW_RECORD_POLICY = 'append-only' as const
