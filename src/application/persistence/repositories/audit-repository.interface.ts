import type { AuditRecord } from '../../../domain/audit/audit.types.ts'
import type { EventId } from '../../../domain/shared/identifiers.ts'

export interface AuditRepository {
  findByEventId(eventId: EventId): Promise<AuditRecord[]>
  append(audit: AuditRecord): Promise<void>
}
