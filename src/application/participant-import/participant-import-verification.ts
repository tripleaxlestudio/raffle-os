import type { ParticipantRepository } from '../persistence/repositories/participant-repository.interface.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { EventId } from '../../domain/shared/identifiers.ts'

export interface PersistedParticipantPreview {
  readonly totalCount: number
  readonly records: readonly Participant[]
}

export async function getPersistedParticipantsForEvent(
  participants: Pick<ParticipantRepository, 'findByEventId' | 'countByEventId'>,
  eventId: EventId,
): Promise<PersistedParticipantPreview> {
  const totalCount = await participants.countByEventId(eventId)
  const records = await participants.findByEventId(eventId, { limit: totalCount, offset: 0 })

  return {
    totalCount,
    records,
  }
}
