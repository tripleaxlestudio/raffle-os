import type { TicketNumber } from '../participants/participant.types.ts'
import type {
  CommandId,
  DrawSessionId,
  EventId,
  ParticipantId,
  WinnerRecordId,
} from '../shared/identifiers.ts'
import type { IsoTimestamp } from '../shared/timestamps.ts'
import type { WinnerStatus } from './winner.types.ts'
import type { RedrawReason } from './redraw.types.ts'

export type RedrawRequestStatus = 'pending' | 'running' | 'completed'

export interface RedrawRequestTarget {
  readonly winnerId: WinnerRecordId
  readonly originalStatus: Extract<WinnerStatus, 'pending' | 'confirmed'>
  readonly originalSequenceNumber: number
}

export interface RedrawRequestSelection {
  readonly winnerRecordId: WinnerRecordId
  readonly participantId: ParticipantId
  readonly ticketNumber: TicketNumber
  readonly selectionOrder: number
}

/**
 * Durable private state for the gap between cancelling an original winner and
 * publishing its replacement. Selections never enter the public projection
 * directly; they become official WinnerRecords only when reveal begins.
 */
export interface RedrawRequest {
  readonly id: CommandId
  readonly eventId: EventId
  readonly drawSessionId: DrawSessionId
  readonly status: RedrawRequestStatus
  readonly reason: RedrawReason
  readonly reasonNote?: string
  readonly targets: readonly RedrawRequestTarget[]
  readonly replacementCount: number
  readonly selections?: readonly RedrawRequestSelection[]
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
  readonly startedAt?: IsoTimestamp
  readonly completedAt?: IsoTimestamp
}

