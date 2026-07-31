import type {
  Participant,
  ParticipantOperationalChanges,
  TicketNumber,
} from '../../../domain/participants/participant.types.ts'
import type {
  EventId,
  ParticipantId,
} from '../../../domain/shared/identifiers.ts'

export interface ParticipantPage {
  readonly limit: number
  readonly offset: number
}

export interface ParticipantRepository {
  findById(id: ParticipantId): Promise<Participant | null>
  findByTicketNumber(
    eventId: EventId,
    ticketNumber: TicketNumber,
  ): Promise<Participant | null>
  /** Returns a bounded page ordered by Participant id. */
  findByEventId(
    eventId: EventId,
    page: ParticipantPage,
  ): Promise<Participant[]>
  countByEventId(eventId: EventId): Promise<number>
  /** Rejects empty batches; every accepted batch is inserted atomically. */
  createBatch(participants: readonly Participant[]): Promise<void>
  updateOperationalFields(
    id: ParticipantId,
    changes: ParticipantOperationalChanges,
  ): Promise<void>
  deleteDraftEventParticipants(eventId: EventId): Promise<void>
}
