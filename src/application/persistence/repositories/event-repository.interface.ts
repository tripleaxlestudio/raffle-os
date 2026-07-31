import type {
  Event,
  EventStatus,
} from '../../../domain/events/event.types.ts'
import type { EventId } from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'

export interface EventRepository {
  findById(id: EventId): Promise<Event | null>
  /** Returns Events ordered by createdAt, then id. */
  findAll(): Promise<Event[]>
  create(event: Event): Promise<void>
  updateDraft(event: Event): Promise<void>
  transitionStatus(
    id: EventId,
    from: EventStatus,
    to: EventStatus,
    at: IsoTimestamp,
  ): Promise<void>
  deleteDraft(id: EventId): Promise<void>
}
