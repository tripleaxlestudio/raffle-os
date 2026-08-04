export { createParticipantImportProductionServices } from '../../infrastructure/persistence/participant-import-composition.ts'
import type { EventRepository } from '../persistence/repositories/event-repository.interface.ts'
import type { ParticipantRepository } from '../persistence/repositories/participant-repository.interface.ts'
import type { PreferenceRepository } from '../persistence/repositories/preference-repository.interface.ts'
import type { ParticipantImportUnitOfWork } from '../persistence/participant-import-unit-of-work.interface.ts'
import type { AuditRecordId, ParticipantId } from '../../domain/shared/identifiers.ts'
import type { PersistedParticipantPreview } from './participant-import-verification.ts'
import { getPersistedParticipantsForEvent } from './participant-import-verification.ts'

export interface ParticipantImportProductionServices {
  readonly database: { openSupported(): Promise<unknown> }
  readonly events: Pick<EventRepository, 'findById'>
  readonly participants: Pick<ParticipantRepository, 'findByEventId' | 'countByEventId'>
  readonly getPersistedParticipantsForEvent: (eventId: Parameters<ParticipantRepository['findByEventId']>[0], limit: number) => Promise<PersistedParticipantPreview>
  readonly preferences: Pick<PreferenceRepository, 'get'>
  readonly unitOfWork: ParticipantImportUnitOfWork
  readonly createParticipantId: () => ParticipantId
  readonly createAuditRecordId: () => AuditRecordId
  readonly createOperationId: () => string
  readonly now: () => string
}

export { getPersistedParticipantsForEvent }
