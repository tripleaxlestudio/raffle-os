import { createAuditRecordId, createParticipantId } from '../../domain/shared/identifiers.ts'
import { DexieEventRepository } from './repositories/event.repository.ts'
import { DexieParticipantRepository } from './repositories/participant.repository.ts'
import { DexiePreferenceRepository } from './repositories/preference.repository.ts'
import { RaffleOSDatabase } from './db.ts'
import { DexieParticipantImportUnitOfWork } from './transactions/dexie-participant-import-unit-of-work.ts'
import { getPersistedParticipantsForEvent } from '../../application/participant-import/participant-import-verification.ts'
import { DexieDrawSessionRepository } from './repositories/draw-session.repository.ts'

export function createParticipantImportProductionServices() {
  const database = new RaffleOSDatabase()
  const participants = new DexieParticipantRepository(database)
  const sessions = new DexieDrawSessionRepository(database)
  return {
    database,
    events: new DexieEventRepository(database),
    participants,
    getPersistedParticipantsForEvent: (eventId: Parameters<DexieParticipantRepository['findByEventId']>[0]) => getPersistedParticipantsForEvent(participants, eventId),
    preferences: new DexiePreferenceRepository(database),
    sessions,
    unitOfWork: new DexieParticipantImportUnitOfWork(database),
    createParticipantId,
    createAuditRecordId,
    createOperationId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
  }
}
