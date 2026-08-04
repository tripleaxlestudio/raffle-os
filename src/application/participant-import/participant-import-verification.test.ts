import { describe, expect, it, vi } from 'vitest'
import { getPersistedParticipantsForEvent } from './participant-import-verification.ts'
import type { ParticipantRepository } from '../persistence/repositories/participant-repository.interface.ts'
import type { EventId, ParticipantId } from '../../domain/shared/identifiers.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'

const eventId = '11111111-1111-4111-8111-111111111111' as EventId
const timestamp = '2026-08-04T10:00:00.000Z' as IsoTimestamp
const records: Participant[] = [{ id: '1' as ParticipantId, eventId, ticketNumber: '00042' as never, isCheckedIn: false, createdAt: timestamp, updatedAt: timestamp }]

describe('persisted Participant verification read boundary', () => {
  it('combines a bounded read and total count without exposing the repository', async () => {
    const participants: Pick<ParticipantRepository, 'findByEventId' | 'countByEventId'> = {
      findByEventId: vi.fn().mockResolvedValue(records),
      countByEventId: vi.fn().mockResolvedValue(2),
    }
    await expect(getPersistedParticipantsForEvent(participants, eventId, 1)).resolves.toEqual({ totalCount: 2, records, truncated: true })
    expect(participants.findByEventId).toHaveBeenCalledWith(eventId, { limit: 1, offset: 0 })
    expect(participants.countByEventId).toHaveBeenCalledWith(eventId)
  })
})
