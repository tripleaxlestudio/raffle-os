import type { ParticipantRepository } from '../persistence/repositories/participant-repository.interface.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { EventId } from '../../domain/shared/identifiers.ts'

export interface PersistedParticipantPreview {
  readonly totalCount: number
  readonly records: readonly Participant[]
  readonly truncated: boolean
}

export async function getPersistedParticipantsForEvent(
  participants: Pick<ParticipantRepository, 'findByEventId' | 'countByEventId'>,
  eventId: EventId,
  limit: number,
): Promise<PersistedParticipantPreview> {
  const [records, totalCount] = await Promise.all([
    participants.findByEventId(eventId, { limit, offset: 0 }),
    participants.countByEventId(eventId),
  ])
  const boundedRecords = records.slice(0, limit)

  return {
    totalCount,
    records: boundedRecords,
    truncated: totalCount > boundedRecords.length,
  }
}
