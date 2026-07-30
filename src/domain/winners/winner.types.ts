import type { TicketNumber } from '../participants/participant.types.ts'
import type {
  DrawSessionId,
  EventId,
  ParticipantId,
  PrizeCategoryId,
  WinnerRecordId,
} from '../shared/identifiers.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'

export type WinnerStatus = 'pending' | 'confirmed' | 'cancelled'

export interface WinnerRecord {
  readonly id: WinnerRecordId
  readonly eventId: EventId
  readonly prizeCategoryId: PrizeCategoryId
  readonly drawSessionId: DrawSessionId
  readonly participantId: ParticipantId
  readonly ticketNumber: TicketNumber
  readonly sequenceNumber: number
  readonly status: WinnerStatus
  readonly participantDisplayName?: string
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
  readonly confirmedAt?: IsoTimestamp
  readonly cancelledAt?: IsoTimestamp
}

export interface WinnerCancellationContext {
  readonly auditedRedraw: boolean
}
