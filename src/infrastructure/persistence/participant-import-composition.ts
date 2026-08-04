import { createAuditRecordId, createParticipantId } from '../../domain/shared/identifiers.ts'
import { DexieEventRepository } from './repositories/event.repository.ts'
import { DexieParticipantRepository } from './repositories/participant.repository.ts'
import { DexiePreferenceRepository } from './repositories/preference.repository.ts'
import { RaffleOSDatabase } from './db.ts'
import { DexieParticipantImportUnitOfWork } from './transactions/dexie-participant-import-unit-of-work.ts'
import { getPersistedParticipantsForEvent } from '../../application/participant-import/participant-import-verification.ts'

export function createParticipantImportProductionServices() {
  const database = new RaffleOSDatabase()
  const participants = new DexieParticipantRepository(database)
  return {
    database,
    events: new DexieEventRepository(database),
    participants,
    getPersistedParticipantsForEvent: (eventId: Parameters<DexieParticipantRepository['findByEventId']>[0], limit: number) => getPersistedParticipantsForEvent(participants, eventId, limit),
    preferences: new DexiePreferenceRepository(database),
    unitOfWork: new DexieParticipantImportUnitOfWork(database),
    createParticipantId,
    createAuditRecordId,
    createOperationId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
  }
}
